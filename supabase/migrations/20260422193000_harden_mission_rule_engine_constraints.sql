-- Harden the mission rule engine tables with explicit value constraints.

ALTER TABLE public.mission_campaigns
  DROP CONSTRAINT IF EXISTS mission_campaigns_reward_multiplier_check;

ALTER TABLE public.mission_campaigns
  ADD CONSTRAINT mission_campaigns_reward_multiplier_check
  CHECK (reward_multiplier > 0);

ALTER TABLE public.mission_conditions
  DROP CONSTRAINT IF EXISTS mission_conditions_target_action_check,
  DROP CONSTRAINT IF EXISTS mission_conditions_goal_metric_check,
  DROP CONSTRAINT IF EXISTS mission_conditions_goal_operator_check,
  DROP CONSTRAINT IF EXISTS mission_conditions_unique_by_check,
  DROP CONSTRAINT IF EXISTS mission_conditions_reset_policy_check;

ALTER TABLE public.mission_conditions
  ADD CONSTRAINT mission_conditions_target_action_check
    CHECK (target_action = ANY (ARRAY[
      'event_registration',
      'event_attendance',
      'event_completed_without_cancellation',
      'consecutive_participations',
      'category_participation',
      'first_event_ever',
      'first_event_in_category',
      'membership_purchased',
      'profile_completed',
      'manual_admin_completion',
      'coupon_used',
      'checkin_meeting_point',
      'custom_action'
    ])),
  ADD CONSTRAINT mission_conditions_goal_metric_check
    CHECK (goal_metric = ANY (ARRAY[
      'count',
      'unique_events',
      'unique_categories',
      'unique_organizers',
      'events_in_period',
      'points_accumulated',
      'first_completion',
      'streak'
    ])),
  ADD CONSTRAINT mission_conditions_goal_operator_check
    CHECK (goal_operator = ANY (ARRAY['at_least', 'exactly'])),
  ADD CONSTRAINT mission_conditions_unique_by_check
    CHECK (unique_by = ANY (ARRAY['action', 'event', 'category', 'organizer'])),
  ADD CONSTRAINT mission_conditions_reset_policy_check
    CHECK (reset_policy = ANY (ARRAY['none', 'full_reset', 'decrease_one', 'reset_streak_only', 'ignore_failure']));

ALTER TABLE public.mission_rewards
  DROP CONSTRAINT IF EXISTS mission_rewards_reward_kind_check;

ALTER TABLE public.mission_rewards
  ADD CONSTRAINT mission_rewards_reward_kind_check
  CHECK (reward_kind = ANY (ARRAY['points', 'badge', 'coupon', 'physical']));

ALTER TABLE public.mission_prerequisites
  DROP CONSTRAINT IF EXISTS mission_prerequisites_requirement_type_check;

ALTER TABLE public.mission_prerequisites
  ADD CONSTRAINT mission_prerequisites_requirement_type_check
  CHECK (requirement_type = ANY (ARRAY['completion', 'unlock']));
