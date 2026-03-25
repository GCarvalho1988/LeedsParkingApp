import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function FlagButton({ transactionId, existingFlags = [] }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [flags, setFlags] = useState(existingFlags)
  const [saving, setSaving] = useState(false)

  async function submitFlag() {
    if (!comment.trim()) return
    setSaving(true)
    const { data } = await supabase.from('flags').insert({
      transaction_id: transactionId,
      user_id: user.id,
      comment: comment.trim(),
    }).select().single()
    if (data) setFlags(f => [...f, { ...data, user_id: user.id }])
    setComment('')
    setSaving(false)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${flags.length > 0 ? 'text-amber-500' : 'text-gray-300 hover:text-gray-500'}`}
        title={flags.length > 0 ? `${flags.length} flag(s)` : 'Flag transaction'}
      >
        ⚑
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-10 w-72 bg-white rounded-xl shadow-lg border border-gray-200 p-4">
          {flags.length > 0 && (
            <div className="mb-3 space-y-2">
              {flags.map(f => (
                <div key={f.id} className="text-xs bg-amber-50 border border-amber-100 rounded p-2 text-gray-700">
                  {f.comment}
                </div>
              ))}
            </div>
          )}
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
          />
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="flex-1 border border-gray-200 rounded-lg py-1.5 text-xs">Cancel</button>
            <button onClick={submitFlag} disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-xs disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
