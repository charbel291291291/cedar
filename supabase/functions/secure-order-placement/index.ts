// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    // 1. Authentication & Identifier Extraction
    const authHeader = req.headers.get("Authorization");
    const ip = req.headers.get("x-forwarded-for") || "unknown_ip";
    let identifier = ip; 
    let userId = null;

    if (authHeader) {
      const { data: { user } } = await adminClient.auth.getUser(authHeader.replace('Bearer ', ''));
      if (user) { userId = user.id; identifier = user.id; }
    }

    if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    // 2. Rate Limiting Check (Postgres Fallback)
    const { data: isAllowed, error: limitErr } = await adminClient.rpc('check_rate_limit', {
        p_identifier: identifier, p_limit: 5, p_window_seconds: 10
    });
    if (limitErr || !isAllowed) {
        return new Response(JSON.stringify({ success: false, error: "Too many requests. Please wait 10 seconds." }), { 
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
    }

    // 3. Payload Parsing
    const { service_id, link, quantity, request_id } = await req.json();
    if (!service_id || !link || !quantity || !request_id) throw new Error("Missing required fields");

    // 4. Fetch Retail Price (Ensure Profit)
    const { data: serviceConfig } = await adminClient.from('smm_services').select('rate, min, max').eq('service_id', String(service_id)).single();
    if (!serviceConfig || quantity < serviceConfig.min || quantity > serviceConfig.max) throw new Error("Invalid service or quantity.");

    const totalCost = (Number(serviceConfig.rate) / 1000) * quantity;

    // 5. Atomic Wallet Deduction & Order Creation
    const { data: orderId, error: walletError } = await adminClient.rpc('process_smm_wallet_deduction_v2', {
        p_user_id: userId,
        p_cost: totalCost,
        p_service_id: service_id,
        p_quantity: quantity,
        p_link: link,
        p_request_id: request_id
    });

    if (walletError) {
        if (walletError.message.includes('unique_request_id')) throw new Error("Duplicate request intercepted.");
        throw walletError;
    }

    // 6. Proxy to JustAnotherPanel
    const japResponse = await fetch(Deno.env.get('SUPPLIER_API_URL')!, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            key: Deno.env.get('SUPPLIER_API_KEY')!,
            action: "add",
            service: String(service_id),
            link: link,
            quantity: String(quantity)
        })
    });

    const supplierResult = await japResponse.json();

    if (supplierResult.error) {
        // Safe Atomic Refund
        await adminClient.rpc('secure_refund_smm_order', {
             p_order_id: orderId, p_user_id: userId, p_refund_amount: totalCost, p_reason: supplierResult.error
        });
        throw new Error(`Supplier Error: ${supplierResult.error} - Funds safely refunded.`);
    }

    // 7. Attach Supplier Order ID
    await adminClient.from('orders').update({ 
        supplier_order_id: supplierResult.order, 
        status: 'processing',
        last_checked_at: new Date().toISOString()
    }).eq('id', orderId);

    return new Response(JSON.stringify({ success: true, order_id: orderId, supplier_id: supplierResult.order }), { headers: corsHeaders });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 400, headers: corsHeaders });
  }
});
