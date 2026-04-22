-- Redesign missions into a flexible rule engine while preserving legacy data.

CREATE TABLE IF NOT EXISTS public.mission_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'lucide:Sparkles',
  banner_url text,
  color text,
  starts_at timestamptz,
  ends_at timestamptz,
  reward_multiplier numeric(6,2) NOT NULL DEFAULT 1.00,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mission_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage mission campaigns" ON public.mission_campaigns;
CREATE POLICY "Admins can manage mission campaigns"
  ON public.mission_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can view active mission campaigns" ON public.mission_campaigns;
CREATE POLICY "Anyone can view active mission campaigns"
  ON public.mission_campaigns FOR SELECT TO public
  USING (is_active = true);

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS internal_name text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'visible',
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS repeatable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mission_group text,
  ADD COLUMN IF NOT EXISTS campaign_tag text,
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.mission_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Rome',
  ADD COLUMN IF NOT EXISTS conditions_logic text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS icon_color text,
  ADD COLUMN IF NOT EXISTS icon_background text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS level integer,
  ADD COLUMN IF NOT EXISTS prerequisite_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS definition_version integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS legacy_config jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.missions DROP CONSTRAINT IF EXISTS missions_type_check;
ALTER TABLE public.missions
  ADD CONSTRAINT missions_type_check
  CHECK (type = ANY (ARRAY['one_time', 'repeatable', 'daily', 'weekly', 'monthly', 'seasonal', 'progressive', 'streak']));

ALTER TABLE public.missions DROP CONSTRAINT IF EXISTS missions_status_check;
ALTER TABLE public.missions
  ADD CONSTRAINT missions_status_check
  CHECK (status = ANY (ARRAY['active', 'inactive', 'draft', 'archived']));

ALTER TABLE public.missions DROP CONSTRAINT IF EXISTS missions_visibility_check;
ALTER TABLE public.missions
  ADD CONSTRAINT missions_visibility_check
  CHECK (visibility = ANY (ARRAY['visible', 'hidden', 'secret']));

ALTER TABLE public.missions DROP CONSTRAINT IF EXISTS missions_conditions_logic_check;
ALTER TABLE public.missions
  ADD CONSTRAINT missions_conditions_logic_check
  CHECK (conditions_logic = ANY (ARRAY['all', 'any']));

UPDATE public.missions
SET
  status = CASE
    WHEN is_archived THEN 'archived'
    WHEN is_active THEN 'active'
    ELSE 'inactive'
  END,
  repeatable = COALESCE(repeatable, false) OR type IN ('weekly', 'monthly'),
  ends_at = COALESCE(ends_at, expires_at),
  legacy_config = jsonb_build_object(
    'category', category,
    'category_filter', COALESCE(to_jsonb(category_filter), 'null'::jsonb),
    'target_action', target_action,
    'target_value', target_value,
    'streak_count', streak_count,
    'reset_on_failure', reset_on_failure,
    'reward_type', reward_type,
    'reward_value', reward_value,
    'reward_badge_id', reward_badge_id
  )
WHERE legacy_config = '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.mission_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  title text NOT NULL DEFAULT '',
  target_action text NOT NULL DEFAULT 'event_attendance',
  goal_metric text NOT NULL DEFAULT 'count',
  goal_operator text NOT NULL DEFAULT 'at_least',
  goal_value integer NOT NULL DEFAULT 1,
  unique_by text NOT NULL DEFAULT 'event',
  allow_repeat_same_event boolean NOT NULL DEFAULT false,
  period_unit text,
  period_value integer,
  event_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  behavior_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  reset_policy text NOT NULL DEFAULT 'none',
  push_notifications boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mission_conditions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage mission conditions" ON public.mission_conditions;
CREATE POLICY "Admins can manage mission conditions"
  ON public.mission_conditions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can view conditions of visible missions" ON public.mission_conditions;
CREATE POLICY "Anyone can view conditions of visible missions"
  ON public.mission_conditions FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.missions m
      WHERE m.id = mission_conditions.mission_id
        AND m.status = 'active'
        AND NOT m.is_archived
        AND m.visibility <> 'secret'
    )
  );

CREATE INDEX IF NOT EXISTS idx_mission_conditions_mission_id ON public.mission_conditions(mission_id, sort_order);

