import { serve } from '@hono/node-server'
import { createApp } from './app'
import { createDb } from './db/client'
import { runMigrations } from './db/migrate'

const db = createDb()
runMigrations(db)

const port = Number(process.env.PORT ?? 3000)

serve({ fetch: createApp(db).fetch, port }, (info) => {
  console.log(`TaskFlow API → http://localhost:${info.port}`)
})
