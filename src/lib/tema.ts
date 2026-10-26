// Tema do app: claro, escuro ou automático (segue o sistema). A escolha fica no navegador e é aplicada
// como data-theme="light" | "dark" no <html>; o CSS troca as cores pelo atributo.
export type Tema = "claro" | "escuro" | "auto";

export const CHAVE_TEMA = "sinal-verde:tema";

export function lerTema(): Tema {
  try {
    const salvo = localStorage.getItem(CHAVE_TEMA);
    return salvo === "claro" || salvo === "escuro" ? salvo : "auto";
  } catch {
    return "auto";
  }
}

export function aplicarTema(tema: Tema) {
  const claro = tema === "claro" || (tema === "auto" && window.matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.dataset["theme"] = claro ? "light" : "dark";
}

export function salvarTema(tema: Tema) {
  try {
    localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    // Sem acesso ao armazenamento (aba anônima bloqueada): vale só nesta visita.
  }
  aplicarTema(tema);
}

// Roda no <head>, antes da página aparecer, para não "piscar" no tema errado.
export const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem("${CHAVE_TEMA}");var c=t==="claro"||(t!=="escuro"&&window.matchMedia("(prefers-color-scheme: light)").matches);document.documentElement.dataset.theme=c?"light":"dark"}catch(e){}})();`;
