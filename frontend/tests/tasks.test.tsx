// frontend/tests/tasks.test.tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../src/App'
import { bodyOf, headersOf, mockFetch } from './helpers/fetch'

const TOKEN_KEY = 'taskflow.token'
const me = { status: 200, body: { id: 'u1', email: 'alice@example.com' } }
const task = (id: string, title: string, done = false) => ({ id, title, done, createdAt: '2026-01-01T00:00:00.000Z' })

type Routes = Parameters<typeof mockFetch>[0]

/** 저장된 토큰으로 로그인된 상태에서 App을 띄우고 목록이 그려질 때까지 기다린다. */
async function renderLoggedIn(routes: Routes) {
  localStorage.setItem(TOKEN_KEY, 'saved-token')
  const fetch = mockFetch({ 'GET /api/auth/me': me, ...routes })
  render(<App />)
  await screen.findByRole('heading', { name: '할 일' })
  return { fetch, user: userEvent.setup() }
}

const items = () => screen.queryAllByRole('listitem')
const titles = () => items().map((li) => li.textContent?.replace('삭제', '').trim())

beforeEach(() => localStorage.clear())

describe('할 일 목록', () => {
  it('로그인하면 토큰을 실어 내 할 일 목록을 불러와 보여준다', async () => {
    const { fetch } = await renderLoggedIn({
      'GET /api/tasks': { status: 200, body: [task('t1', '우유 사기'), task('t2', '운동하기', true)] },
    })

    await waitFor(() => expect(titles()).toEqual(['우유 사기', '운동하기']))
    expect(headersOf(fetch, 'GET /api/tasks').get('authorization')).toBe('Bearer saved-token')
    expect(screen.getByRole('checkbox', { name: '우유 사기' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: '운동하기' })).toBeChecked()
  })

  it('남은 할 일 개수를 보여준다', async () => {
    await renderLoggedIn({
      'GET /api/tasks': { status: 200, body: [task('t1', 'a'), task('t2', 'b', true), task('t3', 'c')] },
    })

    expect(await screen.findByText('남은 할 일 2개')).toBeInTheDocument()
  })

  it('할 일이 없으면 안내 문구를 보여준다', async () => {
    await renderLoggedIn({ 'GET /api/tasks': { status: 200, body: [] } })

    expect(await screen.findByText('아직 할 일이 없습니다')).toBeInTheDocument()
    expect(items()).toHaveLength(0)
  })

  it('목록을 불러오지 못하면 에러를 보여준다', async () => {
    await renderLoggedIn({ 'GET /api/tasks': { status: 500, body: { error: 'Internal' } } })

    expect(await screen.findByRole('alert')).toHaveTextContent('요청을 처리하지 못했습니다')
  })

  it('사용 중 토큰이 만료되면(401) 토큰을 지우고 로그인 폼으로 돌아간다', async () => {
    await renderLoggedIn({ 'GET /api/tasks': { status: 401, body: { error: 'Unauthorized' } } })

    expect(await screen.findByRole('heading', { name: '로그인' })).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})

describe('할 일 추가', () => {
  it('제목을 입력하고 추가하면 서버에 보내고 목록 끝에 붙인 뒤 입력칸을 비운다', async () => {
    const { fetch, user } = await renderLoggedIn({
      'GET /api/tasks': { status: 200, body: [task('t1', '우유 사기')] },
      'POST /api/tasks': { status: 201, body: task('t2', '운동하기') },
    })
    await waitFor(() => expect(items()).toHaveLength(1))

    await user.type(screen.getByLabelText('새 할 일'), '운동하기')
    await user.click(screen.getByRole('button', { name: '추가' }))

    await waitFor(() => expect(titles()).toEqual(['우유 사기', '운동하기']))
    expect(bodyOf(fetch, 'POST /api/tasks')).toEqual({ title: '운동하기' })
    expect(screen.getByLabelText('새 할 일')).toHaveValue('')
  })

  it('Enter 키로도 추가할 수 있다', async () => {
    const { user } = await renderLoggedIn({
      'GET /api/tasks': { status: 200, body: [] },
      'POST /api/tasks': { status: 201, body: task('t1', '우유 사기') },
    })

    await user.type(screen.getByLabelText('새 할 일'), '우유 사기{Enter}')

    await waitFor(() => expect(titles()).toEqual(['우유 사기']))
  })

  it('제목이 비어 있거나 공백뿐이면 추가 버튼이 비활성화된다', async () => {
    const { user } = await renderLoggedIn({ 'GET /api/tasks': { status: 200, body: [] } })

    expect(screen.getByRole('button', { name: '추가' })).toBeDisabled()
    await user.type(screen.getByLabelText('새 할 일'), '   ')
    expect(screen.getByRole('button', { name: '추가' })).toBeDisabled()
  })

  it('추가에 실패하면 에러를 보여주고 입력한 제목을 남겨 둔다', async () => {
    const { user } = await renderLoggedIn({
      'GET /api/tasks': { status: 200, body: [] },
      'POST /api/tasks': {
        status: 400,
        body: { error: 'ValidationError', issues: [{ path: 'title', message: '제목은 200자 이하여야 합니다' }] },
      },
    })

    await user.type(screen.getByLabelText('새 할 일'), '너무 긴 제목')
    await user.click(screen.getByRole('button', { name: '추가' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('제목은 200자 이하여야 합니다')
    expect(screen.getByLabelText('새 할 일')).toHaveValue('너무 긴 제목')
    expect(items()).toHaveLength(0)
  })
})

describe('할 일 완료 체크', () => {
  it('체크박스를 누르면 done을 서버에 보내고 체크 상태로 바꾼다', async () => {
    const { fetch, user } = await renderLoggedIn({
      'GET /api/tasks': { status: 200, body: [task('t1', '우유 사기')] },
      'PATCH /api/tasks/t1': { status: 200, body: task('t1', '우유 사기', true) },
    })

    await user.click(await screen.findByRole('checkbox', { name: '우유 사기' }))

    await waitFor(() => expect(screen.getByRole('checkbox', { name: '우유 사기' })).toBeChecked())
    expect(bodyOf(fetch, 'PATCH /api/tasks/t1')).toEqual({ done: true })
    expect(screen.getByText('남은 할 일 0개')).toBeInTheDocument()
  })

  it('완료된 할 일을 누르면 다시 미완료로 바꾼다', async () => {
    const { fetch, user } = await renderLoggedIn({
      'GET /api/tasks': { status: 200, body: [task('t1', '우유 사기', true)] },
      'PATCH /api/tasks/t1': { status: 200, body: task('t1', '우유 사기', false) },
    })

    await user.click(await screen.findByRole('checkbox', { name: '우유 사기' }))

    await waitFor(() => expect(screen.getByRole('checkbox', { name: '우유 사기' })).not.toBeChecked())
    expect(bodyOf(fetch, 'PATCH /api/tasks/t1')).toEqual({ done: false })
  })

  it('변경에 실패하면 원래 상태를 유지하고 에러를 보여준다', async () => {
    const { user } = await renderLoggedIn({
      'GET /api/tasks': { status: 200, body: [task('t1', '우유 사기')] },
      'PATCH /api/tasks/t1': { status: 404, body: { error: 'TaskNotFound' } },
    })

    await user.click(await screen.findByRole('checkbox', { name: '우유 사기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('할 일을 찾을 수 없습니다')
    expect(screen.getByRole('checkbox', { name: '우유 사기' })).not.toBeChecked()
  })
})

describe('할 일 삭제', () => {
  it('삭제 버튼을 누르면 서버에서 지우고 목록에서 뺀다', async () => {
    const { fetch, user } = await renderLoggedIn({
      'GET /api/tasks': { status: 200, body: [task('t1', '우유 사기'), task('t2', '운동하기')] },
      'DELETE /api/tasks/t1': { status: 204 },
    })
    await waitFor(() => expect(items()).toHaveLength(2))

    await user.click(within(items()[0]!).getByRole('button', { name: '우유 사기 삭제' }))

    await waitFor(() => expect(titles()).toEqual(['운동하기']))
    expect(fetch.mock.calls.some(([url, init]) => init?.method === 'DELETE' && url === '/api/tasks/t1')).toBe(true)
  })

  it('삭제에 실패하면 목록에 남겨 두고 에러를 보여준다', async () => {
    const { user } = await renderLoggedIn({
      'GET /api/tasks': { status: 200, body: [task('t1', '우유 사기')] },
      'DELETE /api/tasks/t1': { status: 404, body: { error: 'TaskNotFound' } },
    })

    await user.click(await screen.findByRole('button', { name: '우유 사기 삭제' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('할 일을 찾을 수 없습니다')
    expect(titles()).toEqual(['우유 사기'])
  })
})
