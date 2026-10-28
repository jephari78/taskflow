import { serve } from '@hono/node-server'
import { createApp } from './app'
import { createDb } from './db/client'
import { runMigrations } from './db/migrate'

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) {
  console.error('JWT_SECRET 환경 변수가 필요합니다 (.env.example 참고)')
  process.exit(1)
}

const db = createDb()
runMigrations(db)

const port = Number(process.env.PORT ?? 3000)

serve({ fetch: createApp(db, { jwtSecret }).fetch, port }, (info) => {
  console.log(`TaskFlow API → http://localhost:${info.port}`)
})
