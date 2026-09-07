import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 64
const SCHEME = 'scrypt'

/** `scrypt$<salt hex>$<derived key hex>` 형태의 단일 문자열로 저장한다. */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16)
  const derived = scryptSync(plain, salt, KEY_LENGTH)
  return `${SCHEME}$${salt.toString('hex')}$${derived.toString('hex')}`
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [scheme, saltHex, keyHex] = stored.split('$')
  if (scheme !== SCHEME || !saltHex || !keyHex) return false

  const expected = Buffer.from(keyHex, 'hex')
  const derived = scryptSync(plain, Buffer.from(saltHex, 'hex'), expected.length)
  return timingSafeEqual(derived, expected)
}
