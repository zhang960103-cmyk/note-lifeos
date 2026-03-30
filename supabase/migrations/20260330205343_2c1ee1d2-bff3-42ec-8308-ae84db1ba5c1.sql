
-- Add version, status columns to ai_model_profiles
ALTER TABLE public.ai_model_profiles 
  ADD COLUMN IF NOT EXISTS version text NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Update seed function with upgraded models
CREATE OR REPLACE FUNCTION public.seed_ai_model_profiles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.ai_model_profiles (user_id, name, description, base_url, model, api_key_encrypted, usage_tag, is_default, is_system, version, status) VALUES
    (NEW.id, '人生导师·主力版', '深度日记、人生复盘、认知升维 · 使用内置AI额度', '', 'google/gemini-2.5-pro', '', 'chat', true, true, '1.0', 'active'),
    (NEW.id, '效率整理·便宜版', 'Todo提取、标签整理、财务解析 · 极速低耗', '', 'google/gemini-2.5-flash-lite', '', 'cheap', false, true, '1.0', 'active'),
    (NEW.id, 'OpenClaw 智能版', '接入本地/私有高质量中文模型 · 需自行配置', 'https://api.openclaw.com/v1', 'deepseek-chat', '', 'private', false, true, '1.0', 'active');
  RETURN NEW;
END;
$function$;
