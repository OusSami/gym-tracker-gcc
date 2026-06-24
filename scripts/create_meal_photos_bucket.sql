INSERT INTO storage.buckets (id, name, public)
VALUES ('meal-photos', 'meal-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "users can upload meal photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'meal-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "meal photos are public"
ON storage.objects FOR SELECT
USING (bucket_id = 'meal-photos');
