-- Create public bucket for service images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-images',
  'service-images',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Admin can upload/update/delete service images
CREATE POLICY "admin_can_manage_service_images"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'service-images' AND public.is_admin_user())
  WITH CHECK (bucket_id = 'service-images' AND public.is_admin_user());

-- Everyone (including anon) can read service images (public bucket)
CREATE POLICY "public_read_service_images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'service-images');

-- Grant admin full access to services table management
GRANT INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.packages TO authenticated;
