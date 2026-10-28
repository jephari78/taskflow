import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError, type Task } from '../api'

type Props = { token: string; onUnauthorized: () => void }

/** 서버가 성공을 응답한 뒤에만 화면을 바꾼다 — 실패하면 화면은 그대로 두고 에러만 보여준다. */
export function TaskList({ token, onUnauthorized }: Props) {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  function fail(err: unknown) {
    if (err instanceof ApiError && err.status === 401) return onUnauthorized()
    setError(err instanceof ApiError ? err.message : '알 수 없는 오류가 발생했습니다')
  }

  useEffect(() => {
    let cancelled = false
    api
      .listTasks(token)
      .then((list) => !cancelled && setTasks(list))
      .catch((err) => !cancelled && fail(err))
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setError(null)
    setAdding(true)
    try {
      const created = await api.createTask(token, trimmed)
      setTasks((prev) => [...(prev ?? []), created])
      setTitle('')
    } catch (err) {
      fail(err)
    } finally {
      setAdding(false)
    }
  }

  async function handleToggle(task: Task) {
    setError(null)
    try {
      const updated = await api.updateTask(token, task.id, { done: !task.done })
      setTasks((prev) => prev?.map((t) => (t.id === updated.id ? updated : t)) ?? null)
    } catch (err) {
      fail(err)
    }
  }

  async function handleDelete(task: Task) {
    setError(null)
    try {
      await api.deleteTask(token, task.id)
      setTasks((prev) => prev?.filter((t) => t.id !== task.id) ?? null)
    } catch (err) {
      fail(err)
    }
  }

  const remaining = tasks?.filter((t) => !t.done).length ?? 0

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold text-slate-900">할 일</h2>
        {tasks && <span className="text-sm text-slate-500">남은 할 일 {remaining}개</span>}
      </div>

      <form onSubmit={handleAdd} className="mb-4 flex gap-2">
        <label htmlFor="new-task" className="sr-only">
          새 할 일
        </label>
        <input
          id="new-task"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="무엇을 해야 하나요?"
          maxLength={200}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
        <button
          type="submit"
          disabled={adding || !title.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          추가
        </button>
      </form>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {tasks === null && !error && <p className="py-6 text-center text-slate-500">불러오는 중…</p>}
      {tasks?.length === 0 && <p className="py-6 text-center text-slate-500">아직 할 일이 없습니다</p>}

      {tasks && tasks.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {tasks.map((task) => (
            <li key={task.id} className="group flex items-center gap-3 py-2">
              <label className="flex flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => handleToggle(task)}
                  className="size-4 accent-indigo-600"
                />
                <span className={task.done ? 'text-slate-400 line-through' : 'text-slate-800'}>{task.title}</span>
              </label>
              <button
                type="button"
                onClick={() => handleDelete(task)}
                aria-label={`${task.title} 삭제`}
                className="rounded px-2 py-1 text-sm text-slate-400 opacity-0 hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
