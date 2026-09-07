// backend/tests/auth.test.ts
import { eq } from 'drizzle-orm'
import { createApp } from '../src/app'
import { users } from '../src/db/schema'
import { verifyPassword } from '../src/lib/password'
import { createTestDb } from './helpers/db'
import type { Db } from '../src/db/client'

describe('POST /api/auth/register', () => {
  let db: Db
  let app: ReturnType<typeof createApp>

  beforeEach(() => {
    db = createTestDb()
    app = createApp(db)
  })

  const register = (body: unknown) =>
    app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

  it('유효한 입력이면 201과 생성된 사용자를 반환한다', async () => {
    const res = await register({ email: 'doomy@example.com', password: 'correct-horse' })

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({ email: 'doomy@example.com' })
  })

  it('응답에 비밀번호를 절대 담지 않는다', async () => {
    const res = await register({ email: 'doomy@example.com', password: 'correct-horse' })
    const body = (await res.json()) as Record<string, unknown>

    expect(body).not.toHaveProperty('password')
    expect(body).not.toHaveProperty('passwordHash')
    expect(JSON.stringify(body)).not.toContain('correct-horse')
  })

  it('비밀번호를 평문이 아닌 해시로 저장한다', async () => {
    await register({ email: 'doomy@example.com', password: 'correct-horse' })

    const stored = db.select().from(users).where(eq(users.email, 'doomy@example.com')).get()
    expect(stored?.passwordHash).toBeDefined()
    expect(stored?.passwordHash).not.toBe('correct-horse')
    expect(verifyPassword('correct-horse', stored!.passwordHash)).toBe(true)
    expect(verifyPassword('wrong-password', stored!.passwordHash)).toBe(false)
  })

  it('이미 등록된 이메일이면 409를 반환한다', async () => {
    await register({ email: 'doomy@example.com', password: 'correct-horse' })
    const res = await register({ email: 'doomy@example.com', password: 'another-password' })

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({ error: 'EmailAlreadyRegistered' })
  })

  it('이메일 형식이 잘못되면 400을 반환한다', async () => {
    const res = await register({ email: 'not-an-email', password: 'correct-horse' })

    expect(res.status).toBe(400)
    const body = (await res.json()) as { issues: { path: string }[] }
    expect(body.issues.map((i) => i.path)).toContain('email')
  })

  it('비밀번호가 8자 미만이면 400을 반환한다', async () => {
    const res = await register({ email: 'doomy@example.com', password: 'short' })

    expect(res.status).toBe(400)
    const body = (await res.json()) as { issues: { path: string }[] }
    expect(body.issues.map((i) => i.path)).toContain('password')
  })

  it('실패한 요청은 사용자를 만들지 않는다', async () => {
    await register({ email: 'not-an-email', password: 'short' })

    expect(db.select().from(users).all()).toHaveLength(0)
  })
})
