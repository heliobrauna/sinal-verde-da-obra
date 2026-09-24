CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;
REVOKE ALL ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY "profiles_update_own_or_admin" ON public.profiles;
DROP POLICY "roles_select_own_or_admin" ON public.user_roles;
DROP POLICY "simulacoes_select_own_or_admin" ON public.simulacoes;
DROP POLICY "simulacoes_update_own_or_admin" ON public.simulacoes;
DROP POLICY "simulacoes_delete_own_or_admin" ON public.simulacoes;
DROP POLICY "cub_admin_insert" ON public.cub_referencia;
DROP POLICY "cub_admin_update" ON public.cub_referencia;
DROP POLICY "cub_admin_delete" ON public.cub_referencia;
DROP POLICY "bonus_admin_insert" ON public.bonus_arquivos;
DROP POLICY "bonus_admin_update" ON public.bonus_arquivos;
DROP POLICY "bonus_admin_delete" ON public.bonus_arquivos;

CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR app_private.has_role(auth.uid(), 'admin')) WITH CHECK (id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "simulacoes_select_own_or_admin" ON public.simulacoes FOR SELECT TO authenticated USING (user_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "simulacoes_update_own_or_admin" ON public.simulacoes FOR UPDATE TO authenticated USING (user_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin')) WITH CHECK (user_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "simulacoes_delete_own_or_admin" ON public.simulacoes FOR DELETE TO authenticated USING (user_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "cub_admin_insert" ON public.cub_referencia FOR INSERT TO authenticated WITH CHECK (app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "cub_admin_update" ON public.cub_referencia FOR UPDATE TO authenticated USING (app_private.has_role(auth.uid(), 'admin')) WITH CHECK (app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "cub_admin_delete" ON public.cub_referencia FOR DELETE TO authenticated USING (app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "bonus_admin_insert" ON public.bonus_arquivos FOR INSERT TO authenticated WITH CHECK (app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "bonus_admin_update" ON public.bonus_arquivos FOR UPDATE TO authenticated USING (app_private.has_role(auth.uid(), 'admin')) WITH CHECK (app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY "bonus_admin_delete" ON public.bonus_arquivos FOR DELETE TO authenticated USING (app_private.has_role(auth.uid(), 'admin'));

DROP FUNCTION public.has_role(uuid, public.app_role);
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;