
ALTER TABLE public.divisi ADD COLUMN IF NOT EXISTS kode_list text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS jatuh_tempo_hari integer NOT NULL DEFAULT 21;
