-- Menambahkan index pada kolom yang sering digunakan untuk filter dan join
CREATE INDEX IF NOT EXISTS idx_transactions_group_id ON public.transactions(group_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
