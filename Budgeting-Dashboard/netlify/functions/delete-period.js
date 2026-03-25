import { createClient } from '@supabase/supabase-js'

export const handler = async (event) => {
  if (event.httpMethod !== 'DELETE') return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) }

  // Validate caller is an authenticated admin
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorized' }) }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorized' }) }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { statusCode: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Forbidden — admin only' }) }

  let parsed_body
  try { parsed_body = JSON.parse(event.body) }
  catch (e) { return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid JSON body' }) } }

  const { period } = parsed_body

  const { error } = await supabase.from('uploads').delete().eq('period', period)
  if (error) return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) }

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deleted: period }) }
}
