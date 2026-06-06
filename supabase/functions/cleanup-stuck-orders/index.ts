// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

Deno.serve(async (req: Request) => {
  const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // 1. Fetch orders stuck in "processing" for more than 2 hours without a supplier_order_id
    // This happens if the Edge Function crashed before reaching JAP.
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    
    const { data: stuckOrders } = await adminClient
      .from('orders')
      .select('id, user_id, cost')
      .eq('status', 'processing')
      .is('supplier_order_id', null)
      .lt('created_at', twoHoursAgo)
      .limit(50);

    if (!stuckOrders || stuckOrders.length === 0) {
        return new Response("No stuck orders found.", { status: 200 });
    }

    let refundedCount = 0;

    for (const order of stuckOrders) {
        // Securely refund the user and mark order as failed
        const { error } = await adminClient.rpc('secure_refund_smm_order', {
             p_order_id: order.id, 
             p_user_id: order.user_id, 
             p_refund_amount: order.cost, 
             p_reason: 'System error: Order timeout before reaching supplier'
        });

        if (!error) {
            refundedCount++;
        } else {
            console.error(`Failed to refund order ${order.id}:`, error);
        }
    }

    return new Response(JSON.stringify({ 
        message: `Successfully refunded ${refundedCount} stuck orders.`,
        refunded_orders: stuckOrders.map(o => o.id)
    }), { headers: { "Content-Type": "application/json" } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
