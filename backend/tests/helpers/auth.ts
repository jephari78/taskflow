import type { createApp } from '../../src/app'

type App = ReturnType<typeof createApp>

/** JSON 본문 요청. token을 주면 Bearer 헤더를 붙인다. */
export function api(app: App, method: string, path: string, { body, token }: { body?: unknown; token?: string } = {}) {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`
  return app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
}

/** 가입 후 로그인까지 해서 토큰과 사용자 id를 돌려준다. */
export async function signUp(app: App, email: string, password = 'correct-horse') {
  await api(app, 'POST', '/api/auth/register', { body: { email, password } })
  const res = await api(app, 'POST', '/api/auth/login', { body: { email, password } })
  const { token, user } = (await res.json()) as { token: string; user: { id: string } }
  return { token, userId: user.id }
}
