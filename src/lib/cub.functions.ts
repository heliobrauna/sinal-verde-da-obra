import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sindusconByState: Record<string, string> = {
  AC: "4",
  AM: "5",
  BA: "6",
  CE: "7",
  DF: "8",
  ES: "9",
  GO: "10",
  MA: "11",
  MG: "1",
  MT: "13",
  PA: "14",
  PB: "15",
  PE: "16",
  PI: "17",
  PR: "18",
  RJ: "20",
  RN: "21",
  RO: "25",
  RR: "30",
  SC: "26",
  SE: "22",
};
const patternIndex = { baixo: 0, normal: 1, alto: 2 } as const;
const projectName = { baixo: "R1-B", normal: "R1-N", alto: "R1-A" } as const;

function brNumber(value: string) {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

async function fetchOfficialCub(estado: string, padrao: keyof typeof patternIndex) {
  const sinduscon = sindusconByState[estado];
  if (!sinduscon) throw new Error("UF indisponível na fonte nacional");
  const url = `http://www.cub.org.br/cub-m2-estadual/${estado}/`;
  const page = await fetch(url);
  if (!page.ok) throw new Error("Fonte oficial indisponível");
  const html = await page.text();
  const token = html.match(/name=['"]csrfmiddlewaretoken['"] value=['"]([^'"]+)/)?.[1];
  const cookie = page.headers.get("set-cookie")?.match(/csrftoken=([^;]+)/)?.[1];
  if (!token || !cookie) throw new Error("Não foi possível iniciar a consulta");
  const now = new Date();
  let pdf: Response | null = null;
  for (let offset = 0; offset < 18; offset += 1) {
    const requested = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const body = new URLSearchParams({
      csrfmiddlewaretoken: token,
      uf: estado,
      sinduscon,
      relatorio: "tabela-cub-m2",
      ano: String(requested.getUTCFullYear()),
      mes: String(requested.getUTCMonth() + 1),
      desoneracao: "sem-desoneracao",
      variacao: "sem-variacao",
      cimento: "1",
      projeto: "1",
    });
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Cookie: `csrftoken=${cookie}`,
        Referer: url,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (response.ok && response.headers.get("content-type")?.includes("pdf")) {
      pdf = response;
      break;
    }
  }
  if (!pdf) throw new Error("A fonte não retornou uma tabela recente");
  const { extractText } = await import("unpdf");
  const result = await extractText(new Uint8Array(await pdf.arrayBuffer()), { mergePages: true });
  const text = String(result.text);
  const values = text.match(/R-1\s+([\d.]+,\d{2})\s+R-1\s+([\d.]+,\d{2})\s+R-1\s+([\d.]+,\d{2})/);
  const reference = text.match(/-\s+([A-Za-zÀ-ÿ]+\/\d{4})/)?.[1];
  if (!values) throw new Error("Tabela oficial em formato inesperado");
  return {
    valor: brNumber(values[patternIndex[padrao] + 1] ?? ""),
    competencia: reference ?? "competência não informada",
    projeto: projectName[padrao],
    origem: "CBIC / Sinduscon",
    fonte: url,
    oficial: true,
  };
}

export const getResidentialCub = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({ estado: z.string().length(2), padrao: z.enum(["baixo", "normal", "alto"]) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    try {
      return await fetchOfficialCub(data.estado, data.padrao);
    } catch {
      const { data: fallback, error } = await context.supabase
        .from("cub_referencia")
        .select("valor_m2,mes_referencia")
        .eq("estado", data.estado)
        .eq("padrao_acabamento", data.padrao)
        .order("mes_referencia", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !fallback)
        return {
          valor: 0,
          competencia: "não disponível",
          projeto: projectName[data.padrao],
          origem: "Sem referência disponível",
          fonte: "http://www.cub.org.br/cub-m2-estadual/",
          oficial: false,
        };
      return {
        valor: Number(fallback.valor_m2),
        competencia: new Date(`${fallback.mes_referencia}T12:00:00`).toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
        }),
        projeto: projectName[data.padrao],
        origem: "Última referência cadastrada",
        fonte: "http://www.cub.org.br/cub-m2-estadual/",
        oficial: false,
      };
    }
  });
