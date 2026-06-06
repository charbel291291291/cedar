-- Allow admins to insert, update, and delete supplier_mappings
-- Previously only SELECT was granted to authenticated users.

CREATE POLICY "supplier_mappings_admin_insert"
  ON public.supplier_mappings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user());

CREATE POLICY "supplier_mappings_admin_update"
  ON public.supplier_mappings
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "supplier_mappings_admin_delete"
  ON public.supplier_mappings
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user());
