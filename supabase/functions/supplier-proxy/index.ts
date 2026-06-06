// @ts-ignore
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
// @ts-ignore
declare const Deno: any;
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

const RATE_WINDOW_MS = 60_000
const RATE_MAX = 24
const rateBucket = new Map<string, number[]>()

function allowRateLimit(userId: string): boolean {
  const now = Date.now()
  const prev = rateBucket.get(userId) ?? []
  const windowed = prev.filter((t) => now - t < RATE_WINDOW_MS)
  if (windowed.length >= RATE_MAX) return false
  windowed.push(now)
  rateBucket.set(userId, windowed)
  return true
}

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin") ?? ""
  const raw = Deno.env.get("ALLOWED_ORIGINS")?.split(",").map((s: string) => s.trim()).filter(Boolean)
  const allowOrigin =
    !raw?.length ? "*" : raw.includes(origin) ? origin : raw[0] ?? "*"
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  }
}

function json(body: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req)

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors })
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, req)
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ ok: false, error: "missing_authorization" }, 401, req)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error("Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY")
    return json({ ok: false, error: "server_misconfigured" }, 500, req)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser()

  if (authErr || !user) {
    return json({ ok: false, error: "invalid_session" }, 401, req)
  }

  if (!allowRateLimit(user.id)) {
    return json({ ok: false, error: "rate_limited" }, 429, req)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400, req)
  }

  const bodyObj = body && typeof body === "object" ? (body as Record<string, unknown>) : null
  const actionParam = typeof bodyObj?.action === "string" ? bodyObj.action : ""
  
  const SUPPLIER_URL = Deno.env.get("SUPPLIER_API_URL")
  const API_KEY = Deno.env.get("SUPPLIER_API_KEY")

  if (!SUPPLIER_URL || !API_KEY) {
    return json({ ok: false, error: "supplier_not_configured" }, 500, req)
  }

  // If the user wants to fetch services or balance directly
  if (actionParam === "services" || actionParam === "balance") {
    try {
      const formData = new URLSearchParams()
      formData.append("key", API_KEY)
      formData.append("action", actionParam)

      const res = await fetch(SUPPLIER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      })
      
      const text = await res.text()
      try {
        return json(JSON.parse(text), 200, req)
      } catch {
        return json({ raw: text }, 200, req)
      }
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500, req)
    }
  }

  // --- NORMAL ORDER PROCESSING LOGIC ---
  const orderId = typeof bodyObj?.order_id === "string" ? bodyObj.order_id.trim() : ""

  if (!orderId || !UUID_RE.test(orderId)) {
    return json({ ok: false, error: "invalid_order_id_or_action" }, 400, req)
  }

  const { data: claim, error: claimErr } = await userClient.rpc(
    "claim_order_for_supplier",
    { p_order_id: orderId },
  )

  if (claimErr) {
    console.error("claim_order_for_supplier", claimErr)
    return json(
      {
        ok: false,
        error: "claim_rpc_error",
        message: claimErr.message,
      },
      200,
      req,
    )
  }

  const c = claim as Record<string, unknown>
  if (!c?.ok) {
    return json({ ok: false, error: "claim_rejected", detail: claim }, 200, req)
  }

  const supplierService = String(c.supplier_service ?? "")
  const supplierPackage = String(c.supplier_package ?? "")
  const target = String(c.target ?? "")

  if (!supplierService || !supplierPackage || !target) {
    await serviceClient
      .from("orders")
      .update({ status: "paid" })
      .eq("id", orderId)
      .eq("status", "processing")
    return json({ ok: false, error: "invalid_claim_payload" }, 200, req)
  }

  // SUPPLIER_URL and API_KEY are already defined and checked above

  const safeRequest = { 
    action: "add", 
    service: supplierService, 
    quantity: supplierPackage, 
    link: target 
  }
  const url = SUPPLIER_URL
  let supplierHttpOk = false
  let supplierBody: unknown

  try {
    const formData = new URLSearchParams()
    formData.append("key", API_KEY)
    formData.append("action", "add")
    formData.append("service", supplierService)
    formData.append("quantity", supplierPackage)
    formData.append("link", target)

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    })
    supplierHttpOk = res.ok
    const text = await res.text()
    try {
      supplierBody = text ? JSON.parse(text) : {}
    } catch {
      supplierBody = { raw: text, parse_error: true }
    }
  } catch (e) {
    supplierBody = { error: String(e) }
    supplierHttpOk = false
  }

  const logStatus = supplierHttpOk ? "http_ok" : "http_error"
  const { error: logErr } = await serviceClient.from("supplier_logs").insert({
    order_id: orderId,
    request: safeRequest,
    response: supplierBody as object,
    status: logStatus,
  })
  if (logErr) console.error("supplier_logs insert", logErr)

  const sb =
    supplierBody && typeof supplierBody === "object"
      ? (supplierBody as Record<string, unknown>)
      : null
  
  // SMM Panels typically return { "error": "Reason" } on failure, or { "order": 12345 } on success
  const supplierReportsFailure = sb?.error !== undefined || sb?.success === false
  const success = supplierHttpOk && !supplierReportsFailure

  if (success) {
    await serviceClient.from("orders").update({ status: "completed" }).eq("id", orderId)
    return json({ ok: true, supplier: supplierBody }, 200, req)
  }

  const finalStatus = supplierHttpOk && supplierReportsFailure ? "rejected" : "failed"
  await serviceClient.from("orders").update({ status: finalStatus }).eq("id", orderId)

  return json(
    {
      ok: false,
      error: "supplier_failed",
      order_status: finalStatus,
      supplier: supplierBody,
    },
    200,
    req,
  )
})
