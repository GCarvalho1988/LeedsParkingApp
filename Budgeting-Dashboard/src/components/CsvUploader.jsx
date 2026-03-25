import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function CsvUploader({ onSuccess }) {
  const { user } = useAuth()
  const [stage, setStage] = useState('idle')  // idle | preview | conflict | uploading | done | error
  const [preview, setPreview] = useState(null) // { rowCount, period, categories, warnings }
  const [conflict, setConflict] = useState(null)
  const [csvText, setCsvText] = useState('')
  const [filename, setFilename] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef()

  async function handleFile(file) {
    setFilename(file.name)
    const text = await file.text()
    setCsvText(text)

    const { default: Papa } = await import('papaparse')
    const { data } = Papa.parse(text, { header: true, skipEmptyLines: true })
    // CORRECTION: ALL CAPS column names
    const categories = [...new Set(data.map(r => r.CATEGORY).filter(Boolean))]
    const dates = data.map(r => r.DATE).filter(Boolean)
    // CORRECTION: dates are YYYY-MM-DD, slice first 7 chars
    const period = dates[0] ? dates[0].slice(0, 7) : 'unknown'

    setPreview({ rowCount: data.length, period, categories, warnings: [] })
    setStage('preview')
  }

  async function handleConfirm(overwrite = false) {
    setStage('uploading')
    // CORRECTION: get Bearer token for auth
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setErrorMsg('Not authenticated'); setStage('error'); return }

    if (overwrite) {
      await fetch('/.netlify/functions/delete-period', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ period: preview.period }),
      })
    }
    const res = await fetch('/.netlify/functions/ingest-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ csvText, filename, uploadedBy: user.id }),
    })
    const json = await res.json()
    if (res.status === 409) { setConflict(json); setStage('conflict'); return }
    if (!res.ok) { setErrorMsg(json.error || 'Upload failed'); setStage('error'); return }
    setStage('done')
    onSuccess?.()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
        {stage === 'idle' && (
          <>
            <h2 className="text-lg font-semibold mb-4">Upload CSV</h2>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400"
              onClick={() => inputRef.current.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
            >
              <p className="text-gray-500">Drag & drop a LifeStages CSV, or click to browse</p>
            </div>
            <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          </>
        )}

        {stage === 'preview' && preview && (
          <>
            <h2 className="text-lg font-semibold mb-4">Preview: {filename}</h2>
            <dl className="space-y-2 text-sm mb-4">
              <div className="flex justify-between"><dt className="text-gray-500">Period</dt><dd className="font-medium">{preview.period}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Transactions</dt><dd className="font-medium">{preview.rowCount}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Categories</dt><dd className="font-medium">{preview.categories.join(', ')}</dd></div>
            </dl>
            {preview.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-xs text-yellow-800">
                {preview.warnings.length} rows skipped due to formatting issues.
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setStage('idle')} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">Cancel</button>
              <button onClick={() => handleConfirm(false)} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm">Import</button>
            </div>
          </>
        )}

        {stage === 'conflict' && (
          <>
            <h2 className="text-lg font-semibold mb-2">Period already imported</h2>
            <p className="text-sm text-gray-600 mb-4">{conflict?.period} already exists. Overwrite it with this file?</p>
            <div className="flex gap-3">
              <button onClick={() => setStage('idle')} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">Cancel</button>
              <button onClick={() => handleConfirm(true)} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm">Overwrite</button>
            </div>
          </>
        )}

        {stage === 'uploading' && <p className="text-center text-gray-500 py-8">Importing…</p>}
        {stage === 'done' && (
          <>
            <p className="text-center text-green-600 py-4 font-medium">Import complete!</p>
            <button onClick={() => setStage('idle')} className="w-full border border-gray-300 rounded-lg py-2 text-sm">Close</button>
          </>
        )}
        {stage === 'error' && (
          <>
            <p className="text-red-600 mb-4">{errorMsg}</p>
            <button onClick={() => setStage('idle')} className="w-full border border-gray-300 rounded-lg py-2 text-sm">Try again</button>
          </>
        )}
      </div>
    </div>
  )
}
