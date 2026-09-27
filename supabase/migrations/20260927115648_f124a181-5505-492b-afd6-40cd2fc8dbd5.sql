ALTER TABLE public.simulacoes DROP CONSTRAINT IF EXISTS simulacoes_cub_valor_m2_check;
ALTER TABLE public.simulacoes ADD CONSTRAINT simulacoes_cub_valor_m2_check CHECK (cub_valor_m2 >= 0);