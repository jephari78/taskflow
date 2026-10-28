const KEY = 'taskflow.token'

// 사파리 사생활 보호 모드처럼 저장소 접근이 막힌 환경에서도 앱이 죽지 않게 한다.
export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(KEY, token)
    } catch {}
  },
  clear() {
    try {
      localStorage.removeItem(KEY)
    } catch {}
  },
}
