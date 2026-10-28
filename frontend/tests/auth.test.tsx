// frontend/tests/auth.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../src/App'
import { bodyOf, headersOf, mockFetch } from './helpers/fetch'

const TOKEN_KEY = 'taskflow.token'
const loginOk = { status: 200, body: { token: 'jwt-token', user: { id: 'u1', email: 'alice@example.com' } } }
const noTasks = { 'GET /api/tasks': { status: 200, body: [] } }
const meOk = { status: 200, body: { id: 'u1', email: 'alice@example.com', createdAt: '2026-01-01T00:00:00.000Z' } }

beforeEach(() => localStorage.clear())

async function fillAndSubmit(email: string, password: string, submit: '로그인' | '회원가입') {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('이메일'), email)
  await user.type(screen.getByLabelText('비밀번호'), password)
  await user.click(screen.getByRole('button', { name: submit }))
  return user
}

describe('로그인 화면', () => {
  it('토큰이 없으면 로그인 폼을 보여준다', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument()
    expect(screen.getByLabelText('이메일')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument()
  })

  it('로그인에 성공하면 토큰을 저장하고 환영 메시지를 보여준다', async () => {
    const fetch = mockFetch({ 'POST /api/auth/login': loginOk, ...noTasks })
    render(<App />)

    await fillAndSubmit('alice@example.com', 'correct-horse', '로그인')

    expect(await screen.findByText('alice@example.com 님, 환영합니다')).toBeInTheDocument()
    expect(bodyOf(fetch, 'POST /api/auth/login')).toEqual({ email: 'alice@example.com', password: 'correct-horse' })
    expect(localStorage.getItem(TOKEN_KEY)).toBe('jwt-token')
    expect(screen.queryByRole('heading', { name: '로그인' })).not.toBeInTheDocument()
  })

  it('이메일이나 비밀번호가 틀리면 에러를 보여주고 토큰을 저장하지 않는다', async () => {
    mockFetch({ 'POST /api/auth/login': { status: 401, body: { error: 'InvalidCredentials' } } })
    render(<App />)

    await fillAndSubmit('alice@example.com', 'wrong-password', '로그인')

    expect(await screen.findByRole('alert')).toHaveTextContent('이메일 또는 비밀번호가 올바르지 않습니다')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument()
  })

  it('서버 검증 오류는 서버가 준 메시지를 보여준다', async () => {
    mockFetch({
      'POST /api/auth/login': {
        status: 400,
        body: { error: 'ValidationError', issues: [{ path: 'email', message: '올바른 이메일 형식이 아닙니다' }] },
      },
    })
    render(<App />)

    await fillAndSubmit('a@b', 'x', '로그인')

    expect(await screen.findByRole('alert')).toHaveTextContent('올바른 이메일 형식이 아닙니다')
  })

  it('서버에 연결할 수 없으면 안내 메시지를 보여준다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    render(<App />)

    await fillAndSubmit('alice@example.com', 'correct-horse', '로그인')

    expect(await screen.findByRole('alert')).toHaveTextContent('서버에 연결할 수 없습니다')
  })

  it('요청 중에는 버튼을 비활성화해 중복 제출을 막는다', async () => {
    let resolve!: (r: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => (resolve = r))))
    render(<App />)

    await fillAndSubmit('alice@example.com', 'correct-horse', '로그인')

    expect(screen.getByRole('button', { name: '처리 중…' })).toBeDisabled()
    resolve(new Response(JSON.stringify(loginOk.body), { status: 200 }))
    expect(await screen.findByText('alice@example.com 님, 환영합니다')).toBeInTheDocument()
  })
})

