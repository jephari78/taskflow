import { z } from 'zod'

const title = z.string().trim().min(1, '제목을 입력하세요').max(200, '제목은 200자 이하여야 합니다')

// z.object는 모르는 키(userId 등)를 버린다 — 소유자는 항상 토큰에서 정한다.
export const createTaskSchema = z.object({ title })

export const updateTaskSchema = z
  .object({ title: title.optional(), done: z.boolean().optional() })
  .refine((v) => v.title !== undefined || v.done !== undefined, '바꿀 필드가 하나 이상 필요합니다')

export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
