ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'transactional';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_templates_type_check'
  ) THEN
    ALTER TABLE public.email_templates
      ADD CONSTRAINT email_templates_type_check
      CHECK (type IN ('transactional', 'broadcast'));
  END IF;
END $$;

UPDATE public.email_templates
SET type = 'transactional'
WHERE type IS NULL
   OR template_key LIKE 'welcome_email_%';

INSERT INTO public.email_templates (
  template_key,
  name,
  subject,
  preview_text,
  body_html,
  cta_label,
  cta_url,
  sender_name,
  reply_to,
  is_active,
  type
)
SELECT
  'broadcast_email_default',
  'Broadcast Email - Standard',
  'Novita da Scampagnate per {{user_name}}',
  'Aggiornamenti, suggerimenti eventi e novita dalla community.',
  '<p>Ciao {{first_name}},</p><p>ecco alcune novita selezionate per te.</p><p>{{event_suggestions}}</p><p>Ci vediamo presto!</p>',
  'Scopri gli eventi',
  '/events',
  'Scampagnate',
  '',
  false,
  'broadcast'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.email_templates
  WHERE template_key = 'broadcast_email_default'
);

