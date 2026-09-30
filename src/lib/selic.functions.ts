import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Séries do SGS/Banco Central: 432 = meta Selic (% a.a.); 226 = TR (% no período mensal).
const sgsUrl = (serie: number) => `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/1?formato=json`;

async function latest(serie: number) {
  try {
    const response = await fetch(sgsUrl(serie));
    if (!response.ok) throw new Error("Banco Central indisponível");
    const [item] = (await response.json()) as { data: string; valor: string }[];
    const valor = Number(item?.valor);
    if (!item || !Number.isFinite(valor)) throw new Error("Resposta inválida");
    return { valor, data: item.data, oficial: true };
  } catch {
    return { valor: 0, data: "", oficial: false };
  }
}

export const getSelicMeta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(() => latest(432));

export const getTrMensal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(() => latest(226));
