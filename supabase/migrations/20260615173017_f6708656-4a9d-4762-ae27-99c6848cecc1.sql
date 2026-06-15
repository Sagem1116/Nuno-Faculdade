-- Add summary columns
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS summary jsonb DEFAULT NULL;
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS summary jsonb DEFAULT NULL;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS summary jsonb DEFAULT NULL;

-- Lesson documents (file uploads + videos)
CREATE TABLE public.lesson_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'file', -- file | video | link
  mime_type text,
  size_bytes bigint,
  storage_path text,           -- path in storage bucket (for uploads)
  external_url text,           -- for video/link
  text_content text,           -- extracted text for AI
  summary jsonb,               -- {short, medium, long, concepts, keywords, questions}
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_documents TO authenticated;
GRANT ALL ON public.lesson_documents TO service_role;

ALTER TABLE public.lesson_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own documents" ON public.lesson_documents
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_lesson_documents_updated_at
  BEFORE UPDATE ON public.lesson_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Storage RLS policies for the lesson-documents bucket
CREATE POLICY "users read own lesson files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lesson-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users upload own lesson files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lesson-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users update own lesson files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'lesson-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users delete own lesson files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lesson-documents' AND auth.uid()::text = (storage.foldername(name))[1]);