describe('회원가입 화면', () => {
  async function openRegister() {
    render(<App />)
    await userEvent.setup().click(screen.getByRole('button', { name: '계정이 없나요? 회원가입' }))
  }

  it('전환 버튼을 누르면 회원가입 폼을 보여주고, 다시 로그인으로 돌아갈 수 있다', async () => {
    await openRegister()

    expect(screen.getByRole('heading', { name: '회원가입' })).toBeInTheDocument()
    expect(screen.getByText('비밀번호는 8자 이상')).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: '이미 계정이 있나요? 로그인' }))
    expect(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument()
  })

  it('가입에 성공하면 같은 정보로 바로 로그인한다', async () => {
    const fetch = mockFetch({
      'POST /api/auth/register': { status: 201, body: { id: 'u1', email: 'alice@example.com' } },
      'POST /api/auth/login': loginOk,
      ...noTasks,
    })
    await openRegister()

    await fillAndSubmit('alice@example.com', 'correct-horse', '회원가입')

    expect(await screen.findByText('alice@example.com 님, 환영합니다')).toBeInTheDocument()
    expect(bodyOf(fetch, 'POST /api/auth/register')).toEqual({ email: 'alice@example.com', password: 'correct-horse' })
    expect(bodyOf(fetch, 'POST /api/auth/login')).toEqual({ email: 'alice@example.com', password: 'correct-horse' })
    expect(localStorage.getItem(TOKEN_KEY)).toBe('jwt-token')
  })

  it('이미 가입된 이메일이면 에러를 보여주고 로그인하지 않는다', async () => {
    const fetch = mockFetch({ 'POST /api/auth/register': { status: 409, body: { error: 'EmailAlreadyRegistered' } } })
    await openRegister()

    await fillAndSubmit('alice@example.com', 'correct-horse', '회원가입')

    expect(await screen.findByRole('alert')).toHaveTextContent('이미 가입된 이메일입니다')
    expect(bodyOf(fetch, 'POST /api/auth/login')).toBeUndefined()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('비밀번호가 짧으면 서버의 검증 메시지를 보여준다', async () => {
    mockFetch({
      'POST /api/auth/register': {
        status: 400,
        body: { error: 'ValidationError', issues: [{ path: 'password', message: '비밀번호는 8자 이상이어야 합니다' }] },
      },
    })
    await openRegister()

    await fillAndSubmit('alice@example.com', 'short', '회원가입')

    expect(await screen.findByRole('alert')).toHaveTextContent('비밀번호는 8자 이상이어야 합니다')
  })

  it('모드를 바꾸면 이전 에러 메시지를 지운다', async () => {
    mockFetch({ 'POST /api/auth/login': { status: 401, body: { error: 'InvalidCredentials' } } })
    render(<App />)
    const user = await fillAndSubmit('alice@example.com', 'wrong', '로그인')
    await screen.findByRole('alert')

    await user.click(screen.getByRole('button', { name: '계정이 없나요? 회원가입' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('로그인 상태 유지와 로그아웃', () => {
  it('저장된 토큰이 유효하면 새로고침 후에도 로그인 상태를 유지한다', async () => {
    localStorage.setItem(TOKEN_KEY, 'saved-token')
    const fetch = mockFetch({ 'GET /api/auth/me': meOk, ...noTasks })

    render(<App />)

    expect(await screen.findByText('alice@example.com 님, 환영합니다')).toBeInTheDocument()
    expect(headersOf(fetch, 'GET /api/auth/me').get('authorization')).toBe('Bearer saved-token')
  })

  it('저장된 토큰이 만료되었으면 지우고 로그인 폼을 보여준다', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired-token')
    mockFetch({ 'GET /api/auth/me': { status: 401, body: { error: 'Unauthorized' } } })

    render(<App />)

    expect(await screen.findByRole('heading', { name: '로그인' })).toBeInTheDocument()
    await waitFor(() => expect(localStorage.getItem(TOKEN_KEY)).toBeNull())
  })

  it('로그아웃하면 토큰을 지우고 로그인 폼으로 돌아간다', async () => {
    localStorage.setItem(TOKEN_KEY, 'saved-token')
    mockFetch({ 'GET /api/auth/me': meOk, ...noTasks })
    render(<App />)

    await userEvent.setup().click(await screen.findByRole('button', { name: '로그아웃' }))

    expect(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})
