DROP POLICY IF EXISTS cub_read_authenticated ON public.cub_referencia;
CREATE POLICY cub_read_active_users ON public.cub_referencia FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo) OR app_private.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS bonus_read_authenticated ON public.bonus_arquivos;
CREATE POLICY bonus_read_active_users ON public.bonus_arquivos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ativo) OR app_private.has_role(auth.uid(), 'admin'::app_role));