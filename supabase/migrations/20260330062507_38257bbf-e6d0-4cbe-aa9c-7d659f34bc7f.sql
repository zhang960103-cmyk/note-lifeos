CREATE TABLE public.energy_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('高', '中', '低', '透支')),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  note TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.energy_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own energy_logs" ON public.energy_logs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_energy_logs_user_date ON public.energy_logs (user_id, timestamp DESC);