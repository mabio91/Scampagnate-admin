
-- Add new columns to missions table
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT '🎯',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reward_type text NOT NULL DEFAULT 'points',
  ADD COLUMN IF NOT EXISTS reward_value text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_action text NOT NULL DEFAULT 'event_attended',
  ADD COLUMN IF NOT EXISTS streak_count integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reset_on_failure boolean NOT NULL DEFAULT false;

-- Create user_rewards table
CREATE TABLE IF NOT EXISTS public.user_rewards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'points',
  title text NOT NULL DEFAULT '',
  value text DEFAULT NULL,
  status text NOT NULL DEFAULT 'active',
  expiry_date timestamptz DEFAULT NULL,
  redeemed_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on user_rewards
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;

-- Admins can manage all rewards
CREATE POLICY "Admins can manage user rewards"
  ON public.user_rewards FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can view own rewards
CREATE POLICY "Users can view own rewards"
  ON public.user_rewards FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Add new mission types comment for reference
COMMENT ON COLUMN public.missions.type IS 'Mission type: one_time, weekly, monthly, progressive, streak, category';
COMMENT ON COLUMN public.missions.reward_type IS 'Reward type: points, coupon, badge, physical';
COMMENT ON COLUMN public.missions.target_action IS 'Target action: event_attended, event_registered, category_attended, streak';
