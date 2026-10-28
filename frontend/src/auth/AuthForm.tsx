import { useState, type FormEvent } from 'react'
import { api, ApiError, type User } from '../api'

type Mode = 'login' | 'register'

const TEXT = {
  login: { title: '로그인', switchTo: '계정이 없나요? 회원가입' },
  register: { title: '회원가입', switchTo: '이미 계정이 있나요? 로그인' },
} as const

export function AuthForm({ onLoggedIn }: { onLoggedIn: (token: string, user: User) => void }) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const text = TEXT[mode]

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      if (mode === 'register') await api.register(email, password)
      const { token, user } = await api.login(email, password)
      onLoggedIn(token, user)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '알 수 없는 오류가 발생했습니다')
      setPending(false)
    }
  }

  function switchMode() {
    setMode(mode === 'login' ? 'register' : 'login')
    setError(null)
  }

  const input =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200'

  return (
    <section className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-6 text-xl font-semibold text-slate-900">{text.title}</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            이메일
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={input}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={input}
          />
          {mode === 'register' && <p className="text-xs text-slate-500">비밀번호는 8자 이상</p>}
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-indigo-600 py-2 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? '처리 중…' : text.title}
        </button>
      </form>

      <button type="button" onClick={switchMode} className="mt-4 w-full text-sm text-indigo-600 hover:underline">
        {text.switchTo}
      </button>
    </section>
  )
}
