import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CsvUploader from './CsvUploader'
import Logo from './Logo'
import { supabase } from '../lib/supabase'
import { BILLS_CATEGORIES, TRANSIENT_CATEGORIES } from '../lib/categories'
import { nextPeriodBoundary } from '../lib/dateUtils'

const tabs = [
  { to: '/', label: 'OVERVIEW', end: true },
  { to: '/categories', label: 'CATEGORIES' },
  { to: '/year-vs-year', label: 'YEAR VS YEAR' },
  { to: '/transactions', label: 'TRANSACTIONS' },
  { to: '/review', label: 'REVIEW' },
]

export default function Navbar() {
  const { role, signOut } = useAuth()
  const navigate = useNavigate()
  const [uploaderOpen, setUploaderOpen] = useState(false)
  const [reviewCount, setReviewCount] = useState(null)

  // Fetch unreviewed count for most recent period on mount
  useEffect(() => {
    async function loadBadge() {
      const { data: uploads } = await supabase
        .from('uploads')
        .select('period')
        .order('period', { ascending: false })
        .limit(1)

      const latestPeriod = uploads?.[0]?.period
      if (!latestPeriod) return

      const excluded = [...BILLS_CATEGORIES, ...TRANSIENT_CATEGORIES]
      const { count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .gte('date', `${latestPeriod}-01`)
        .lt('date', nextPeriodBoundary(latestPeriod))
        .not('category', 'in', `(${excluded.map(c => `"${c}"`).join(',')})`)

      setReviewCount(count ?? 0)
    }
    loadBadge()
  }, [])

  return (
    <>
      <nav className="bg-[#181818] border-b border-[#35211A]">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 h-14">
          {/* Logo mark + wordmark */}
          <div className="flex items-center gap-2 mr-4">
            <Logo size={24} />
            <span
              className="text-[#B6A596] text-xs font-semibold tracking-[0.2em] uppercase"
              style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
            >
              BUDGETDASH
            </span>
          </div>

          {tabs.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `text-xs font-medium tracking-widest pb-0.5 border-b transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'border-[#DC9F85] text-[#EBDCC4]'
                    : 'border-transparent text-[#B6A596] hover:text-[#EBDCC4]'
                }`
              }
            >
              {t.label}
              {t.to === '/review' && reviewCount > 0 && (
                <span
                  className="bg-[#DC9F85] text-[#181818] text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                  style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                >
                  {reviewCount}
                </span>
              )}
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
