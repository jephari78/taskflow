export type User = { id: string; email: string }
export type Task = { id: string; title: string; done: boolean; createdAt: string }

type ErrorBody = { error?: string; issues?: { path: string; message: string }[] }

/** backend 에러 응답을 화면에 보여줄 한국어 메시지와 함께 담는다. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

const MESSAGES: Record<string, string> = {
  InvalidCredentials: '이메일 또는 비밀번호가 올바르지 않습니다',
  EmailAlreadyRegistered: '이미 가입된 이메일입니다',
  Unauthorized: '다시 로그인해 주세요',
  TaskNotFound: '할 일을 찾을 수 없습니다',
}

function messageFor(body: ErrorBody | null): string {
  if (body?.error === 'ValidationError' && body.issues?.length) {
    return body.issues.map((i) => i.message).join(' / ')
  }
  return (body?.error && MESSAGES[body.error]) || '요청을 처리하지 못했습니다'
}

// 상대 경로로만 호출한다 — 개발 중에는 Vite가 /api를 backend로 프록시한다.
async function request<T>(method: string, path: string, { body, token }: { body?: unknown; token?: string } = {}) {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'NetworkError', '서버에 연결할 수 없습니다')
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, (data as ErrorBody | null)?.error ?? 'Unknown', messageFor(data))
  return data as T
}

export const api = {
  register: (email: string, password: string) =>
    request<User>('POST', '/api/auth/register', { body: { email, password } }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('POST', '/api/auth/login', { body: { email, password } }),
  me: (token: string) => request<User>('GET', '/api/auth/me', { token }),

  listTasks: (token: string) => request<Task[]>('GET', '/api/tasks', { token }),
  createTask: (token: string, title: string) => request<Task>('POST', '/api/tasks', { token, body: { title } }),
  updateTask: (token: string, id: string, patch: Partial<Pick<Task, 'title' | 'done'>>) =>
    request<Task>('PATCH', `/api/tasks/${encodeURIComponent(id)}`, { token, body: patch }),
  deleteTask: (token: string, id: string) =>
    request<null>('DELETE', `/api/tasks/${encodeURIComponent(id)}`, { token }),
}
