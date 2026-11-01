-- AutoCaption Studio: Production Database Schema & Storage Setup
-- Phase: Video Uploads, Project Management, and Security (RLS)

-- 1. Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    aspect_ratio TEXT NOT NULL DEFAULT '9:16' CHECK (aspect_ratio IN ('9:16', '16:9', '1:1', '4:5')),
    caption_style JSONB NOT NULL DEFAULT '{}'::jsonb,
    caption_segments JSONB NOT NULL DEFAULT '[]'::jsonb,
    video_id UUID,
    video_storage_path TEXT,
    video_name TEXT,
    video_duration_ms INTEGER DEFAULT 0,
    video_width INTEGER DEFAULT 0,
    video_height INTEGER DEFAULT 0,
    video_fps INTEGER DEFAULT 30,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for fast user project lookups
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);

-- 3. Create videos table
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    storage_path TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    mime_type TEXT NOT NULL CHECK (mime_type IN ('video/mp4', 'video/quicktime', 'video/webm')),
    duration_ms INTEGER NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 0,
    height INTEGER NOT NULL DEFAULT 0,
    fps INTEGER NOT NULL DEFAULT 30,
    status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'ready', 'failed', 'abandoned')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_project_id ON public.videos(project_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status);

-- 4. Enable Row Level Security (RLS) on both tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- 5. Row Level Security Policies for Projects (Strict User Isolation)
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
CREATE POLICY "Users can view own projects"
    ON public.projects FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
CREATE POLICY "Users can insert own projects"
    ON public.projects FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
CREATE POLICY "Users can update own projects"
    ON public.projects FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
CREATE POLICY "Users can delete own projects"
    ON public.projects FOR DELETE
    USING (auth.uid() = user_id);

-- 6. Row Level Security Policies for Videos (Strict User Isolation)
DROP POLICY IF EXISTS "Users can view own videos" ON public.videos;
CREATE POLICY "Users can view own videos"
    ON public.videos FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own videos" ON public.videos;
CREATE POLICY "Users can insert own videos"
    ON public.videos FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own videos" ON public.videos;
CREATE POLICY "Users can update own videos"
    ON public.videos FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own videos" ON public.videos;
CREATE POLICY "Users can delete own videos"
    ON public.videos FOR DELETE
    USING (auth.uid() = user_id);

-- 7. Supabase Storage Bucket Setup
-- Create private bucket 'videos' if not already created
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'videos',
    'videos',
    false,
    524288000, -- 500 MB max file size
    ARRAY['video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 524288000,
    allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/webm'];

-- 8. Storage Row Level Security Policies
-- Object path convention: {user_id}/{project_id}/{video_id}.{ext}
DROP POLICY IF EXISTS "Users can view own storage video objects" ON storage.objects;
CREATE POLICY "Users can view own storage video objects"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'videos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Users can upload own storage video objects" ON storage.objects;
CREATE POLICY "Users can upload own storage video objects"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'videos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Users can update own storage video objects" ON storage.objects;
CREATE POLICY "Users can update own storage video objects"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'videos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Users can delete own storage video objects" ON storage.objects;
CREATE POLICY "Users can delete own storage video objects"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'videos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- 9. Auto-update timestamp function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_projects_updated_at ON public.projects;
CREATE TRIGGER trigger_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_videos_updated_at ON public.videos;
CREATE TRIGGER trigger_videos_updated_at
    BEFORE UPDATE ON public.videos
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 10. Storage quota check trigger function (2GB per user limit)
CREATE OR REPLACE FUNCTION public.check_user_storage_quota()
RETURNS TRIGGER AS $$
DECLARE
    total_bytes BIGINT;
    max_quota_bytes CONSTANT BIGINT := 2147483648; -- 2 GB
BEGIN
    SELECT COALESCE(SUM(file_size), 0)
    INTO total_bytes
    FROM public.videos
    WHERE user_id = NEW.user_id AND status != 'abandoned' AND status != 'failed';

    IF (total_bytes + NEW.file_size) > max_quota_bytes THEN
        RAISE EXCEPTION 'User storage quota exceeded. Maximum allowed: 2GB. Current usage: % bytes', total_bytes;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_storage_quota ON public.videos;
CREATE TRIGGER trigger_check_storage_quota
    BEFORE INSERT ON public.videos
    FOR EACH ROW
    EXECUTE FUNCTION public.check_user_storage_quota();

-- 11. Maintenance Function: Cleanup abandoned uploads older than given hours
CREATE OR REPLACE FUNCTION public.cleanup_abandoned_videos(hours_threshold INTEGER DEFAULT 24)
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER := 0;
BEGIN
    UPDATE public.videos
    SET status = 'abandoned'
    WHERE status = 'uploading'
      AND created_at < (now() - (hours_threshold || ' hours')::interval);

    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
