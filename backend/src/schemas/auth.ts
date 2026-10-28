import { z } from 'zod'

export const registerSchema = z.object({
  email: z.email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
})

// 로그인은 길이 규칙을 다시 검사하지 않는다 — 규칙이 바뀌어도 기존 사용자가 로그인할 수 있어야 한다.
export const loginSchema = z.object({
  email: z.email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(1, '비밀번호를 입력하세요'),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
