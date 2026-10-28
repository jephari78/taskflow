import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import type { Db } from '../db/client'
import { users } from '../db/schema'
import { hashPassword, verifyPassword } from '../lib/password'
import { validate } from '../lib/validate'
import { requireAuth } from '../middleware/auth'
import { loginSchema, registerSchema } from '../schemas/auth'

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7 // 7일

// 없는 이메일에도 scrypt를 한 번 돌려 응답 시간으로 가입 여부를 추측하지 못하게 한다.
let dummyHash: string | undefined
const getDummyHash = () => (dummyHash ??= hashPassword('dummy-password'))

export function authRoutes(db: Db, { jwtSecret }: { jwtSecret?: string }) {
  return new Hono()
    .post('/register', validate('json', registerSchema), (c) => {
      const { email, password } = c.req.valid('json')

      const existing = db.select({ id: users.id }).from(users).where(eq(users.email, email)).get()
      if (existing) {
        return c.json({ error: 'EmailAlreadyRegistered' }, 409)
      }

      // 응답에 담을 컬럼만 returning으로 고른다 — passwordHash가 새어 나갈 경로를 아예 없앤다.
      const created = db
        .insert(users)
        .values({ email, passwordHash: hashPassword(password) })
        .returning({ id: users.id, email: users.email, createdAt: users.createdAt })
        .get()

      return c.json(created, 201)
    })
    .post('/login', validate('json', loginSchema), async (c) => {
      if (!jwtSecret) throw new Error('JWT_SECRET is not configured')
      const { email, password } = c.req.valid('json')

      const user = db
        .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.email, email))
        .get()

      const ok = verifyPassword(password, user?.passwordHash ?? getDummyHash())
      if (!user || !ok) {
        return c.json({ error: 'InvalidCredentials' }, 401)
      }

      const now = Math.floor(Date.now() / 1000)
      const token = await sign({ sub: user.id, iat: now, exp: now + TOKEN_TTL_SECONDS }, jwtSecret, 'HS256')

      return c.json({ token, user: { id: user.id, email: user.email } }, 200)
    })
    .get('/me', requireAuth(db, jwtSecret), (c) => {
      const me = db
        .select({ id: users.id, email: users.email, createdAt: users.createdAt })
        .from(users)
        .where(eq(users.id, c.var.userId))
        .get()

      return c.json(me, 200)
    })
}
