-- Normalize existing membership IDs and ensure all future assignments are progressive.

CREATE UNIQUE INDEX IF NOT EXISTS profiles_membership_id_unique
ON public.profiles (membership_id)
WHERE membership_id IS NOT NULL;

WITH ordered_members AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      ORDER BY
        membership_registration_date ASC NULLS LAST,
        created_at ASC,
        id ASC
    ) AS new_membership_id
  FROM public.profiles
  WHERE membership_id IS NOT NULL
)
UPDATE public.profiles AS p
SET membership_id = ordered_members.new_membership_id
FROM ordered_members
WHERE p.id = ordered_members.id;

CREATE OR REPLACE FUNCTION public.activate_membership(user_id_param uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_id integer;
  current_membership_id integer;
  v_founding_badge_id uuid;
  v_founding_count integer;
BEGIN
  -- Serialize membership number assignment so concurrent activations cannot reuse the same ID.
  PERFORM pg_advisory_xact_lock(hashtext('public.activate_membership.membership_id'));

  SELECT membership_id INTO current_membership_id
  FROM profiles
  WHERE id = user_id_param;

  IF current_membership_id IS NULL THEN
    SELECT gs
    INTO next_id
    FROM generate_series(
      1,
      COALESCE((SELECT MAX(membership_id) FROM profiles), 0) + 1
    ) AS gs
    WHERE NOT EXISTS (
      SELECT 1
      FROM profiles
      WHERE membership_id = gs
    )
    ORDER BY gs
    LIMIT 1;
  ELSE
    next_id := current_membership_id;
  END IF;

  UPDATE profiles
  SET
    membership_id = next_id,
    membership_status = 'Active',
    membership_registration_date = now(),
    membership_year = extract(year from now())::integer
  WHERE id = user_id_param;

  SELECT id INTO v_founding_badge_id
  FROM badges
  WHERE name = 'Founding Member'
  LIMIT 1;

  IF v_founding_badge_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_founding_count
    FROM user_badges
    WHERE badge_id = v_founding_badge_id;

    IF v_founding_count < 150 THEN
      INSERT INTO user_badges (user_id, badge_id)
      VALUES (user_id_param, v_founding_badge_id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
  END IF;
END;
$function$;
