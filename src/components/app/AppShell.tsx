import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { BarChart3, Calculator, Gift, LogOut, Settings, ShieldCheck, UserRound, Users, Ruler, Wallet } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Brand } from './Brand'
import { cn } from '@/lib/utils'

const main = [{to:'/dashboard', label:'Simulações', icon:BarChart3},{to:'/pre-analise',label:'Quanto cabe',icon:Wallet},{to:'/simulacao/nova',label:'Nova simulação',icon:Calculator},{to:'/bonus',label:'Bônus',icon:Gift},{to:'/perfil',label:'Perfil',icon:UserRound}] as const
const admin = [{to:'/admin',label:'Visão geral',icon:ShieldCheck},{to:'/admin/usuarios',label:'Usuários',icon:Users},{to:'/admin/cub',label:'CUB regional',icon:Ruler},{to:'/admin/bonus',label:'Materiais',icon:Settings}] as const
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({select:s=>s.location.pathname}); const navigate=useNavigate();
  const [isAdmin,setAdmin]=useState(false)
  useEffect(()=>{ supabase.auth.getUser().then(async({data})=>{if(!data.user)return; const {data:r}=await supabase.from('user_roles').select('role').eq('user_id',data.user.id); setAdmin(Boolean(r?.some(x=>x.role==='admin')))}) },[])
  async function logout(){await supabase.auth.signOut(); navigate({to:'/login',replace:true})}
  const nav=(items:typeof main|typeof admin)=>items.map(item=><Link key={item.to} to={item.to} className={cn('flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',pathname===item.to&&'bg-muted text-foreground')}><item.icon className="size-4"/><span>{item.label}</span></Link>)
  return <div className="min-h-screen bg-background"><aside className="fixed inset-y-0 left-0 z-30 hidden w-64 print:!hidden border-r bg-sidebar p-5 lg:flex lg:flex-col"><Brand/><nav className="mt-10 space-y-1">{nav(main)}</nav>{isAdmin&&<><p className="mb-2 mt-8 px-3 text-[11px] font-semibold uppercase text-secondary">Administração</p><nav className="space-y-1">{nav(admin)}</nav></>}<div className="mt-auto"><Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={logout}><LogOut/>Sair</Button></div></aside><main className="min-h-screen pb-24 lg:ml-64 lg:pb-0 print:ml-0 print:min-h-0 print:pb-0"><header className="print:hidden sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/90 px-5 backdrop-blur lg:px-10"><div className="lg:hidden"><Brand compact/></div><p className="hidden text-sm text-muted-foreground lg:block">Decida com números antes de assinar.</p>{isAdmin&&<span className="rounded-md border border-secondary/30 bg-secondary/10 px-2.5 py-1 text-xs font-semibold text-secondary">Admin</span>}</header><div className="mx-auto max-w-6xl p-5 lg:p-10 print:max-w-none print:p-0">{children}</div></main><nav className="print:hidden fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-sidebar px-2 py-2 lg:hidden">{main.map(item=><Link key={item.to} to={item.to} className={cn('flex min-w-0 flex-col items-center gap-1 py-1 text-[10px] text-muted-foreground',pathname===item.to&&'text-primary')}><item.icon className="size-5"/><span className="truncate">{item.label}</span></Link>)}</nav></div>
}
