// scripts/remigrate-transactions.js
//
// Re-ingests all stored CSVs using the updated parseRow logic:
//   CSV negative → DB positive (expense)
//   CSV positive → DB negative (credit)
//
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/remigrate-transactions.js
//
import Papa from 'papaparse'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { parseRow } from '../netlify/functions/ingest-csv.js'

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: uploads, error: uploadsErr } = await supabase
    .from('uploads')
    .select('id, period, filename')
    .order('period')

  if (uploadsErr) throw uploadsErr
  console.log(`Found ${uploads.length} uploads to re-process\n`)

  let totalInserted = 0
  let totalFailed   = 0

  for (const { id: uploadId, period, filename } of uploads) {
    process.stdout.write(`${period} (${filename}) … `)

    // Download original CSV from storage
    const { data: blob, error: dlErr } = await supabase.storage
      .from('csv-uploads')
      .download(`${period}/${filename}`)

    if (dlErr) {
      console.log(`SKIP — download failed: ${dlErr.message}`)
      totalFailed++
      continue
    }

    const csvText = await blob.text()
    const { data: rawRows, errors: parseErrors } = Papa.parse(csvText, { header: true, skipEmptyLines: true })

    if (parseErrors.length) {
      console.log(`SKIP — CSV parse error: ${parseErrors[0].message}`)
      totalFailed++
      continue
    }

    const rows     = []
    const warnings = []
    for (const row of rawRows) {
      try { rows.push(parseRow(row)) }
      catch (e) { warnings.push(e.message) }
    }

    if (rows.length === 0) {
      console.log(`SKIP — no valid rows`)
      totalFailed++
      continue
    }

    // Delete existing transactions for this upload and re-insert
    const { error: delErr } = await supabase
      .from('transactions')
      .delete()
      .eq('upload_id', uploadId)

    if (delErr) {
      console.log(`FAIL — delete error: ${delErr.message}`)
      totalFailed++
      continue
    }

    const txRows = rows.map(t => ({ ...t, upload_id: uploadId }))
    const { error: insErr } = await supabase.from('transactions').insert(txRows)

    if (insErr) {
      console.log(`FAIL — insert error: ${insErr.message}`)
      totalFailed++
      continue
    }

    console.log(`✓ ${txRows.length} rows${warnings.length ? ` (${warnings.length} zero-amount skipped)` : ''}`)
    totalInserted += txRows.length
  }

  console.log(`\nDone. ${totalInserted} rows inserted across ${uploads.length - totalFailed} periods.`)
  if (totalFailed > 0) console.log(`${totalFailed} periods failed — check output above.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error(err); process.exit(1) })
}
