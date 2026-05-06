CREATE OR REPLACE FUNCTION public.admin_assign_badge(
  p_user_id uuid,
  p_badge_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_badge_name text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can assign badges manually'
      USING ERRCODE = '42501';
  END IF;

  SELECT name INTO v_badge_name
  FROM public.badges
  WHERE id = p_badge_id;

  IF v_badge_name IS NULL THEN
    RAISE EXCEPTION 'Badge not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_badges
    WHERE user_id = p_user_id
      AND badge_id = p_badge_id
  ) THEN
    RAISE EXCEPTION 'Questo utente ha gia questo badge'
      USING ERRCODE = '23505';
  END IF;

  IF v_badge_name = 'Founding Member' THEN
    PERFORM set_config('app.allow_founding_badge_assignment', 'true', true);
  END IF;

  INSERT INTO public.user_badges (user_id, badge_id)
  VALUES (p_user_id, p_badge_id);

  IF v_badge_name = 'Founding Member' THEN
    UPDATE public.profiles
    SET
      is_founding_member = true,
      updated_at = now()
    WHERE id = p_user_id;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_assign_badge(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_assign_badge(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_badge(uuid, uuid) TO authenticated;
