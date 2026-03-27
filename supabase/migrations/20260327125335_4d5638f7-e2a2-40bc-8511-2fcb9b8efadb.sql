
CREATE TABLE public.trekking_difficulty_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_number integer NOT NULL UNIQUE,
  label text NOT NULL,
  icon text NOT NULL DEFAULT '',
  color_primary text NOT NULL DEFAULT '#000000',
  color_background text NOT NULL DEFAULT '#F0F0F0',
  color_border text NOT NULL DEFAULT '#CCCCCC',
  color_icon text NOT NULL DEFAULT '#000000',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trekking_difficulty_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage trekking difficulty levels"
  ON public.trekking_difficulty_levels FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view trekking difficulty levels"
  ON public.trekking_difficulty_levels FOR SELECT TO public
  USING (true);

INSERT INTO public.trekking_difficulty_levels (level_number, label, icon, color_primary, color_background, color_border, color_icon) VALUES
  (1, 'Introduzione', '🌱', '#6FAF7A', '#EAF6EC', '#CFE6D3', '#6FAF7A'),
  (2, 'Esploratore', '🥾', '#B08944', '#F7F0E3', '#E6D7BB', '#B08944'),
  (3, 'Escursionista', '⛰️', '#5B8DBE', '#E8F1F8', '#C8DBE8', '#5B8DBE'),
  (4, 'Intrepido', '💪', '#C46B3F', '#FAEAE3', '#EDD0C2', '#C46B3F'),
  (5, 'Avanzato', '🔥', '#C44040', '#FAE3E3', '#EDC2C2', '#C44040');
