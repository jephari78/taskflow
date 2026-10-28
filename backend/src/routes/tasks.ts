import { and, asc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { Db } from '../db/client'
import { tasks } from '../db/schema'
import { validate } from '../lib/validate'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { createTaskSchema, updateTaskSchema } from '../schemas/tasks'

// 응답에 담을 컬럼. userId는 내보내지 않는다.
const columns = { id: tasks.id, title: tasks.title, done: tasks.done, createdAt: tasks.createdAt }

export function taskRoutes(db: Db, { jwtSecret }: { jwtSecret?: string }) {
  // 다른 사용자의 할 일도 '없음'과 똑같이 404로 응답해 존재 여부를 숨긴다.
  const owned = (id: string, userId: string) => and(eq(tasks.id, id), eq(tasks.userId, userId))
  const notFound = { error: 'TaskNotFound' } as const

  return new Hono<AuthEnv>()
    .use('*', requireAuth(db, jwtSecret))
    .get('/', (c) => {
      const list = db
        .select(columns)
        .from(tasks)
        .where(eq(tasks.userId, c.var.userId))
        .orderBy(asc(tasks.createdAt), sql`rowid`) // 같은 ms에 만들어져도 삽입 순서 유지
        .all()
      return c.json(list, 200)
    })
    .post('/', validate('json', createTaskSchema), (c) => {
      const { title } = c.req.valid('json')
      const created = db.insert(tasks).values({ title, userId: c.var.userId }).returning(columns).get()
      return c.json(created, 201)
    })
    .get('/:id', (c) => {
      const task = db.select(columns).from(tasks).where(owned(c.req.param('id'), c.var.userId)).get()
      return task ? c.json(task, 200) : c.json(notFound, 404)
    })
    .patch('/:id', validate('json', updateTaskSchema), (c) => {
      const updated = db
        .update(tasks)
        .set(c.req.valid('json'))
        .where(owned(c.req.param('id'), c.var.userId))
        .returning(columns)
        .get()
      return updated ? c.json(updated, 200) : c.json(notFound, 404)
    })
    .delete('/:id', (c) => {
      const { changes } = db.delete(tasks).where(owned(c.req.param('id'), c.var.userId)).run()
      return changes > 0 ? c.body(null, 204) : c.json(notFound, 404)
    })
}
