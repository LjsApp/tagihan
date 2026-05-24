CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL,
  kategori TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read companies" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Public insert companies" ON public.companies FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update companies" ON public.companies FOR UPDATE USING (true);
CREATE POLICY "Public delete companies" ON public.companies FOR DELETE USING (true);

CREATE TABLE public.banks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nama_bank TEXT NOT NULL,
  no_rek TEXT NOT NULL,
  atas_nama TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read banks" ON public.banks FOR SELECT USING (true);
CREATE POLICY "Public insert banks" ON public.banks FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update banks" ON public.banks FOR UPDATE USING (true);
CREATE POLICY "Public delete banks" ON public.banks FOR DELETE USING (true);

ALTER TABLE public.transactions
  ADD COLUMN company_id UUID,
  ADD COLUMN bank_id UUID;