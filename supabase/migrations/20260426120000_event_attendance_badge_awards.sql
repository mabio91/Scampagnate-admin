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
    (badge_entry ->> 'badge_id')::uuid
  FROM public.events e
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.event_badges, '[]'::jsonb)) AS badge_entry
  WHERE e.id = p_event_id
    AND jsonb_typeof(badge_entry) = 'object'
    AND badge_entry ->> 'type' = 'attendance_badge'
    AND COALESCE(badge_entry ->> 'badge_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ON CONFLICT (user_id, badge_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_event_attendance_badge_awards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.checked_in = true OR NEW.status = 'attended' THEN
    PERFORM public.award_event_attendance_badges(NEW.event_id, NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_event_attendance_badge_awards ON public.event_registrations;

CREATE TRIGGER trigger_event_attendance_badge_awards
AFTER INSERT OR UPDATE OF checked_in, status
ON public.event_registrations
FOR EACH ROW
EXECUTE FUNCTION public.handle_event_attendance_badge_awards();
