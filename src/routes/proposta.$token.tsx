import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
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

// Número no formato do wa.me: só dígitos, com o DDI 55 quando o construtor digitou só DDD + número.
function numeroWhatsApp(telefone: string) {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  return digitos.length >= 12 && digitos.length <= 13 ? digitos : "";
}

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
  const { construtor } = resultado;
  const whatsapp = numeroWhatsApp(construtor.telefone);
  const mensagem = `Olá${construtor.nome ? `, ${construtor.nome.split(" ")[0]}` : ""}! Vi a proposta "${resultado.proposta.nome}" e quero seguir com ela.`;
  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 md:py-10 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-zinc-600">
          {construtor.nome ? <>Proposta preparada por <strong className="text-zinc-900">{construtor.nome}</strong>{construtor.registro ? ` · ${construtor.registro}` : ""}. </> : null}
          Válida até {validade}. Valores estimados: confirme com o banco antes de assinar.
        </p>
        {whatsapp && (
          <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
            <MessageCircle className="size-4" />
            Quero seguir com essa proposta
          </a>
        )}
      </div>
      <PropostaCliente data={resultado.proposta} />
      {whatsapp && (
        <p className="mx-auto mt-4 max-w-4xl text-center text-sm text-zinc-600 print:hidden">
          Ficou com dúvida?{" "}
          <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700 underline">
            Fale com {construtor.nome ? construtor.nome.split(" ")[0] : "o construtor"} pelo WhatsApp
          </a>
        </p>
      )}
    </main>
  );
}
