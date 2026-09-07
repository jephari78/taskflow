import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { createDb, type Db } from './client'

const here = path.dirname(fileURLToPath(import.meta.url))

/** drizzle-kit generate가 만들어 둔 마이그레이션 폴더 */
export const MIGRATIONS_FOLDER = path.resolve(here, '../../drizzle')

export function runMigrations(db: Db) {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
}

// `npm run db:migrate`로 직접 실행했을 때만 동작
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrations(createDb())
  console.log('migrations applied')
}
