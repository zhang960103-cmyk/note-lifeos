
-- T03: Goals table for OKR data persistence
CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  quarter text NOT NULL,
  key_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own goals" ON public.goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- T04: Insight bookmarks table
CREATE TABLE IF NOT EXISTS public.insight_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  insight_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, insight_id)
);
ALTER TABLE public.insight_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own bookmarks" ON public.insight_bookmarks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- T05: AI model config fields on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_base_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_model text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_api_key_encrypted text;

-- T11: Currency setting on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency text DEFAULT 'CNY';

-- T12: User display name and avatar
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
