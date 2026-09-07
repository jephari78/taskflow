import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { Db } from '../db/client'
import { users } from '../db/schema'
import { hashPassword } from '../lib/password'
import { validate } from '../lib/validate'
import { registerSchema } from '../schemas/auth'

export function authRoutes(db: Db) {
  return new Hono().post('/register', validate('json', registerSchema), (c) => {
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
}
