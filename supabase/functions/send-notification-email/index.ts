import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

interface NotificationRecord {
  id: string
  user_id: string
  type: string
  message: string
  status: string
  created_at: string
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE"
  table: string
  record: NotificationRecord | null
  old_record: unknown
}

function buildEmailHtml(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.08);">
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Charbel Card</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">${message}</p>
        </td></tr>
        <tr><td style="padding:0 32px 28px;border-top:1px solid #f0f0f0;">
          <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">
            You're receiving this because you have an account on Charbel Card.
            This is an automated message — please do not reply.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function buildSubject(type: string, status: string): string {
  if (type === "topup") {
    if (status === "approved") return "✅ Wallet Top-Up Approved"
    if (status === "rejected") return "❌ Wallet Top-Up Rejected"
    return "💳 Wallet Top-Up Update"
  }
  if (type === "order") {
    if (status === "completed") return "✅ Your Order Is Complete"
    if (status === "failed" || status === "rejected") return "❌ Order Update"
    return "📦 Order Status Update"
  }
  return "Charbel Card — Notification"
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)

  // ── Verify webhook secret ──────────────────────────────────────────────────
  const expectedSecret = Deno.env.get("WEBHOOK_SECRET")
  if (expectedSecret && expectedSecret.length > 0) {
    const incoming = req.headers.get("x-webhook-secret") ?? ""
    if (incoming !== expectedSecret) {
      console.warn("Webhook secret mismatch")
      return json({ error: "unauthorized" }, 401)
    }
  }

  // ── Check Resend API key ───────────────────────────────────────────────────
  const resendKey = Deno.env.get("RESEND_API_KEY")
  if (!resendKey) {
    console.warn("RESEND_API_KEY not set — email skipped")
    return json({ ok: true, skipped: true, reason: "resend_not_configured" })
  }

  // ── Parse payload ──────────────────────────────────────────────────────────
  let payload: WebhookPayload
  try {
    payload = await req.json() as WebhookPayload
  } catch {
    return json({ error: "invalid_json" }, 400)
  }

  if (payload.type !== "INSERT" || !payload.record) {
    return json({ ok: true, skipped: true, reason: "not_insert" })
  }

  const notification = payload.record

  // ── Look up user email via auth.admin API ─────────────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(
    notification.user_id,
  )

  if (authErr || !authData?.user?.email) {
    console.error("Failed to get user email:", authErr?.message)
    return json({ ok: false, reason: "user_not_found" })
  }

  const userEmail = authData.user.email
  const emailFrom = Deno.env.get("EMAIL_FROM") ?? "Charbel Card <noreply@charbelcard.com>"
  const subject = buildSubject(notification.type, notification.status)
  const html = buildEmailHtml(notification.message)

  // ── Send via Resend ────────────────────────────────────────────────────────
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${resendKey}`,
    },
    body: JSON.stringify({ from: emailFrom, to: [userEmail], subject, html }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    console.error(`Resend error ${res.status}:`, errBody)
    return json({ ok: false, reason: "resend_error", status: res.status })
  }

  console.log(`Email sent to ${userEmail} — type=${notification.type} status=${notification.status}`)
  return json({ ok: true })
})
