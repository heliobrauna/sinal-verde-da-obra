import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

async function ensureAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.from('user_roles').select('role').eq('user_id', context.userId)
  if (error || !data?.some((row: { role: string }) => row.role === 'admin')) throw new Error('Acesso negado')
}

export const updateUserAccess = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ userId: z.string().uuid(), role: z.enum(['admin','user']).optional(), ativo: z.boolean().optional() }).parse(data))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context)
    if (data.userId === context.userId && (data.role === 'user' || data.ativo === false)) throw new Error('Você não pode remover o próprio acesso administrativo.')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    if (data.role) {
      const { error: removeError } = await supabaseAdmin.from('user_roles').delete().eq('user_id', data.userId)
      if (removeError) throw removeError
      const { error: roleError } = await supabaseAdmin.from('user_roles').insert({ user_id: data.userId, role: data.role })
      if (roleError) throw roleError
    }
    if (data.ativo !== undefined) {
      const { error } = await supabaseAdmin.from('profiles').update({ ativo: data.ativo }).eq('id', data.userId)
      if (error) throw error
    }
    return { ok: true }
  })

export const deleteUser = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context)
    if (data.userId === context.userId) throw new Error('Você não pode excluir a própria conta administrativa.')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId)
    if (error) throw error
    return { ok: true }
  })
