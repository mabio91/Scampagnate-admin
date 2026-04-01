
-- Add new columns to missions table
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS starts_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS max_completions_per_user integer DEFAULT NULL;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS notify_on_progress boolean NOT NULL DEFAULT false;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS auto_generate_coupon boolean NOT NULL DEFAULT false;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS category_filter text[] DEFAULT NULL;

-- Add reward_details to user_missions for history tracking
ALTER TABLE public.user_missions ADD COLUMN IF NOT EXISTS reward_details jsonb DEFAULT NULL;
