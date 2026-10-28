import { useEffect, useState } from 'react'
import { api, type User } from './api'
import { AuthForm } from './auth/AuthForm'
import { tokenStore } from './auth/token'
import { TaskList } from './tasks/TaskList'

type Session = { status: 'checking' } | { status: 'guest' } | { status: 'user'; user: User; token: string }

export function App() {
  // 토큰이 없으면 확인할 것도 없으니 바로 로그인 폼을 보여준다.
  const [session, setSession] = useState<Session>(() =>
    tokenStore.get() ? { status: 'checking' } : { status: 'guest' },
  )

  // 새로고침 후 저장된 토큰이 아직 유효한지 /api/auth/me로 확인한다.
  useEffect(() => {
    const token = tokenStore.get()
    if (!token) return
    let cancelled = false
    api
      .me(token)
      .then((user) => !cancelled && setSession({ status: 'user', user, token }))
      .catch(() => {
        if (cancelled) return
        tokenStore.clear()
        setSession({ status: 'guest' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleLoggedIn(token: string, user: User) {
    tokenStore.set(token)
    setSession({ status: 'user', user, token })
  }

  function handleLogout() {
    tokenStore.clear()
    setSession({ status: 'guest' })
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-12">
      <h1 className="mb-8 text-center text-3xl font-bold text-slate-900">TaskFlow</h1>

      {session.status === 'checking' && <p className="text-center text-slate-500">확인 중…</p>}
      {session.status === 'guest' && <AuthForm onLoggedIn={handleLoggedIn} />}
      {session.status === 'user' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <p>{session.user.email} 님, 환영합니다</p>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-white"
            >
              로그아웃
            </button>
          </div>
          {/* 토큰이 만료되면 로그아웃과 똑같이 처리한다 */}
          <TaskList token={session.token} onUnauthorized={handleLogout} />
        </div>
      )}
    </main>
  )
}
