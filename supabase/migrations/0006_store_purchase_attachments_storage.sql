-- Migration 0006: Private Supabase Storage bucket for Store Purchase attachments
-- Scope: Private bucket 'store-purchase-attachments', RLS policies, 50MB file size limit

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-purchase-attachments',
  'store-purchase-attachments',
  false,
  52428800, -- 50 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv'
  ];

-- RLS Policy 1: Allow authenticated users to upload into their user folder
DROP POLICY IF EXISTS "Users can upload store purchase attachments to their folder" ON storage.objects;
CREATE POLICY "Users can upload store purchase attachments to their folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'store-purchase-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy 2: Allow authenticated users to view their own uploads, or Admin/Accounts to view any file
DROP POLICY IF EXISTS "Authorized users can read store purchase attachments" ON storage.objects;
CREATE POLICY "Authorized users can read store purchase attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'store-purchase-attachments' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'accounts')
    )
  )
);

-- RLS Policy 3: Allow users to delete their own uploads (used for cleanup)
DROP POLICY IF EXISTS "Users can delete their own store purchase attachments" ON storage.objects;
CREATE POLICY "Users can delete their own store purchase attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'store-purchase-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

