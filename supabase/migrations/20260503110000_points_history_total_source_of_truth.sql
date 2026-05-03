CREATE OR REPLACE FUNCTION public.recalculate_user_total_points(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
BEGIN
  SELECT COALESCE(SUM(value), 0)::integer
  INTO v_total
  FROM public.points_history
  WHERE user_id = p_user_id;

  UPDATE public.profiles
  SET
    total_points = v_total,
    updated_at = now()
  WHERE id = p_user_id;

  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_points_from_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_user_total_points(OLD.user_id);
    RETURN OLD;
  END IF;

  PERFORM public.recalculate_user_total_points(NEW.user_id);

  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    PERFORM public.recalculate_user_total_points(OLD.user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_points_from_history ON public.points_history;
CREATE TRIGGER trg_sync_profile_points_from_history
AFTER INSERT OR UPDATE OR DELETE ON public.points_history
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_points_from_history();

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
  INSERT INTO public.points_history (user_id, type, value, reference_id, description, admin_id)
  VALUES (p_user_id, p_type, p_value, p_reference_id, p_description, p_admin_id);

  PERFORM public.recalculate_user_total_points(p_user_id);
END;
$$;

UPDATE public.profiles p
SET
  total_points = totals.total_points,
  updated_at = now()
FROM (
  SELECT
    p_inner.id,
    COALESCE(SUM(ph.value), 0)::integer AS total_points
  FROM public.profiles p_inner
  LEFT JOIN public.points_history ph ON ph.user_id = p_inner.id
  GROUP BY p_inner.id
) totals
WHERE p.id = totals.id
  AND p.total_points IS DISTINCT FROM totals.total_points;
