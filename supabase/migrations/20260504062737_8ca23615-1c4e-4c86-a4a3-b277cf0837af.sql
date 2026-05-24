CREATE TABLE IF NOT EXISTS public.divisi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.divisi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read divisi" ON public.divisi FOR SELECT USING (true);
CREATE POLICY "Public insert divisi" ON public.divisi FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update divisi" ON public.divisi FOR UPDATE USING (true);
CREATE POLICY "Public delete divisi" ON public.divisi FOR DELETE USING (true);

ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS divisi_id uuid;
ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS divisi_nama text;

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS drive_folder_id text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS drive_folder_name text;
