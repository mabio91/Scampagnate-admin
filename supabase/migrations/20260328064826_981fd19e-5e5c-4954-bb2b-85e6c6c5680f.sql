
-- Email templates table for admin-managed email content
CREATE TABLE email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text UNIQUE NOT NULL,
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  preview_text text DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  cta_label text DEFAULT '',
  cta_url text DEFAULT '',
  sender_name text DEFAULT 'Scampagnate',
  reply_to text DEFAULT '',
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Email send log for tracking
CREATE TABLE email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_type text NOT NULL,
  template_id uuid REFERENCES email_templates(id),
  recipient_email text NOT NULL,
  status text DEFAULT 'pending',
  provider_response text,
  retry_count int DEFAULT 0,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email templates" ON email_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view email send log" ON email_send_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert email send log" ON email_send_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert two default welcome email templates
INSERT INTO email_templates (template_key, name, subject, preview_text, body_html, cta_label, cta_url, sender_name, reply_to, is_active) VALUES
(
  'welcome_email_1',
  'Welcome Email - Standard',
  'Benvenuto in Scampagnate 🌿',
  'Il tuo account è stato creato con successo. Ora puoi iniziare a scoprire gli eventi.',
  '<p>Ciao {{first_name}},</p><p>benvenuto in <strong>Scampagnate</strong>!</p><p>Il tuo profilo è stato creato correttamente e ora puoi iniziare a scoprire eventi, attività e nuove esperienze insieme alla community.</p><p>Ci vediamo presto,<br/>Team Scampagnate</p>',
  'Scopri gli eventi',
  '/events',
  'Scampagnate',
  '',
  true
),
(
  'welcome_email_2',
  'Welcome Email - Friendly',
  'Ciao! Benvenuto nella community 🌿',
  'Sei dei nostri! Scopri le prossime avventure.',
  '<p>Ciao {{first_name}},</p><p>che bello averti con noi! 🎉</p><p>Da oggi fai parte della community di <strong>Scampagnate</strong>. Esplora gli eventi in programma, trova quelli che fanno per te e unisciti alle nostre avventure.</p><p>Se hai domande, non esitare a contattarci.</p><p>A presto!<br/>Team Scampagnate</p>',
  'Esplora le avventure',
  '/events',
  'Scampagnate',
  '',
  false
);
