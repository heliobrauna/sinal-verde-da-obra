CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  nome text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
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
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_select_own_or_admin" ON public.user_roles
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.simulacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome text NOT NULL,
  terreno_valor numeric NOT NULL CHECK (terreno_valor >= 0),
  terreno_situacao text NOT NULL CHECK (terreno_situacao IN ('quitado', 'financiado')),
  saldo_devedor_terreno numeric CHECK (saldo_devedor_terreno IS NULL OR saldo_devedor_terreno >= 0),
  renda_declarada numeric NOT NULL CHECK (renda_declarada >= 0),
  credito_aprovado numeric NOT NULL CHECK (credito_aprovado >= 0),
  estado text NOT NULL CHECK (char_length(estado) = 2),
  padrao_acabamento text NOT NULL CHECK (padrao_acabamento IN ('baixo', 'normal', 'alto')),
  cub_valor_m2 numeric NOT NULL CHECK (cub_valor_m2 > 0),
  bdi_percentual numeric NOT NULL DEFAULT 18 CHECK (bdi_percentual BETWEEN 0 AND 18),
  custos_extras jsonb NOT NULL DEFAULT '[]'::jsonb,
  objetivo text NOT NULL CHECK (objetivo IN ('morar', 'vender')),
  lucro_desejado numeric,
  prazo_venda_meses integer CHECK (prazo_venda_meses IS NULL OR prazo_venda_meses >= 0),
  taxa_juros_obra_mensal numeric NOT NULL DEFAULT 0 CHECK (taxa_juros_obra_mensal >= 0),
  resultado jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulacoes TO authenticated;
GRANT ALL ON public.simulacoes TO service_role;
ALTER TABLE public.simulacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "simulacoes_select_own_or_admin" ON public.simulacoes FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "simulacoes_insert_own" ON public.simulacoes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "simulacoes_update_own_or_admin" ON public.simulacoes FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "simulacoes_delete_own_or_admin" ON public.simulacoes FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.cub_referencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estado text NOT NULL CHECK (char_length(estado) = 2),
  padrao_acabamento text NOT NULL CHECK (padrao_acabamento IN ('baixo', 'normal', 'alto')),
  mes_referencia date NOT NULL,
  valor_m2 numeric NOT NULL CHECK (valor_m2 > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (estado, padrao_acabamento, mes_referencia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cub_referencia TO authenticated;
GRANT ALL ON public.cub_referencia TO service_role;
ALTER TABLE public.cub_referencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cub_read_authenticated" ON public.cub_referencia FOR SELECT TO authenticated USING (true);
CREATE POLICY "cub_admin_insert" ON public.cub_referencia FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cub_admin_update" ON public.cub_referencia FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cub_admin_delete" ON public.cub_referencia FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.bonus_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  arquivo_url text NOT NULL DEFAULT '',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bonus_arquivos TO authenticated;
GRANT ALL ON public.bonus_arquivos TO service_role;
ALTER TABLE public.bonus_arquivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bonus_read_authenticated" ON public.bonus_arquivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "bonus_admin_insert" ON public.bonus_arquivos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "bonus_admin_update" ON public.bonus_arquivos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "bonus_admin_delete" ON public.bonus_arquivos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER simulacoes_updated_at BEFORE UPDATE ON public.simulacoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER cub_updated_at BEFORE UPDATE ON public.cub_referencia FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER bonus_updated_at BEFORE UPDATE ON public.bonus_arquivos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE first_role public.app_role;
BEGIN
  PERFORM pg_advisory_xact_lock(70240924);
  first_role := CASE WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN 'user'::public.app_role ELSE 'admin'::public.app_role END;
  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, COALESCE(NEW.email, ''), COALESCE(NEW.raw_user_meta_data->>'nome', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, first_role);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE INDEX simulacoes_user_created_idx ON public.simulacoes(user_id, created_at DESC);
CREATE INDEX cub_lookup_idx ON public.cub_referencia(estado, padrao_acabamento, mes_referencia DESC);
CREATE INDEX user_roles_user_idx ON public.user_roles(user_id);

INSERT INTO public.bonus_arquivos (nome, descricao, ordem) VALUES
('Kit de Contratos de Proteção da Obra', 'Modelos essenciais para formalizar responsabilidades e proteger sua construção.', 1),
('Checklist de Vistoria por Etapa da Obra', 'Lista prática para conferir cada fase antes de aprovar a próxima liberação.', 2),
('Planilha de Composição de Renda para Autônomos e MEIs', 'Material de apoio para organizar comprovantes e apresentar sua renda.', 3);