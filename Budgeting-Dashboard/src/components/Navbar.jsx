import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CsvUploader from './CsvUploader'

const tabs = [
  { to: '/', label: 'OVERVIEW', end: true },
  { to: '/categories', label: 'CATEGORIES' },
  { to: '/year-vs-year', label: 'YEAR VS YEAR' },
  { to: '/transactions', label: 'TRANSACTIONS' },
]

export default function Navbar() {
  const { role, signOut } = useAuth()
  const navigate = useNavigate()
  const [uploaderOpen, setUploaderOpen] = useState(false)

  return (
    <>
      <nav className="bg-[#181818] border-b border-[#35211A]">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 h-14">
          <span
            className="text-[#B6A596] text-xs font-semibold tracking-[0.2em] uppercase mr-4"
            style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
          >
            BUDGETDASH
          </span>
          {tabs.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `text-xs font-medium tracking-widest pb-0.5 border-b transition-colors ${
                  isActive
                    ? 'border-[#DC9F85] text-[#EBDCC4]'
                    : 'border-transparent text-[#B6A596] hover:text-[#EBDCC4]'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
          <div className="ml-auto flex items-center gap-3">
            {role === 'admin' && (
              <button
                onClick={() => setUploaderOpen(true)}
                className="bg-[#DC9F85] text-[#181818] text-xs font-bold uppercase tracking-widest px-4 py-2 rounded hover:opacity-90 transition-opacity"
                style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
              >
                Upload CSV
              </button>
            )}
            <button
              onClick={() => { signOut(); navigate('/login') }}
              className="text-xs text-[#B6A596] hover:text-[#EBDCC4] border border-[#66473B] px-3 py-1.5 rounded transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>
      {uploaderOpen && <CsvUploader onSuccess={() => setUploaderOpen(false)} />}
    </>
  )
}
