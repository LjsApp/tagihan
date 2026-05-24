ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS bukti_tf_url text,
  ADD COLUMN IF NOT EXISTS tanggal_tf date;