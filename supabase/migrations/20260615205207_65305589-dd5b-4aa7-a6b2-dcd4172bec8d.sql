
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS test jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS case_study jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS essay jsonb DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.concept_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.concept_maps TO authenticated;
GRANT ALL ON public.concept_maps TO service_role;

ALTER TABLE public.concept_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own concept maps"
  ON public.concept_maps FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER tg_concept_maps_updated_at
  BEFORE UPDATE ON public.concept_maps
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
