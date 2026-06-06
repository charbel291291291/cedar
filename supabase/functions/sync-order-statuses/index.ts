// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

Deno.serve(async (req: Request) => {
  const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // 1. Fetch processing orders that haven't been checked in 10 minutes
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: stuckOrders } = await adminClient
      .from('orders')
      .select('id, supplier_order_id, user_id, cost, status')
      .in('status', ['processing', 'pending'])
      .lt('last_checked_at', tenMinsAgo)
      .limit(50);

    if (!stuckOrders || stuckOrders.length === 0) return new Response("No orders to sync.", { status: 200 });

    const orderIds = stuckOrders.map(o => o.supplier_order_id).join(',');

    // 2. Fetch statuses from JAP
    const japResponse = await fetch(Deno.env.get('SUPPLIER_API_URL')!, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            key: Deno.env.get('SUPPLIER_API_KEY')!,
            action: "status",
            orders: orderIds
        })
    });

    const statuses = await japResponse.json();

    // 3. Process matches
    for (const internalOrder of stuckOrders) {
        const supplierData = statuses[internalOrder.supplier_order_id];
        if (!supplierData || supplierData.error) continue;

        const newStatus = supplierData.status.toLowerCase(); // 'completed', 'canceled', 'partial', 'processing'
        
        if (newStatus === 'canceled' || newStatus === 'refunded') {
            await adminClient.rpc('secure_refund_smm_order', {
                 p_order_id: internalOrder.id, p_user_id: internalOrder.user_id, p_refund_amount: internalOrder.cost, p_reason: newStatus
            });
        } else if (newStatus === 'partial') {
            const remainsRatio = Number(supplierData.remains) / Number(supplierData.quantity);
            const refundAmount = internalOrder.cost * remainsRatio;
            await adminClient.rpc('secure_refund_smm_order', {
                 p_order_id: internalOrder.id, p_user_id: internalOrder.user_id, p_refund_amount: refundAmount, p_reason: 'Partial Delivery'
            });
        } else {
            // Update successful or processing statuses
            await adminClient.from('orders').update({
                status: newStatus === 'in progress' ? 'processing' : newStatus,
                last_checked_at: new Date().toISOString(),
                start_count: supplierData.start_count,
                remains: supplierData.remains
            }).eq('id', internalOrder.id);
        }
    }

    return new Response(JSON.stringify({ processed: stuckOrders.length }), { headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
