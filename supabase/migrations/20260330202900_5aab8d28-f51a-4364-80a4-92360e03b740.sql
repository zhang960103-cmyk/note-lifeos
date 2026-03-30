
-- AI Model Profiles table
CREATE TABLE public.ai_model_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  base_url text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  api_key_encrypted text DEFAULT '',
  usage_tag text NOT NULL DEFAULT 'chat',
  is_default boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_model_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own ai_model_profiles"
  ON public.ai_model_profiles FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to seed default model profiles for new users
CREATE OR REPLACE FUNCTION public.seed_ai_model_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.ai_model_profiles (user_id, name, description, base_url, model, api_key_encrypted, usage_tag, is_default, is_system) VALUES
    (NEW.id, '人生导师·主力版', '适合深度日记、人生复盘、任务拆解，中文优化', '', 'google/gemini-3-flash-preview', '', 'chat', true, true),
    (NEW.id, '效率整理·便宜版', '用于Todo提取、标签整理、财务解析，速度快成本低', '', 'google/gemini-2.5-flash-lite', '', 'cheap', false, true),
    (NEW.id, '本地/私有·预留版', '接入OpenClaw、Ollama或其他私有部署模型', 'http://localhost:11434/v1', 'llama3', '', 'private', false, true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_seed_models
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_ai_model_profiles();
