CREATE OR REPLACE FUNCTION public.sync_registration_status_with_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.checked_in = true
    AND NEW.status IN ('registered', 'paid', 'pending_payment', 'no_show') THEN
    NEW.status := 'attended';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_registration_status_with_checkin ON public.event_registrations;

CREATE TRIGGER trigger_sync_registration_status_with_checkin
BEFORE INSERT OR UPDATE OF checked_in
ON public.event_registrations
FOR EACH ROW
EXECUTE FUNCTION public.sync_registration_status_with_checkin();

UPDATE public.event_registrations
SET status = 'attended'
WHERE checked_in = true
  AND status IN ('registered', 'paid', 'pending_payment', 'no_show');
