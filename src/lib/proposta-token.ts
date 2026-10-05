// Token do link público da proposta: "<id da simulação>.<expira em, segundos>.<assinatura HMAC-SHA256>".
// Sem a chave do servidor não dá para forjar o link nem estender a validade.
export const VALIDADE_LINK_DIAS = 30;

function base64url(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function assinar(conteudo: string, segredo: string) {
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(`proposta-publica:${segredo}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(conteudo)));
}

// Comparação em tempo constante, para a assinatura não vazar pelo tempo de resposta.
function iguais(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i += 1) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function criarToken(id: string, segredo: string, agora = Date.now()) {
  const expira = Math.floor(agora / 1000) + VALIDADE_LINK_DIAS * 86400;
  const conteudo = `${id}.${expira}`;
  return { token: `${conteudo}.${await assinar(conteudo, segredo)}`, expiraEm: new Date(expira * 1000).toISOString() };
}

export async function validarToken(token: string, segredo: string, agora = Date.now()) {
  const [id, expiraTexto, assinatura, ...resto] = token.split(".");
  const expira = Number(expiraTexto);
  if (resto.length > 0 || !id || !assinatura || !UUID.test(id) || !Number.isInteger(expira)) return { status: "invalido" as const };
  if (!iguais(assinatura, await assinar(`${id}.${expiraTexto}`, segredo))) return { status: "invalido" as const };
  if (expira * 1000 < agora) return { status: "expirado" as const };
  return { status: "ok" as const, id, expiraEm: new Date(expira * 1000).toISOString() };
}
