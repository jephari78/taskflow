import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

export type Db = ReturnType<typeof createDb>

/**
 * 파일 경로 또는 ':memory:'를 받아 Drizzle 인스턴스를 만든다.
 * 테스트는 ':memory:'를 넘겨 케이스마다 새 DB를 쓴다.
 */
export function createDb(url: string = process.env.DATABASE_URL ?? './taskflow.db') {
  const sqlite = new Database(url)
  sqlite.pragma('foreign_keys = ON')
  if (url !== ':memory:') sqlite.pragma('journal_mode = WAL')
  return drizzle(sqlite, { schema })
}
