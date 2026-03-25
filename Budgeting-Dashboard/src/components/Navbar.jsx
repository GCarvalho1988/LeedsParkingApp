import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CsvUploader from './CsvUploader'

const tabs = [
  { to: '/', label: 'Overview', end: true },
  { to: '/categories', label: 'Categories' },
  { to: '/year-vs-year', label: 'Year vs Year' },
  { to: '/transactions', label: 'Transactions' },
]

export default function Navbar() {
  const { role, signOut } = useAuth()
  const navigate = useNavigate()
  const [uploaderOpen, setUploaderOpen] = useState(false)

  return (
    <>
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 h-14">
          <span className="font-bold text-gray-900 mr-4">BudgetDash</span>
          {tabs.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `text-sm font-medium pb-0.5 border-b-2 transition-colors ${
                  isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'
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
                className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700"
              >
                Upload CSV
              </button>
            )}
            <button onClick={() => { signOut(); navigate('/login') }} className="text-sm text-gray-500 hover:text-gray-900">
              Sign out
            </button>
          </div>
        </div>
      </nav>
      {uploaderOpen && <CsvUploader onSuccess={() => setUploaderOpen(false)} />}
    </>
  )
}
