# supplier-proxy

Invoked from the browser via `supabase.functions.invoke('supplier-proxy', { body: { order_id } })`.

## Secrets (set in Supabase Dashboard → Edge Functions → Secrets, or `supabase secrets set`)

| Name | Purpose |
|------|---------|
| `SUPPLIER_API_URL` | Supplier base URL (no trailing slash) |
| `SUPPLIER_API_KEY` | Supplier API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — updates orders + `supplier_logs` after the supplier call |

Supabase injects `SUPABASE_URL` and `SUPABASE_ANON_KEY` automatically.

## Optional

- `ALLOWED_ORIGINS` — comma-separated origins for `Access-Control-Allow-Origin` (defaults to `*` if unset).
