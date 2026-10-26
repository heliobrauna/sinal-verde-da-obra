import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { aplicarTema, lerTema, salvarTema, type Tema } from "@/lib/tema";

const OPCOES: { valor: Tema; rotulo: string; icone: typeof Sun }[] = [
  { valor: "claro", rotulo: "Claro", icone: Sun },
  { valor: "escuro", rotulo: "Escuro", icone: Moon },
  { valor: "auto", rotulo: "Automático", icone: Monitor },
];

export function ThemeToggle() {
  const [tema, setTema] = useState<Tema>("auto");

  useEffect(() => {
    setTema(lerTema());
  }, []);

  // No automático, acompanha a troca de tema do sistema enquanto a página está aberta.
  useEffect(() => {
    if (tema !== "auto") return;
    const consulta = window.matchMedia("(prefers-color-scheme: light)");
    const mudar = () => aplicarTema("auto");
    consulta.addEventListener("change", mudar);
    return () => consulta.removeEventListener("change", mudar);
  }, [tema]);

  const Atual = OPCOES.find((opcao) => opcao.valor === tema)?.icone ?? Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Tema da tela">
          <Atual className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={tema}
          onValueChange={(valor) => {
            const novo = valor as Tema;
            setTema(novo);
            salvarTema(novo);
          }}
        >
          {OPCOES.map(({ valor, rotulo, icone: Icone }) => (
            <DropdownMenuRadioItem key={valor} value={valor}>
              <Icone className="mr-2 size-4" />
              {rotulo}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
