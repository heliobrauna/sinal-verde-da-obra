import { HardHat } from 'lucide-react'
export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground"><HardHat className="size-5" /></span>{!compact && <div><p className="font-display text-sm font-bold leading-tight">Sinal Verde</p><p className="text-[11px] text-muted-foreground">DA OBRA</p></div>}</div>
}
