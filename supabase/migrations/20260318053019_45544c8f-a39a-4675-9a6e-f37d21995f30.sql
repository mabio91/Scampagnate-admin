
-- Insert the Founding Member badge
INSERT INTO public.badges (name, description, icon, category, required_events)
VALUES ('Founding Member', 'One of the first 150 members to join the community', '🏛️', 'special', 0)
ON CONFLICT DO NOTHING;

-- Update activate_membership to auto-assign Founding Member badge to first 150
CREATE OR REPLACE FUNCTION public.activate_membership(user_id_param uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_id integer;
  max_attempts integer := 100;
  attempt integer := 0;
  current_membership_id integer;
  v_founding_badge_id uuid;
  v_founding_count integer;
BEGIN
  -- Check if user already has a membership_id (renewal vs first time)
  SELECT membership_id INTO current_membership_id
  FROM profiles WHERE id = user_id_param;

  -- Only generate a new ID if the user never had one
  IF current_membership_id IS NULL THEN
    LOOP
      attempt := attempt + 1;
      next_id := floor(random() * 999000 + 1000)::integer;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE membership_id = next_id);
      IF attempt >= max_attempts THEN
        RAISE EXCEPTION 'Could not generate unique membership ID after % attempts', max_attempts;
      END IF;
    END LOOP;
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

  -- Auto-assign Founding Member badge to first 150 members
  SELECT id INTO v_founding_badge_id FROM badges WHERE name = 'Founding Member' LIMIT 1;
  
  IF v_founding_badge_id IS NOT NULL THEN
    -- Count how many users already have the Founding Member badge
    SELECT COUNT(*) INTO v_founding_count FROM user_badges WHERE badge_id = v_founding_badge_id;
    
    -- If under 150 and user doesn't already have it, award it
    IF v_founding_count < 150 THEN
      INSERT INTO user_badges (user_id, badge_id)
      VALUES (user_id_param, v_founding_badge_id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
  END IF;
END;
$function$;