CREATE TABLE IF NOT EXISTS public.mission_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  reward_kind text NOT NULL DEFAULT 'points',
  title text NOT NULL DEFAULT '',
  points_value integer,
  badge_id uuid REFERENCES public.badges(id) ON DELETE SET NULL,
  source_discount_code_id uuid REFERENCES public.discount_codes(id) ON DELETE SET NULL,
  approval_required boolean NOT NULL DEFAULT false,
  visible_on_profile boolean NOT NULL DEFAULT true,
  badge_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  coupon_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  physical_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mission_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage mission rewards" ON public.mission_rewards;
CREATE POLICY "Admins can manage mission rewards"
  ON public.mission_rewards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can view rewards of visible missions" ON public.mission_rewards;
CREATE POLICY "Anyone can view rewards of visible missions"
  ON public.mission_rewards FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.missions m
      WHERE m.id = mission_rewards.mission_id
        AND m.status = 'active'
        AND NOT m.is_archived
    )
  );

CREATE INDEX IF NOT EXISTS idx_mission_rewards_mission_id ON public.mission_rewards(mission_id, sort_order);

CREATE TABLE IF NOT EXISTS public.mission_prerequisites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  prerequisite_mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  requirement_type text NOT NULL DEFAULT 'completion',
  sort_order integer NOT NULL DEFAULT 0,
  auto_archive_previous boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, prerequisite_mission_id)
);

ALTER TABLE public.mission_prerequisites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage mission prerequisites" ON public.mission_prerequisites;
CREATE POLICY "Admins can manage mission prerequisites"
  ON public.mission_prerequisites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can view mission prerequisites" ON public.mission_prerequisites;
CREATE POLICY "Anyone can view mission prerequisites"
  ON public.mission_prerequisites FOR SELECT TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_mission_prerequisites_mission_id ON public.mission_prerequisites(mission_id, sort_order);

CREATE TABLE IF NOT EXISTS public.user_mission_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  cycle_key text NOT NULL DEFAULT 'lifetime',
  current_value integer NOT NULL DEFAULT 0,
  target_value integer NOT NULL DEFAULT 1,
  completion_count integer NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  is_expired boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  last_progress_at timestamptz,
  cycle_started_at timestamptz,
  cycle_ends_at timestamptz,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  reward_details jsonb,
  legacy_user_mission_id uuid REFERENCES public.user_missions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mission_id, cycle_key)
);

ALTER TABLE public.user_mission_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage user mission progress" ON public.user_mission_progress;
CREATE POLICY "Admins can manage user mission progress"
  ON public.user_mission_progress FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can view own mission progress" ON public.user_mission_progress;
CREATE POLICY "Users can view own mission progress"
  ON public.user_mission_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_user_mission_progress_mission_id ON public.user_mission_progress(mission_id);
CREATE INDEX IF NOT EXISTS idx_user_mission_progress_user_id ON public.user_mission_progress(user_id);

CREATE TABLE IF NOT EXISTS public.user_mission_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  progress_id uuid REFERENCES public.user_mission_progress(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'progress',
  delta integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'info',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_mission_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage user mission history" ON public.user_mission_history;
CREATE POLICY "Admins can manage user mission history"
  ON public.user_mission_history FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can view own mission history" ON public.user_mission_history;
CREATE POLICY "Users can view own mission history"
  ON public.user_mission_history FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_user_mission_history_mission_id ON public.user_mission_history(mission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_mission_history_user_id ON public.user_mission_history(user_id, created_at DESC);

INSERT INTO public.mission_conditions (
  mission_id,
  sort_order,
  title,
  target_action,
  goal_metric,
  goal_operator,
  goal_value,
  unique_by,
  event_filters,
  behavior_filters,
  reset_policy,
  push_notifications
)
SELECT
  m.id,
  0,
  'Condizione principale',
  CASE m.target_action
    WHEN 'event_attended' THEN 'event_attendance'
    WHEN 'event_registered' THEN 'event_registration'
    WHEN 'category_attended' THEN 'category_participation'
    WHEN 'streak' THEN 'consecutive_participations'
    ELSE 'event_attendance'
  END,
  CASE
    WHEN m.type = 'streak' THEN 'streak'
    ELSE 'count'
  END,
  'at_least',
  COALESCE(NULLIF(m.target_value, 0), 1),
  CASE
    WHEN COALESCE(array_length(m.category_filter, 1), 0) > 1 THEN 'category'
    ELSE 'event'
  END,
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_category', m.category,
    'category_names', COALESCE(to_jsonb(m.category_filter), '[]'::jsonb)
  )),
  jsonb_strip_nulls(jsonb_build_object(
    'no_cancellation', m.reset_on_failure,
    'no_late_cancellation', m.reset_on_failure,
    'checked_in', m.target_action = 'event_attended'
  )),
  CASE WHEN m.reset_on_failure THEN 'full_reset' ELSE 'none' END,
  COALESCE(m.notify_on_progress, false)
