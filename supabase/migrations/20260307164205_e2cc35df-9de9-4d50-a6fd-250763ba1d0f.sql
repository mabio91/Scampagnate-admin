
-- Seed 2 equipment templates per category
INSERT INTO public.equipment_templates (id, name, description, category_id) VALUES
-- Trekking & Outdoor
('a0000001-0000-0000-0000-000000000001', 'Trekking Essentials', 'Basic gear for day hikes and trekking', '0c22cf50-75d0-48e6-9c33-38235a3f22be'),
('a0000001-0000-0000-0000-000000000002', 'Mountain Overnight Kit', 'Complete kit for overnight mountain trips', '0c22cf50-75d0-48e6-9c33-38235a3f22be'),
-- Sport & Movimento
('a0000002-0000-0000-0000-000000000001', 'Cycling Basics', 'Essential equipment for cycling events', 'd2b0aeb5-2234-4a76-af91-5114536d9132'),
('a0000002-0000-0000-0000-000000000002', 'Running Gear', 'Equipment for running and jogging events', 'd2b0aeb5-2234-4a76-af91-5114536d9132'),
-- Social & Aperitivi
('a0000003-0000-0000-0000-000000000001', 'Outdoor Picnic Set', 'Items for outdoor social gatherings', '6512aa7e-8850-4696-bebb-1f18500fe777'),
('a0000003-0000-0000-0000-000000000002', 'Evening Event Kit', 'Essentials for evening aperitivo events', '6512aa7e-8850-4696-bebb-1f18500fe777'),
-- Esperienze & Cultura
('a0000004-0000-0000-0000-000000000001', 'Cultural Tour Essentials', 'Basic items for cultural excursions', '756c1cf0-29a4-40b7-a2a0-e5dbd67cb4cd'),
('a0000004-0000-0000-0000-000000000002', 'Workshop Materials', 'Items needed for hands-on workshops', '756c1cf0-29a4-40b7-a2a0-e5dbd67cb4cd'),
-- Eventi Speciali
('a0000005-0000-0000-0000-000000000001', 'Festival Survival Kit', 'Must-haves for special outdoor festivals', 'f82bd870-4eaa-4edc-ae1e-bde23b090fd5'),
('a0000005-0000-0000-0000-000000000002', 'Night Event Pack', 'Gear for special nighttime events', 'f82bd870-4eaa-4edc-ae1e-bde23b090fd5');

-- Seed items for each template
INSERT INTO public.equipment_template_items (template_id, name, is_mandatory, notes, sort_order) VALUES
-- Trekking Essentials
('a0000001-0000-0000-0000-000000000001', 'Trekking boots', true, 'Ankle-high waterproof recommended', 0),
('a0000001-0000-0000-0000-000000000001', 'Backpack (20-30L)', true, NULL, 1),
('a0000001-0000-0000-0000-000000000001', 'Water', true, 'Minimum 2L per person', 2),
('a0000001-0000-0000-0000-000000000001', 'Trekking poles', false, 'Highly recommended for steep terrain', 3),
('a0000001-0000-0000-0000-000000000001', 'Weather-appropriate clothing', true, 'Layered clothing recommended', 4),
('a0000001-0000-0000-0000-000000000001', 'Sunscreen & hat', false, 'SPF 30+ recommended', 5),
-- Mountain Overnight Kit
('a0000001-0000-0000-0000-000000000002', 'Trekking boots', true, 'Waterproof and broken-in', 0),
('a0000001-0000-0000-0000-000000000002', 'Backpack (40-60L)', true, NULL, 1),
('a0000001-0000-0000-0000-000000000002', 'Sleeping bag', true, 'Comfort rating for expected temps', 2),
('a0000001-0000-0000-0000-000000000002', 'Headlamp', true, 'With extra batteries', 3),
('a0000001-0000-0000-0000-000000000002', 'First aid kit', true, NULL, 4),
('a0000001-0000-0000-0000-000000000002', 'Emergency blanket', false, NULL, 5),
-- Cycling Basics
('a0000002-0000-0000-0000-000000000001', 'Bicycle', true, 'Road or mountain depending on event', 0),
('a0000002-0000-0000-0000-000000000001', 'Helmet', true, 'CE certified', 1),
('a0000002-0000-0000-0000-000000000001', 'Water bottle', true, 'Minimum 750ml', 2),
('a0000002-0000-0000-0000-000000000001', 'Repair kit', false, 'Tube, pump, tire levers', 3),
('a0000002-0000-0000-0000-000000000001', 'Cycling gloves', false, NULL, 4),
-- Running Gear
('a0000002-0000-0000-0000-000000000002', 'Running shoes', true, 'Trail or road as appropriate', 0),
('a0000002-0000-0000-0000-000000000002', 'Athletic clothing', true, 'Moisture-wicking fabric', 1),
('a0000002-0000-0000-0000-000000000002', 'Water bottle/hydration pack', true, NULL, 2),
('a0000002-0000-0000-0000-000000000002', 'Sports watch', false, 'GPS recommended', 3),
-- Outdoor Picnic Set
('a0000003-0000-0000-0000-000000000001', 'Picnic blanket', false, NULL, 0),
('a0000003-0000-0000-0000-000000000001', 'Reusable cutlery', false, 'Eco-friendly option', 1),
('a0000003-0000-0000-0000-000000000001', 'Sunscreen', false, NULL, 2),
('a0000003-0000-0000-0000-000000000001', 'Insect repellent', false, NULL, 3),
-- Evening Event Kit
('a0000003-0000-0000-0000-000000000002', 'Light jacket', false, 'For cool evenings', 0),
('a0000003-0000-0000-0000-000000000002', 'Comfortable shoes', true, NULL, 1),
('a0000003-0000-0000-0000-000000000002', 'ID document', true, NULL, 2),
-- Cultural Tour Essentials
('a0000004-0000-0000-0000-000000000001', 'Comfortable walking shoes', true, NULL, 0),
('a0000004-0000-0000-0000-000000000001', 'Water bottle', true, NULL, 1),
('a0000004-0000-0000-0000-000000000001', 'Notebook & pen', false, 'For taking notes', 2),
('a0000004-0000-0000-0000-000000000001', 'Camera', false, NULL, 3),
-- Workshop Materials
('a0000004-0000-0000-0000-000000000002', 'Notebook & pen', true, NULL, 0),
('a0000004-0000-0000-0000-000000000002', 'Apron', false, 'For cooking/craft workshops', 1),
('a0000004-0000-0000-0000-000000000002', 'Comfortable clothing', false, NULL, 2),
-- Festival Survival Kit
('a0000005-0000-0000-0000-000000000001', 'Sunscreen & hat', true, 'SPF 50+', 0),
('a0000005-0000-0000-0000-000000000001', 'Portable chair/mat', false, NULL, 1),
('a0000005-0000-0000-0000-000000000001', 'Water bottle', true, 'Refillable, minimum 1L', 2),
('a0000005-0000-0000-0000-000000000001', 'Rain poncho', false, 'Just in case', 3),
('a0000005-0000-0000-0000-000000000001', 'Power bank', false, 'For phone charging', 4),
-- Night Event Pack
('a0000005-0000-0000-0000-000000000002', 'Warm jacket', true, NULL, 0),
('a0000005-0000-0000-0000-000000000002', 'Flashlight/headlamp', true, NULL, 1),
('a0000005-0000-0000-0000-000000000002', 'Reflective vest', false, 'For safety', 2),
('a0000005-0000-0000-0000-000000000002', 'Comfortable shoes', true, 'Closed-toe recommended', 3);
