type Reply = { status: number; body?: unknown }
type Handler = Reply | ((init: RequestInit | undefined) => Reply)

/**
 * `'POST /api/auth/login'` 같은 키로 응답을 정해 두는 가짜 fetch.
 * 정해 두지 않은 요청은 테스트가 놓친 호출이므로 에러를 던진다.
 */
export function mockFetch(routes: Record<string, Handler>) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`
    const handler = routes[key]
    if (!handler) throw new Error(`예상하지 못한 요청: ${key}`)
    const { status, body } = typeof handler === 'function' ? handler(init) : handler
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

/** 가짜 fetch가 받은 요청 중 key에 해당하는 것의 JSON 본문 */
export function bodyOf(fn: ReturnType<typeof mockFetch>, key: string) {
  const call = fn.mock.calls.find(([input, init]) => `${init?.method ?? 'GET'} ${String(input)}` === key)
  return call ? JSON.parse(String(call[1]?.body)) : undefined
}

/** 가짜 fetch가 받은 요청의 헤더 */
export function headersOf(fn: ReturnType<typeof mockFetch>, key: string) {
  const call = fn.mock.calls.find(([input, init]) => `${init?.method ?? 'GET'} ${String(input)}` === key)
  return new Headers(call?.[1]?.headers)
}