FROM public.missions m
WHERE NOT EXISTS (
  SELECT 1 FROM public.mission_conditions mc WHERE mc.mission_id = m.id
);

INSERT INTO public.mission_rewards (
  mission_id,
  sort_order,
  reward_kind,
  title,
  points_value
)
SELECT
  m.id,
  0,
  'points',
  'Punti missione',
  m.reward_points
FROM public.missions m
WHERE COALESCE(m.reward_points, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.mission_rewards mr WHERE mr.mission_id = m.id AND mr.reward_kind = 'points'
  );

INSERT INTO public.mission_rewards (
  mission_id,
  sort_order,
  reward_kind,
  title,
  badge_id,
  badge_config,
  coupon_config,
  physical_config
)
SELECT
  m.id,
  1,
  m.reward_type,
  'Ricompensa legacy',
  m.reward_badge_id,
  CASE
    WHEN m.reward_type = 'badge' AND m.reward_badge_id IS NOT NULL
      THEN jsonb_build_object('legacy_badge_id', m.reward_badge_id)
    ELSE '{}'::jsonb
  END,
  CASE
    WHEN m.reward_type = 'coupon'
      THEN jsonb_build_object('legacy_reward_value', m.reward_value, 'auto_generate', COALESCE(m.auto_generate_coupon, false))
    ELSE '{}'::jsonb
  END,
  CASE
    WHEN m.reward_type = 'physical'
      THEN jsonb_build_object('reward_name', COALESCE(m.reward_value, 'Ricompensa fisica legacy'))
    ELSE '{}'::jsonb
  END
FROM public.missions m
WHERE m.reward_type <> 'points'
  AND NOT EXISTS (
    SELECT 1 FROM public.mission_rewards mr WHERE mr.mission_id = m.id AND mr.reward_kind = m.reward_type
  );

INSERT INTO public.user_mission_progress (
  user_id,
  mission_id,
  cycle_key,
  current_value,
  target_value,
  completion_count,
  is_completed,
  started_at,
  completed_at,
  last_progress_at,
  state,
  reward_details,
  legacy_user_mission_id
)
SELECT
  um.user_id,
  um.mission_id,
  'legacy',
  um.progress,
  COALESCE(m.target_value, 1),
  CASE WHEN um.completed THEN 1 ELSE 0 END,
  um.completed,
  um.created_at,
  um.completed_at,
  COALESCE(um.completed_at, um.created_at),
  jsonb_build_object('migrated_from', 'user_missions'),
  um.reward_details,
  um.id
FROM public.user_missions um
LEFT JOIN public.missions m ON m.id = um.mission_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_mission_progress ump
  WHERE ump.legacy_user_mission_id = um.id
);

INSERT INTO public.user_mission_history (
  user_id,
  mission_id,
  progress_id,
  event_type,
  delta,
  status,
  details,
  created_at
)
SELECT
  ump.user_id,
  ump.mission_id,
  ump.id,
  CASE WHEN ump.is_completed THEN 'completed' ELSE 'progress_imported' END,
  ump.current_value,
  CASE WHEN ump.is_completed THEN 'success' ELSE 'info' END,
  jsonb_build_object('migrated_from', 'user_missions', 'cycle_key', ump.cycle_key),
  COALESCE(ump.completed_at, ump.created_at)
FROM public.user_mission_progress ump
WHERE ump.legacy_user_mission_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_mission_history umh
    WHERE umh.progress_id = ump.id
      AND umh.event_type IN ('completed', 'progress_imported')
  );
