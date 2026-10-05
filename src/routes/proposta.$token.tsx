import { createFileRoute } from "@tanstack/react-router";
import { PropostaCliente } from "@/components/app/PropostaCliente";
import { lerPropostaPublica } from "@/lib/proposta.functions";

// Página aberta pelo cliente a partir do link enviado pelo construtor: sem login, só a proposta.
export const Route = createFileRoute("/proposta/$token")({
  head: () => ({
    meta: [
      { title: "Proposta da sua casa | Sinal Verde da Obra" },
      { name: "description", content: "Quanto custa, quem paga cada parte e a prestação da sua casa." },
      { property: "og:title", content: "Proposta da sua casa" },
      { property: "og:description", content: "Quanto custa, quem paga cada parte e a prestação da sua casa." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: ({ params }) => lerPropostaPublica({ data: { token: params.token } }),
  component: PropostaPublica,
});

const MENSAGENS = {
  expirado: "Este link de proposta expirou. Peça ao seu construtor um link atualizado.",
  invalido: "Este link de proposta não é válido. Confira se ele foi copiado por inteiro.",
  indisponivel: "Esta proposta não está mais disponível. Fale com o seu construtor.",
} as const;

function PropostaPublica() {
  const resultado = Route.useLoaderData();
  if (resultado.status !== "ok") {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-50 p-6">
        <p className="max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-center text-zinc-700">{MENSAGENS[resultado.status]}</p>
      </main>
    );
  }
  const validade = new Date(resultado.expiraEm).toLocaleDateString("pt-BR");
  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 md:py-10 print:bg-white print:p-0">
      <p className="mx-auto mb-4 max-w-4xl text-sm text-zinc-600 print:hidden">
        {resultado.construtor ? <>Proposta preparada por <strong className="text-zinc-900">{resultado.construtor}</strong>. </> : null}
        Válida até {validade}. Valores estimados: confirme com o banco antes de assinar.
      </p>
      <PropostaCliente data={resultado.proposta} />
    </main>
  );
}
