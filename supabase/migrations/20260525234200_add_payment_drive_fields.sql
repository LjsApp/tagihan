-- Add new columns to transactions
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS metode_tf text,
ADD COLUMN IF NOT EXISTS catatan_tf text,
ADD COLUMN IF NOT EXISTS drive_file_id text;

-- Add new columns to transaction_groups
ALTER TABLE public.transaction_groups
ADD COLUMN IF NOT EXISTS metode_tf text,
ADD COLUMN IF NOT EXISTS catatan_tf text,
ADD COLUMN IF NOT EXISTS drive_file_id text;
