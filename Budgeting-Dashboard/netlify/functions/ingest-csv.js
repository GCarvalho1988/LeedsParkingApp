import Papa from 'papaparse'
import { createClient } from '@supabase/supabase-js'

// --- Pure parsing helpers (exported for testing) ---

export function parseRow(row) {
  const DATE_COL = 'DATE'
  const DESC_COL = 'DESCRIPTION'
  const AMOUNT_COL = 'AMOUNT'
  const CAT_COL = 'CATEGORY'

  if (!row[DATE_COL] || !row[DESC_COL] || row[AMOUNT_COL] === undefined || !row[CAT_COL]) {
    throw new Error(`Missing required column in row: ${JSON.stringify(row)}`)
  }

  const amount = parseFloat(String(row[AMOUNT_COL]).replace(/[^0-9.-]/g, ''))
  if (isNaN(amount)) throw new Error(`Invalid amount in row: ${JSON.stringify(row)}`)

  // Only import expenditure (negative amounts)
  if (amount > 0) throw new Error(`Skipping income/refund row (amount > 0): ${JSON.stringify(row)}`)
  if (amount === 0) throw new Error(`Skipping zero-amount row: ${JSON.stringify(row)}`)

  return {
    date: row[DATE_COL].trim(),       // Already YYYY-MM-DD
    description: row[DESC_COL].trim(),
    amount: Math.abs(amount),
    category: row[CAT_COL].trim(),
  }
}

export function detectPeriod(rows) {
  const months = new Set(rows.map(r => r.date.slice(0, 7)))
  if (months.size !== 1) throw new Error(`CSV spans multiple months: ${[...months].join(', ')}`)
  return [...months][0]
}

// --- Netlify Function handler ---

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) }

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

  const { csvText, filename, uploadedBy } = parsed_body

  const { data: rawRows, errors } = Papa.parse(csvText, { header: true, skipEmptyLines: true })
  if (errors.length) return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'CSV parse error', details: errors }) }

  const parsed = []
  const warnings = []
  for (const row of rawRows) {
    try { parsed.push(parseRow(row)) }
    catch (e) { warnings.push(e.message) }
  }

  if (parsed.length === 0) return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'No valid rows found', warnings }) }

  let period
  try { period = detectPeriod(parsed) }
  catch (e) { return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) } }

  const { data: existing } = await supabase.from('uploads').select('id').eq('period', period).single()
  if (existing) return { statusCode: 409, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conflict: true, period }) }

  const { error: storageErr } = await supabase.storage
    .from('csv-uploads')
    .upload(`${period}/${filename}`, csvText, { contentType: 'text/csv', upsert: true })
  if (storageErr) return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Storage upload failed' }) }

  const { data: upload, error: uploadErr } = await supabase.from('uploads').insert({
    filename, period, uploaded_by: uploadedBy, row_count: parsed.length
  }).select().single()
  if (uploadErr) return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: uploadErr.message }) }

  const txRows = parsed.map(t => ({ ...t, upload_id: upload.id }))
  const { error: txErr } = await supabase.from('transactions').insert(txRows)
  if (txErr) return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: txErr.message }) }

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period, rowCount: parsed.length, warnings }) }
}
