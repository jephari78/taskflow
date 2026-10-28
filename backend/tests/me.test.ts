// backend/tests/me.test.ts
import { eq } from 'drizzle-orm'
import { sign } from 'hono/jwt'
import { createApp } from '../src/app'
import { users } from '../src/db/schema'
import { createTestDb } from './helpers/db'
import type { Db } from '../src/db/client'

const JWT_SECRET = 'test-secret'

describe('GET /api/auth/me', () => {
  let db: Db
  let app: ReturnType<typeof createApp>
  let token: string
  let userId: string

  const me = (headers: Record<string, string> = {}) => app.request('/api/auth/me', { headers })
  const bearer = (t: string) => ({ authorization: `Bearer ${t}` })
  const now = () => Math.floor(Date.now() / 1000)

  const post = (path: string, body: unknown) =>
    app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

  beforeEach(async () => {
    db = createTestDb()
    app = createApp(db, { jwtSecret: JWT_SECRET })
    await post('/api/auth/register', { email: 'doomy@example.com', password: 'correct-horse' })
    const res = await post('/api/auth/login', { email: 'doomy@example.com', password: 'correct-horse' })
    ;({ token } = (await res.json()) as { token: string })
    userId = db.select().from(users).where(eq(users.email, 'doomy@example.com')).get()!.id
  })

  it('유효한 토큰이면 200과 현재 사용자 정보를 반환한다', async () => {
    const res = await me(bearer(token))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ id: userId, email: 'doomy@example.com' })
  })

  it('응답에 비밀번호 해시를 담지 않는다', async () => {
    const res = await me(bearer(token))
    const text = await res.text()

    expect(text).not.toContain('passwordHash')
    expect(text).not.toContain('scrypt$')
  })

  it('Authorization 헤더가 없으면 401을 반환한다', async () => {
    const res = await me()

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('Bearer 형식이 아니면 401을 반환한다', async () => {
    const res = await me({ authorization: `Basic ${token}` })

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('형식이 깨진 토큰이면 401을 반환한다', async () => {
    const res = await me(bearer('not.a.jwt'))

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('다른 키로 서명된 토큰이면 401을 반환한다', async () => {
    const forged = await sign({ sub: userId, exp: now() + 60 }, 'wrong-secret', 'HS256')
    const res = await me(bearer(forged))

    expect(res.status).toBe(401)
  })

  it('만료된 토큰이면 401을 반환한다', async () => {
    const expired = await sign({ sub: userId, exp: now() - 60 }, JWT_SECRET, 'HS256')
    const res = await me(bearer(expired))

    expect(res.status).toBe(401)
  })

  it('sub가 없는 토큰이면 401을 반환한다', async () => {
    const noSub = await sign({ exp: now() + 60 }, JWT_SECRET, 'HS256')
    const res = await me(bearer(noSub))

    expect(res.status).toBe(401)
  })

  it('토큰의 사용자가 DB에서 삭제되었으면 401을 반환한다', async () => {
    db.delete(users).where(eq(users.id, userId)).run()
    const res = await me(bearer(token))

    expect(res.status).toBe(401)
    expect(db.select().from(users).all()).toHaveLength(0)
  })
})
