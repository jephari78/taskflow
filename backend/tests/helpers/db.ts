import { createDb, type Db } from '../../src/db/client'
import { runMigrations } from '../../src/db/migrate'

/** 케이스마다 격리된 in-memory DB. 마이그레이션까지 적용해서 돌려준다. */
export function createTestDb(): Db {
  const db = createDb(':memory:')
  runMigrations(db)
  return db
}
