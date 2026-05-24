-- Notas table
CREATE TABLE public.notas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kode_nota TEXT,
  no_nota TEXT,
  full_no TEXT,
  tanggal DATE,
  nama_customer TEXT,
  total NUMERIC NOT NULL DEFAULT 0,
  diskon_nota JSONB NOT NULL DEFAULT '{"persen":0,"nominal":0}'::jsonb,
  netto NUMERIC NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  file_url TEXT,
  ocr_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactions table
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer TEXT,
  nota_ids UUID[] NOT NULL DEFAULT '{}',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  diskon_manual JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_akhir NUMERIC NOT NULL DEFAULT 0,
  jatuh_tempo DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_created ON public.transactions(created_at DESC);
CREATE INDEX idx_notas_created ON public.notas(created_at DESC);

-- Enable RLS
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Public access policies (internal app, no auth)
CREATE POLICY "Public read notas" ON public.notas FOR SELECT USING (true);
CREATE POLICY "Public insert notas" ON public.notas FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update notas" ON public.notas FOR UPDATE USING (true);
CREATE POLICY "Public delete notas" ON public.notas FOR DELETE USING (true);

CREATE POLICY "Public read transactions" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Public insert transactions" ON public.transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update transactions" ON public.transactions FOR UPDATE USING (true);
CREATE POLICY "Public delete transactions" ON public.transactions FOR DELETE USING (true);

-- Storage bucket for nota images
INSERT INTO storage.buckets (id, name, public) VALUES ('nota-images', 'nota-images', true);

CREATE POLICY "Public read nota images" ON storage.objects FOR SELECT USING (bucket_id = 'nota-images');
CREATE POLICY "Public upload nota images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'nota-images');
CREATE POLICY "Public update nota images" ON storage.objects FOR UPDATE USING (bucket_id = 'nota-images');
CREATE POLICY "Public delete nota images" ON storage.objects FOR DELETE USING (bucket_id = 'nota-images');