CREATE OR REPLACE FUNCTION public.send_welcome_email_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  perform net.http_post(
    url := 'https://etiynvukviykquqcsjln.supabase.co/functions/v1/send-welcome-email',
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aXludnVrdml5a3F1cWNzamxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NDAxNDMsImV4cCI6MjA4ODQxNjE0M30.IHz7Uu8AN4p9Ufewn1vPo1ECA_LcOrcDVZSPK8vORPI'
    )::jsonb,
    body := jsonb_build_object(
      'recipientEmail', NEW.email,
      'userId', NEW.id::text,
      'firstName', COALESCE(NEW.first_name, ''),
      'lastName', COALESCE(NEW.last_name, '')
    )
  );
  RETURN NEW;
END;
$function$;

-- Create trigger on profiles table (fires after handle_new_user inserts the profile)
DROP TRIGGER IF EXISTS trigger_send_welcome_email ON public.profiles;
CREATE TRIGGER trigger_send_welcome_email
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.send_welcome_email_on_signup();