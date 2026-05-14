-- Special event badges are linked on events.event_badges as entries like:
-- { "type": "attendance_badge", "badge_id": "<uuid>" }
-- They are awarded only when a registration is checked in or marked attended.

WITH ranked_user_badges AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, badge_id
      ORDER BY earned_at ASC, id::text ASC
    ) AS row_rank
  FROM public.user_badges
)
DELETE FROM public.user_badges ub
USING ranked_user_badges ranked
WHERE ub.id = ranked.id
  AND ranked.row_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS user_badges_user_id_badge_id_key
ON public.user_badges (user_id, badge_id);

CREATE OR REPLACE FUNCTION public.award_event_attendance_badges(
  p_event_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT DISTINCT
    p_user_id,
    b.id
  FROM public.events e
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.event_badges, '[]'::jsonb)) AS badge_entry
  CROSS JOIN LATERAL (
    SELECT (badge_entry ->> 'badge_id')::uuid AS badge_id
    WHERE jsonb_typeof(badge_entry) = 'object'
      AND badge_entry ->> 'type' = 'attendance_badge'
      AND COALESCE(badge_entry ->> 'badge_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) event_badge
  JOIN public.badges b
    ON b.id = event_badge.badge_id
   AND b.category = 'special'
  WHERE e.id = p_event_id
  ON CONFLICT (user_id, badge_id) DO NOTHING;
END;
$$;
