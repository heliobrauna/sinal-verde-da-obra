import { describe, expect, it } from "vitest";
import { criarToken, validarToken } from "./proposta-token";

const ID = "3f1c2b6a-1d2e-4f3a-9b8c-7d6e5f4a3b2c";
const SEGREDO = "segredo-de-teste";

describe("link público da proposta", () => {
  it("valida o próprio link por 30 dias e expira depois", async () => {
    const agora = Date.UTC(2026, 9, 5);
    const { token, expiraEm } = await criarToken(ID, SEGREDO, agora);
    expect(new Date(expiraEm).getTime() - agora).toBe(30 * 86400 * 1000);
    expect(await validarToken(token, SEGREDO, agora + 29 * 86400 * 1000)).toEqual({ status: "ok", id: ID, expiraEm });
    expect((await validarToken(token, SEGREDO, agora + 31 * 86400 * 1000)).status).toBe("expirado");
  });

  it("recusa link adulterado, de outra chave ou malformado", async () => {
    const { token } = await criarToken(ID, SEGREDO);
    const [id = "", expira, assinatura] = token.split(".");
    // Estender a validade invalida a assinatura.
    expect((await validarToken(`${id}.${Number(expira) + 86400}.${assinatura}`, SEGREDO)).status).toBe("invalido");
    // Trocar a simulação também.
    expect((await validarToken(`${id.replace(/^3/, "4")}.${expira}.${assinatura}`, SEGREDO)).status).toBe("invalido");
    expect((await validarToken(token, "outra-chave")).status).toBe("invalido");
    expect((await validarToken("qualquer-coisa", SEGREDO)).status).toBe("invalido");
  });
});
