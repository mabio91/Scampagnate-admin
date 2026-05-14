
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage platform settings"
ON public.platform_settings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view platform settings"
ON public.platform_settings FOR SELECT TO public
USING (true);

INSERT INTO public.platform_settings (key, value, label, description)
VALUES 
  ('membership_fee', '10', 'Quota associativa (€)', 'Importo della quota associativa ASD annuale'),
  ('founding_member_limit', '150', 'Limite Founding Member', 'Numero massimo di founding member ammessi');
