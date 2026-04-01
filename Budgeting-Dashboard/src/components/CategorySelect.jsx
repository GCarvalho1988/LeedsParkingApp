import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function CategorySelect({ value, allCategories, txId, onSave, onCancel }) {
  const [selected, setSelected] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function save() {
    if (selected === value) { onCancel(); return }
    setSaving(true)
    const { error: err } = await supabase
      .from('transactions')
      .update({ category: selected })
      .eq('id', txId)
    if (err) {
      setError('Save failed')
      setSaving(false)
    } else {
      onSave(selected)
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        className="bg-[#181818] border border-[#DC9F85] text-[#EBDCC4] text-xs rounded px-2 py-0.5 focus:outline-none"
        autoFocus
      >
        {allCategories.map(c => (
          <option key={c} value={c} className="bg-[#181818]">{c}</option>
        ))}
      </select>
      <button
        onClick={save}
        disabled={saving}
        className="text-xs bg-[#DC9F85] text-[#181818] font-bold px-2 py-0.5 rounded disabled:opacity-50"
      >
        {saving ? '…' : '✓'}
      </button>
      <button onClick={onCancel} className="text-xs text-[#B6A596] hover:text-[#EBDCC4] px-1">✕</button>
      {error && <span className="text-xs text-[#DC9F85]">{error}</span>}
    </span>
  )
}
