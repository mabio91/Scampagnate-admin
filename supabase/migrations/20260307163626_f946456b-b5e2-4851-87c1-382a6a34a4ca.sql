
-- Equipment templates table
CREATE TABLE public.equipment_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category_id uuid REFERENCES public.event_categories(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Equipment template items table
CREATE TABLE public.equipment_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.equipment_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_mandatory boolean NOT NULL DEFAULT false,
  notes text,
  sort_order integer NOT NULL DEFAULT 0
);

-- RLS
ALTER TABLE public.equipment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_template_items ENABLE ROW LEVEL SECURITY;

-- Anyone can view templates
CREATE POLICY "Anyone can view equipment templates" ON public.equipment_templates FOR SELECT USING (true);
CREATE POLICY "Anyone can view equipment template items" ON public.equipment_template_items FOR SELECT USING (true);

-- Admins can manage templates
CREATE POLICY "Admins can manage equipment templates" ON public.equipment_templates FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage equipment template items" ON public.equipment_template_items FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
