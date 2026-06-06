// @ts-ignore
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
// @ts-ignore
declare const Deno: any;
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

const RATE_WINDOW_MS = 60_000
const RATE_MAX = 20
const rateBucket = new Map<string, number[]>()

function rateLimit(uid: string): boolean {
  const now = Date.now()
  const prev = rateBucket.get(uid) ?? []
  const windowed = prev.filter(t => now - t < RATE_WINDOW_MS)
  if (windowed.length >= RATE_MAX) return false
  windowed.push(now)
  rateBucket.set(uid, windowed)
  return true
}

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin") ?? ""
  const raw = Deno.env.get("ALLOWED_ORIGINS")?.split(",").map((s: string) => s.trim()).filter(Boolean)
  const allow = !raw?.length ? "*" : raw.includes(origin) ? origin : raw[0] ?? "*"
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  }
}

function json(body: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) })
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, req)

  // Auth check
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return json({ ok: false, error: "missing_auth" }, 401, req)

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  if (!supabaseUrl || !anonKey) return json({ ok: false, error: "server_misconfigured" }, 500, req)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return json({ ok: false, error: "invalid_session" }, 401, req)
  if (!rateLimit(user.id)) return json({ ok: false, error: "rate_limited" }, 429, req)

  // Parse body
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { return json({ ok: false, error: "invalid_json" }, 400, req) }

  const action = String(body.action || "")
  const SAHL_URL = Deno.env.get("SAHL_CASH_API_URL")
  const SAHL_TOKEN = Deno.env.get("SAHL_CASH_API_TOKEN")

  if (!SAHL_URL || !SAHL_TOKEN) return json({ ok: false, error: "sahl_cash_not_configured" }, 500, req)

  const headers = { "api-token": SAHL_TOKEN, "Accept": "application/json" }

  // ─── ACTION: Get Products ───
  if (action === "products") {
    try {
      const res = await fetch(`${SAHL_URL}/client/api/products`, { headers })
      const data = await res.json()
      return json(data, 200, req)
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500, req)
    }
  }

  // ─── ACTION: Get Balance ───
  if (action === "balance") {
    try {
      const res = await fetch(`${SAHL_URL}/client/api/profile`, { headers })
      const data = await res.json()
      return json(data, 200, req)
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500, req)
    }
  }

  // ─── ACTION: Get Content/Categories ───
  if (action === "content") {
    const parentId = body.parent_id ?? 0
    try {
      const res = await fetch(`${SAHL_URL}/client/api/content/${parentId}`, { headers })
      const data = await res.json()
      return json(data, 200, req)
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500, req)
    }
  }

  // ─── ACTION: Place Order ───
  if (action === "order") {
    const productId = body.product_id
    const qty = body.quantity ?? 1
    const params = body.params || {}
    const orderUuid = body.order_uuid || crypto.randomUUID()

    if (!productId) return json({ ok: false, error: "missing_product_id" }, 400, req)

    try {
      // Build query params
      const qp = new URLSearchParams()
      qp.set("qty", String(qty))
      qp.set("order_uuid", String(orderUuid))
      
      // Add dynamic params (playerId, etc.)
      if (typeof params === "object" && params !== null) {
        for (const [k, v] of Object.entries(params as Record<string, string>)) {
          qp.set(k, String(v))
        }
      }

      const url = `${SAHL_URL}/client/api/newOrder/${productId}/params?${qp.toString()}`
      const res = await fetch(url, { headers })
      const data = await res.json()
      return json(data, 200, req)
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500, req)
    }
  }

  // ─── ACTION: Check Order Status ───
  if (action === "check") {
    const orderIds = body.order_ids
    if (!orderIds) return json({ ok: false, error: "missing_order_ids" }, 400, req)

    try {
      const isUuid = body.use_uuid ? "&uuid=1" : ""
      const url = `${SAHL_URL}/client/api/check?orders=[${orderIds}]${isUuid}`
      const res = await fetch(url, { headers })
      const data = await res.json()
      return json(data, 200, req)
    } catch (e) {
      return json({ ok: false, error: String(e) }, 500, req)
    }
  }

  return json({ ok: false, error: "unknown_action" }, 400, req)
})
