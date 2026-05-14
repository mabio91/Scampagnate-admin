
-- Points configuration table (configurable point values)
CREATE TABLE public.points_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL UNIQUE,
  points integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.points_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage points config" ON public.points_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view points config" ON public.points_config
  FOR SELECT TO public USING (true);

-- Seed default point values
INSERT INTO public.points_config (action_type, points, description) VALUES
  ('event_registration', 5, 'Iscrizione ad evento completata'),
  ('event_attended', 15, 'Evento frequentato (check-in)'),
  ('first_event_ever', 10, 'Primo evento in assoluto (bonus)'),
  ('first_event_category', 10, 'Primo evento in una nuova categoria'),
  ('streak_3', 10, 'Serie di 3 eventi senza cancellazioni'),
  ('proposal_submitted', 5, 'Proposta attività inviata'),
  ('proposal_approved', 20, 'Proposta attività approvata'),
  ('profile_completed', 10, 'Profilo completato al 100%'),
  ('no_show', -5, 'Assenza senza preavviso'),
  ('late_cancellation', -3, 'Cancellazione tardiva');

-- Points history table
CREATE TABLE public.points_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  value integer NOT NULL,
  reference_id uuid,
  description text NOT NULL DEFAULT '',
  admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.points_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage points history" ON public.points_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own points history" ON public.points_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_points_history_user ON public.points_history(user_id);

-- Community levels table (configurable thresholds)
CREATE TABLE public.community_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_number integer NOT NULL UNIQUE,
  name text NOT NULL,
  min_points integer NOT NULL DEFAULT 0,
  icon text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage community levels" ON public.community_levels
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view community levels" ON public.community_levels
  FOR SELECT TO public USING (true);

-- Seed default levels
INSERT INTO public.community_levels (level_number, name, min_points, icon, color) VALUES
  (1, 'Nuovo arrivato', 0, '🌱', '#94a3b8'),
  (2, 'Scampagnatore', 50, '🥾', '#22c55e'),
  (3, 'Esploratore', 150, '⭐', '#3b82f6'),
  (4, 'Avventuriero', 300, '⭐⭐', '#8b5cf6'),
  (5, 'Veterano', 600, '👑', '#f59e0b'),
  (6, 'Leggenda', 1000, '👑🔥', '#ef4444');

-- Missions table
CREATE TABLE public.missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'one_time' CHECK (type IN ('weekly', 'monthly', 'one_time')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  target_value integer NOT NULL DEFAULT 1,
  reward_points integer NOT NULL DEFAULT 0,
  reward_badge_id uuid REFERENCES public.badges(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage missions" ON public.missions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active missions" ON public.missions
  FOR SELECT TO public USING (is_active = true);

-- User missions progress table
CREATE TABLE public.user_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  progress integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, mission_id)
);

ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage user missions" ON public.user_missions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own missions" ON public.user_missions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admin action log (audit trail)
CREATE TABLE public.admin_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage action log" ON public.admin_action_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_admin_action_log_user ON public.admin_action_log(user_id);

-- Add progress field to user_badges
ALTER TABLE public.user_badges ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0;
ALTER TABLE public.user_badges ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_badges ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Add requirement_type and requirement_value to badges for expanded badge system
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS requirement_type text;
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS requirement_value integer NOT NULL DEFAULT 1;

-- Function to add points and update total
CREATE OR REPLACE FUNCTION public.add_user_points(
  p_user_id uuid,
  p_type text,
  p_value integer,
  p_reference_id uuid DEFAULT NULL,
  p_description text DEFAULT '',
  p_admin_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO points_history (user_id, type, value, reference_id, description, admin_id)
  VALUES (p_user_id, p_type, p_value, p_reference_id, p_description, p_admin_id);

  UPDATE profiles SET total_points = GREATEST(0, total_points + p_value)
  WHERE id = p_user_id;
END;
$$;

-- Function to get user community level
CREATE OR REPLACE FUNCTION public.get_user_community_level(p_points integer)
RETURNS TABLE(level_number integer, name text, icon text, color text, min_points integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cl.level_number, cl.name, cl.icon, cl.color, cl.min_points
  FROM community_levels cl
  WHERE cl.min_points <= p_points
  ORDER BY cl.min_points DESC
  LIMIT 1;
$$;
