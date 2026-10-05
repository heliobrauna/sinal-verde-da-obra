import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { montarProposta } from "@/lib/proposta";
import { criarToken, validarToken } from "@/lib/proposta-token";

// O link público é assinado com a chave de serviço do servidor. O banco continua fechado por RLS:
// só o servidor lê a simulação e devolve apenas os dados da proposta ao cliente.
function segredo() {
  const chave = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!chave) throw new Error("Configuração do servidor incompleta");
  return chave;
}

export const gerarLinkProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // A leitura com o token do usuário respeita o RLS: só o dono (ou admin) gera o link.
    const { data: simulacao, error } = await context.supabase.from("simulacoes").select("id, objetivo").eq("id", data.id).single();
    if (error || !simulacao) throw new Error("Simulação não encontrada");
    if (simulacao.objetivo === "vender") throw new Error("A proposta ao cliente existe só para construir para morar");
    return criarToken(simulacao.id, segredo());
  });

export const lerPropostaPublica = createServerFn({ method: "GET" })
  .validator((data) => z.object({ token: z.string().max(200) }).parse(data))
  .handler(async ({ data }) => {
    const validacao = await validarToken(data.token, segredo());
    if (validacao.status !== "ok") return { status: validacao.status };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: simulacao } = await supabaseAdmin.from("simulacoes").select("*").eq("id", validacao.id).maybeSingle();
    const proposta = simulacao ? montarProposta(simulacao) : null;
    if (!simulacao || !proposta) return { status: "indisponivel" as const };
    const [{ data: perfil }, { data: conta }] = await Promise.all([
      supabaseAdmin.from("profiles").select("nome").eq("id", simulacao.user_id).maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(simulacao.user_id),
    ]);
    // Contato que o construtor preenche no perfil (metadados da conta); o e-mail não é exposto.
    const meta = conta?.user?.user_metadata ?? {};
    return {
      status: "ok" as const,
      proposta,
      construtor: { nome: perfil?.nome ?? "", telefone: String(meta["telefone"] ?? ""), registro: String(meta["registro"] ?? "") },
      expiraEm: validacao.expiraEm,
    };
  });
