// backend/tests/login.test.ts
import { eq } from 'drizzle-orm'
import { verify } from 'hono/jwt'
import { createApp } from '../src/app'
import { users } from '../src/db/schema'
import { createTestDb } from './helpers/db'
import type { Db } from '../src/db/client'

const JWT_SECRET = 'test-secret'

describe('POST /api/auth/login', () => {
  let db: Db
  let app: ReturnType<typeof createApp>

  const post = (path: string, body: unknown) =>
    app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

  const login = (body: unknown) => post('/api/auth/login', body)

  beforeEach(async () => {
    db = createTestDb()
    app = createApp(db, { jwtSecret: JWT_SECRET })
    await post('/api/auth/register', { email: 'doomy@example.com', password: 'correct-horse' })
  })

  it('올바른 이메일과 비밀번호면 200과 토큰, 사용자 정보를 반환한다', async () => {
    const res = await login({ email: 'doomy@example.com', password: 'correct-horse' })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { token: string; user: { id: string; email: string } }
    expect(typeof body.token).toBe('string')
    expect(body.user).toMatchObject({ email: 'doomy@example.com' })
  })

  it('발급된 토큰의 sub는 DB에 저장된 사용자 id이고 만료 시각을 가진다', async () => {
    const res = await login({ email: 'doomy@example.com', password: 'correct-horse' })
    const { token } = (await res.json()) as { token: string }

    const stored = db.select().from(users).where(eq(users.email, 'doomy@example.com')).get()
    const payload = await verify(token, JWT_SECRET, 'HS256')
    expect(payload.sub).toBe(stored!.id)
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('다른 키로 서명된 토큰으로는 검증되지 않는다', async () => {
    const res = await login({ email: 'doomy@example.com', password: 'correct-horse' })
    const { token } = (await res.json()) as { token: string }

    await expect(verify(token, 'wrong-secret', 'HS256')).rejects.toThrow()
  })

  it('응답에 비밀번호나 해시를 담지 않는다', async () => {
    const res = await login({ email: 'doomy@example.com', password: 'correct-horse' })
    const text = await res.text()

    expect(text).not.toContain('correct-horse')
    expect(text).not.toContain('passwordHash')
    expect(text).not.toContain('scrypt$')
  })

  it('비밀번호가 틀리면 401을 반환한다', async () => {
    const res = await login({ email: 'doomy@example.com', password: 'wrong-password' })

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'InvalidCredentials' })
  })

  it('등록되지 않은 이메일이면 비밀번호 오류와 같은 401을 반환한다', async () => {
    const res = await login({ email: 'nobody@example.com', password: 'correct-horse' })

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'InvalidCredentials' })
  })

  it('이메일 형식이 잘못되면 400을 반환한다', async () => {
    const res = await login({ email: 'not-an-email', password: 'correct-horse' })

    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string; issues: { path: string }[] }
    expect(body.error).toBe('ValidationError')
    expect(body.issues.map((i) => i.path)).toContain('email')
  })

  it('비밀번호가 비어 있으면 400을 반환한다', async () => {
    const res = await login({ email: 'doomy@example.com', password: '' })

    expect(res.status).toBe(400)
    const body = (await res.json()) as { issues: { path: string }[] }
    expect(body.issues.map((i) => i.path)).toContain('password')
  })

  it('로그인은 사용자를 새로 만들지 않는다', async () => {
    await login({ email: 'nobody@example.com', password: 'correct-horse' })
    await login({ email: 'doomy@example.com', password: 'correct-horse' })

    expect(db.select().from(users).all()).toHaveLength(1)
  })
})
