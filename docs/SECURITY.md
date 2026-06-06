# Charbel Card — security posture

After RLS + admin routing, the app lines up as follows:

## Frontend

- **Admin routes** — `/admin` is wrapped in `AdminRoute`, which loads `users.role` and requires `role === 'admin'` before rendering.
- **Authenticated shell** — Dashboard/Services still use `ProtectedRoute` (Supabase session).

## Database (Supabase)

- **`public.users`** — Users see/update only their own row **unless** admin; only admins may `UPDATE` rows (including balance via controlled paths).
- **`topup_requests`** — Users insert/select their own requests; only admins `UPDATE` (approve/reject). Wallet credit uses **`approve_topup_request`** RPC (single transaction, `pending` only).
- **`orders`** — Users insert/select own orders; **only admins** `UPDATE` status (no broad “anyone can update” policy).
- **`transactions`** — Users see own rows; admins can manage as defined in migration policies.
- **RPCs** — `increment_balance`, `approve_topup_request`, and policy helper `is_admin_user()` are `SECURITY DEFINER` with explicit admin checks where needed.

## Supplier API keys

- The MVP calls the supplier from the browser using `VITE_SUPPLIER_API_URL` and `VITE_SUPPLIER_API_KEY` (see `src/lib/supplier.ts`).
- **Those values are public to anyone who loads the app.** Use test credentials only, or a token scoped to a sandbox.
- **Production:** move the HTTP call to a **Supabase Edge Function** (or other server) and pass only an internal order id; keep the real supplier secret on the server.

## Hardening backlog (optional)

- Store **admin allowlist** or use Supabase **custom claims** for `role` instead of only `public.users.role`.
- Add **audit log** table for balance and order status changes.
- **Rate-limit** sensitive RPCs at the API gateway if you expose them beyond this SPA.

This stays scalable: policies are enforced in Postgres for any future client (mobile, automation worker with user JWT, etc.).
