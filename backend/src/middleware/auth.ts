import { eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import type { Db } from '../db/client'
import { users } from '../db/schema'

export type AuthEnv = {
  Variables: { userId: string }
}

/**
 * `Authorization: Bearer <JWT>`를 검증하고 c.var.userId를 채운다.
 * 서명·만료·sub 누락·삭제된 사용자는 모두 같은 401로 막는다.
 */
export function requireAuth(db: Db, jwtSecret: string | undefined) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    if (!jwtSecret) throw new Error('JWT_SECRET is not configured')

    const unauthorized = () => c.json({ error: 'Unauthorized' }, 401)

    const [scheme, token] = c.req.header('authorization')?.split(' ') ?? []
    if (scheme !== 'Bearer' || !token) return unauthorized()

    let sub: unknown
    try {
      ;({ sub } = await verify(token, jwtSecret, 'HS256'))
    } catch {
      return unauthorized()
    }
    if (typeof sub !== 'string') return unauthorized()

    const user = db.select({ id: users.id }).from(users).where(eq(users.id, sub)).get()
    if (!user) return unauthorized()

    c.set('userId', user.id)
    await next()
  })
}
