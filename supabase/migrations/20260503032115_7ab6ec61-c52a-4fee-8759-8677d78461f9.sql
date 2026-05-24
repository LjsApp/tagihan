-- Tambah kolom potongan_lain (array nama+nominal) di transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS potongan_lain jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Tambah kolom group_id untuk menggabungkan transaksi (1 bukti TF u/ banyak transaksi)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS group_id uuid;

-- Tabel kelompok transaksi (menyimpan satu bukti transfer untuk banyak transaksi)
CREATE TABLE IF NOT EXISTS public.transaction_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text,
  bukti_tf_url text,
  tanggal_tf date,
  company_id uuid,
  bank_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read transaction_groups" ON public.transaction_groups FOR SELECT USING (true);
CREATE POLICY "Public insert transaction_groups" ON public.transaction_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update transaction_groups" ON public.transaction_groups FOR UPDATE USING (true);
CREATE POLICY "Public delete transaction_groups" ON public.transaction_groups FOR DELETE USING (true);
