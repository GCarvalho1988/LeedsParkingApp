import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const err = await signIn(email, password)
    if (err) {
      setError('Invalid email or password.')
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-[#181818] flex flex-col items-center justify-center px-4">
      <h1
        className="text-5xl font-bold text-[#EBDCC4] uppercase tracking-tight mb-12"
        style={{ fontFamily: "'Clash Grotesk', sans-serif", lineHeight: 0.85 }}
      >
        BUDGETDASH
      </h1>
      <div className="w-full max-w-sm border border-[#66473B] rounded p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-[#B6A596] uppercase tracking-widest mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-transparent border border-[#66473B] rounded px-3 py-2.5 text-sm text-[#EBDCC4] placeholder-[#66473B] focus:outline-none focus:border-[#DC9F85] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#B6A596] uppercase tracking-widest mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-transparent border border-[#66473B] rounded px-3 py-2.5 text-sm text-[#EBDCC4] placeholder-[#66473B] focus:outline-none focus:border-[#DC9F85] transition-colors"
            />
          </div>
          {error && <p className="text-[#DC9F85] text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#DC9F85] text-[#181818] rounded py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-opacity mt-2"
            style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
