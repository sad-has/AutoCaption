-- AutoCaption Studio: Migration for Exported Videos Bucket & RLS
-- Phase: Subtitle and Video Export

-- 1. Create private bucket 'exported-videos'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'exported-videos',
    'exported-videos',
    false,
    524288000, -- 500 MB max export size
    ARRAY['video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 524288000,
    allowed_mime_types = ARRAY['video/mp4'];

-- 2. Storage Row Level Security Policies for 'exported-videos'
-- Storage path structure: exports/{user_id}/{project_id}/{job_id}.mp4
DROP POLICY IF EXISTS "Users can view own exported videos" ON storage.objects;
CREATE POLICY "Users can view own exported videos"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'exported-videos'
        AND (storage.foldername(name))[2] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Users can upload own exported videos" ON storage.objects;
CREATE POLICY "Users can upload own exported videos"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'exported-videos'
        AND (storage.foldername(name))[2] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Users can delete own exported videos" ON storage.objects;
CREATE POLICY "Users can delete own exported videos"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'exported-videos'
        AND (storage.foldername(name))[2] = auth.uid()::text
    );
