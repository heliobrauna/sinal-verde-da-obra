import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Meta Selic definida pelo Copom — série 432 do SGS/Banco Central.
const SELIC_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json";

export const getSelicMeta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const response = await fetch(SELIC_URL);
      if (!response.ok) throw new Error("Banco Central indisponível");
      const [item] = (await response.json()) as { data: string; valor: string }[];
      const valor = Number(item?.valor);
      if (!item || !Number.isFinite(valor)) throw new Error("Resposta inválida");
      return { valor, data: item.data, oficial: true };
    } catch {
      return { valor: 0, data: "", oficial: false };
    }
  });
