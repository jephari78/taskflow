import { zValidator } from '@hono/zod-validator'
import type { ZodType } from 'zod'

/**
 * zValidator 위에 400 응답 형태를 고정한 래퍼.
 * 모든 검증 실패는 { error: 'ValidationError', issues: [{ path, message }] } 로 나간다.
 */
export function validate<T extends ZodType>(target: 'json' | 'query' | 'param', schema: T) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: 'ValidationError',
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        400,
      )
    }
  })
}
