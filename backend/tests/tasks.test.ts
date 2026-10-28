// backend/tests/tasks.test.ts
import { eq } from 'drizzle-orm'
import { createApp } from '../src/app'
import { tasks } from '../src/db/schema'
import { api, signUp } from './helpers/auth'
import { createTestDb } from './helpers/db'
import type { Db } from '../src/db/client'

type TaskBody = { id: string; title: string; done: boolean; createdAt: string }

let db: Db
let app: ReturnType<typeof createApp>
let alice: { token: string; userId: string }
let bob: { token: string; userId: string }

beforeEach(async () => {
  db = createTestDb()
  app = createApp(db, { jwtSecret: 'test-secret' })
  alice = await signUp(app, 'alice@example.com')
  bob = await signUp(app, 'bob@example.com')
})

const createTask = async (token: string, title: string) => {
  const res = await api(app, 'POST', '/api/tasks', { token, body: { title } })
  return (await res.json()) as TaskBody
}

const tasksOf = (userId: string) => db.select().from(tasks).where(eq(tasks.userId, userId)).all()

describe('인증이 필요한 /api/tasks', () => {
  it.each([
    ['GET', '/api/tasks'],
    ['POST', '/api/tasks'],
    ['GET', '/api/tasks/some-id'],
    ['PATCH', '/api/tasks/some-id'],
    ['DELETE', '/api/tasks/some-id'],
  ])('토큰 없이 %s %s 를 호출하면 401을 반환한다', async (method, path) => {
    const res = await api(app, method, path, { body: method === 'POST' || method === 'PATCH' ? { title: 'x' } : undefined })

    expect(res.status).toBe(401)
    expect(db.select().from(tasks).all()).toHaveLength(0)
  })
})

describe('POST /api/tasks', () => {
  it('제목을 주면 201과 생성된 할 일을 반환한다', async () => {
    const res = await api(app, 'POST', '/api/tasks', { token: alice.token, body: { title: '우유 사기' } })

    expect(res.status).toBe(201)
    const body = (await res.json()) as TaskBody
    expect(body).toMatchObject({ title: '우유 사기', done: false })
    expect(typeof body.id).toBe('string')
    expect(typeof body.createdAt).toBe('string')
  })

  it('할 일을 토큰의 사용자 소유로 DB에 저장한다', async () => {
    const created = await createTask(alice.token, '우유 사기')

    const stored = db.select().from(tasks).where(eq(tasks.id, created.id)).get()
    expect(stored).toMatchObject({ userId: alice.userId, title: '우유 사기', done: false })
  })

  it('본문의 userId는 무시하고 토큰의 사용자를 소유자로 쓴다', async () => {
    await api(app, 'POST', '/api/tasks', { token: alice.token, body: { title: '몰래', userId: bob.userId } })

    expect(tasksOf(alice.userId)).toHaveLength(1)
    expect(tasksOf(bob.userId)).toHaveLength(0)
  })

  it('응답에 userId를 담지 않는다', async () => {
    const created = await createTask(alice.token, '우유 사기')

    expect(created).not.toHaveProperty('userId')
  })

  it('제목 앞뒤 공백을 잘라 저장한다', async () => {
    const created = await createTask(alice.token, '  우유 사기  ')

    expect(created.title).toBe('우유 사기')
  })

  it.each([
    ['빈 문자열', ''],
    ['공백만', '   '],
    ['200자 초과', 'a'.repeat(201)],
  ])('제목이 %s이면 400을 반환하고 저장하지 않는다', async (_, title) => {
    const res = await api(app, 'POST', '/api/tasks', { token: alice.token, body: { title } })

    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string; issues: { path: string }[] }
    expect(body.error).toBe('ValidationError')
    expect(body.issues.map((i) => i.path)).toContain('title')
    expect(tasksOf(alice.userId)).toHaveLength(0)
  })

  it('제목이 없으면 400을 반환한다', async () => {
    const res = await api(app, 'POST', '/api/tasks', { token: alice.token, body: {} })

    expect(res.status).toBe(400)
  })
})

describe('GET /api/tasks', () => {
  it('할 일이 없으면 빈 배열을 반환한다', async () => {
    const res = await api(app, 'GET', '/api/tasks', { token: alice.token })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual([])
  })

  it('내 할 일만 생성 순서대로 반환한다', async () => {
    await createTask(alice.token, '첫째')
    await createTask(bob.token, '밥의 할 일')
    await createTask(alice.token, '둘째')
    await createTask(alice.token, '셋째')

    const res = await api(app, 'GET', '/api/tasks', { token: alice.token })
    const body = (await res.json()) as TaskBody[]

    expect(body.map((t) => t.title)).toEqual(['첫째', '둘째', '셋째'])
    expect(body[0]).not.toHaveProperty('userId')
  })
})

