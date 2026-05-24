-- Secure RLS policies for notas
DROP POLICY IF EXISTS "Public read notas" ON public.notas;
DROP POLICY IF EXISTS "Public insert notas" ON public.notas;
DROP POLICY IF EXISTS "Public update notas" ON public.notas;
DROP POLICY IF EXISTS "Public delete notas" ON public.notas;

CREATE POLICY "Auth read notas" ON public.notas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth insert notas" ON public.notas FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth update notas" ON public.notas FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth delete notas" ON public.notas FOR DELETE USING (auth.role() = 'authenticated');

-- Secure RLS policies for transactions
DROP POLICY IF EXISTS "Public read transactions" ON public.transactions;
DROP POLICY IF EXISTS "Public insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Public update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Public delete transactions" ON public.transactions;

CREATE POLICY "Auth read transactions" ON public.transactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth insert transactions" ON public.transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth update transactions" ON public.transactions FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth delete transactions" ON public.transactions FOR DELETE USING (auth.role() = 'authenticated');

-- Secure RLS policies for companies
DROP POLICY IF EXISTS "Public read companies" ON public.companies;
DROP POLICY IF EXISTS "Public insert companies" ON public.companies;
DROP POLICY IF EXISTS "Public update companies" ON public.companies;
DROP POLICY IF EXISTS "Public delete companies" ON public.companies;

CREATE POLICY "Auth read companies" ON public.companies FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth insert companies" ON public.companies FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth update companies" ON public.companies FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth delete companies" ON public.companies FOR DELETE USING (auth.role() = 'authenticated');

-- Secure RLS policies for banks
DROP POLICY IF EXISTS "Public read banks" ON public.banks;
DROP POLICY IF EXISTS "Public insert banks" ON public.banks;
DROP POLICY IF EXISTS "Public update banks" ON public.banks;
DROP POLICY IF EXISTS "Public delete banks" ON public.banks;

CREATE POLICY "Auth read banks" ON public.banks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth insert banks" ON public.banks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth update banks" ON public.banks FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth delete banks" ON public.banks FOR DELETE USING (auth.role() = 'authenticated');

-- Secure RLS policies for transaction_groups
DROP POLICY IF EXISTS "Public read transaction_groups" ON public.transaction_groups;
DROP POLICY IF EXISTS "Public insert transaction_groups" ON public.transaction_groups;
DROP POLICY IF EXISTS "Public update transaction_groups" ON public.transaction_groups;
DROP POLICY IF EXISTS "Public delete transaction_groups" ON public.transaction_groups;

CREATE POLICY "Auth read transaction_groups" ON public.transaction_groups FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth insert transaction_groups" ON public.transaction_groups FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth update transaction_groups" ON public.transaction_groups FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth delete transaction_groups" ON public.transaction_groups FOR DELETE USING (auth.role() = 'authenticated');

-- Secure RLS policies for divisi
DROP POLICY IF EXISTS "Public read divisi" ON public.divisi;
DROP POLICY IF EXISTS "Public insert divisi" ON public.divisi;
DROP POLICY IF EXISTS "Public update divisi" ON public.divisi;
DROP POLICY IF EXISTS "Public delete divisi" ON public.divisi;

CREATE POLICY "Auth read divisi" ON public.divisi FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth insert divisi" ON public.divisi FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth update divisi" ON public.divisi FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth delete divisi" ON public.divisi FOR DELETE USING (auth.role() = 'authenticated');

-- Storage bucket nota-images should remain readable by public so images render on PDFs or Web easily?
-- Wait, the PDFs are rendered on the frontend and the images are in public URLs. Let's keep reading public, but insert/update/delete authenticated.
DROP POLICY IF EXISTS "Public read nota images" ON storage.objects;
DROP POLICY IF EXISTS "Public upload nota images" ON storage.objects;
DROP POLICY IF EXISTS "Public update nota images" ON storage.objects;
DROP POLICY IF EXISTS "Public delete nota images" ON storage.objects;

CREATE POLICY "Public read nota images" ON storage.objects FOR SELECT USING (bucket_id = 'nota-images');
CREATE POLICY "Auth upload nota images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'nota-images' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update nota images" ON storage.objects FOR UPDATE USING (bucket_id = 'nota-images' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete nota images" ON storage.objects FOR DELETE USING (bucket_id = 'nota-images' AND auth.role() = 'authenticated');