describe('GET /api/tasks/:id', () => {
  it('내 할 일이면 200과 할 일을 반환한다', async () => {
    const created = await createTask(alice.token, '우유 사기')

    const res = await api(app, 'GET', `/api/tasks/${created.id}`, { token: alice.token })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual(created)
  })

  it('없는 id면 404를 반환한다', async () => {
    const res = await api(app, 'GET', '/api/tasks/no-such-id', { token: alice.token })

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: 'TaskNotFound' })
  })

  it('다른 사용자의 할 일이면 존재를 숨기고 404를 반환한다', async () => {
    const bobs = await createTask(bob.token, '밥의 할 일')

    const res = await api(app, 'GET', `/api/tasks/${bobs.id}`, { token: alice.token })

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: 'TaskNotFound' })
  })
})

describe('PATCH /api/tasks/:id', () => {
  it('done을 바꾸면 200과 수정된 할 일을 반환하고 DB에 반영한다', async () => {
    const created = await createTask(alice.token, '우유 사기')

    const res = await api(app, 'PATCH', `/api/tasks/${created.id}`, { token: alice.token, body: { done: true } })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ id: created.id, title: '우유 사기', done: true })
    expect(db.select().from(tasks).where(eq(tasks.id, created.id)).get()?.done).toBe(true)
  })

  it('title을 바꾸면 done은 그대로 둔다', async () => {
    const created = await createTask(alice.token, '우유 사기')
    await api(app, 'PATCH', `/api/tasks/${created.id}`, { token: alice.token, body: { done: true } })

    const res = await api(app, 'PATCH', `/api/tasks/${created.id}`, { token: alice.token, body: { title: '두유 사기' } })

    await expect(res.json()).resolves.toMatchObject({ title: '두유 사기', done: true })
  })

  it('본문의 userId로 소유자를 바꿀 수 없다', async () => {
    const created = await createTask(alice.token, '우유 사기')

    await api(app, 'PATCH', `/api/tasks/${created.id}`, { token: alice.token, body: { done: true, userId: bob.userId } })

    expect(db.select().from(tasks).where(eq(tasks.id, created.id)).get()?.userId).toBe(alice.userId)
  })

  it('바꿀 필드가 하나도 없으면 400을 반환한다', async () => {
    const created = await createTask(alice.token, '우유 사기')

    const res = await api(app, 'PATCH', `/api/tasks/${created.id}`, { token: alice.token, body: {} })

    expect(res.status).toBe(400)
  })

  it.each([
    ['빈 제목', { title: '  ' }, 'title'],
    ['문자열 done', { done: 'yes' }, 'done'],
  ])('%s이면 400을 반환하고 바꾸지 않는다', async (_, body, path) => {
    const created = await createTask(alice.token, '우유 사기')

    const res = await api(app, 'PATCH', `/api/tasks/${created.id}`, { token: alice.token, body })

    expect(res.status).toBe(400)
    const json = (await res.json()) as { issues: { path: string }[] }
    expect(json.issues.map((i) => i.path)).toContain(path)
    expect(db.select().from(tasks).where(eq(tasks.id, created.id)).get()).toMatchObject({ title: '우유 사기', done: false })
  })

  it('다른 사용자의 할 일이면 404를 반환하고 바꾸지 않는다', async () => {
    const bobs = await createTask(bob.token, '밥의 할 일')

    const res = await api(app, 'PATCH', `/api/tasks/${bobs.id}`, { token: alice.token, body: { done: true } })

    expect(res.status).toBe(404)
    expect(db.select().from(tasks).where(eq(tasks.id, bobs.id)).get()?.done).toBe(false)
  })
})

describe('DELETE /api/tasks/:id', () => {
  it('내 할 일이면 204를 반환하고 DB에서 지운다', async () => {
    const created = await createTask(alice.token, '우유 사기')

    const res = await api(app, 'DELETE', `/api/tasks/${created.id}`, { token: alice.token })

    expect(res.status).toBe(204)
    expect(tasksOf(alice.userId)).toHaveLength(0)
  })

  it('없는 id면 404를 반환한다', async () => {
    const res = await api(app, 'DELETE', '/api/tasks/no-such-id', { token: alice.token })

    expect(res.status).toBe(404)
  })

  it('다른 사용자의 할 일이면 404를 반환하고 지우지 않는다', async () => {
    const bobs = await createTask(bob.token, '밥의 할 일')

    const res = await api(app, 'DELETE', `/api/tasks/${bobs.id}`, { token: alice.token })

    expect(res.status).toBe(404)
    expect(tasksOf(bob.userId)).toHaveLength(1)
  })
})
