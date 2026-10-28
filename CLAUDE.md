# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트

TaskFlow — TDD 기반 할 일 관리 앱. npm workspaces 모노레포입니다. backend는 인증·할 일 API까지 동작하고, frontend는 셋업만 된 상태입니다.

| 워크스페이스 | 상태 | 스택 |
|---|---|---|
| `backend/` | 동작함 | Node + Hono + Drizzle ORM + better-sqlite3 + Zod, Vitest |
| `frontend/` | 셋업 완료 (화면은 제목뿐) | React 19 + Vite 8 + Tailwind 4, Vitest + Testing Library |
| `e2e/` | 미구현 (빈 디렉터리) | Playwright 예정 |

e2e는 아직 `package.json`이 없고 루트 `workspaces` 배열에도 없습니다. 셋업할 때 배열에 추가하세요.

### 런타임이 Node인 이유

Bun을 검토했으나 두 가지 이유로 Node로 확정했습니다. 되돌리려는 시도가 반복되지 않도록 기록합니다.

- 이 머신에 Bun이 설치되어 있지 않음 (Node v26)
- **`bun:sqlite`와 Vitest는 함께 쓸 수 없음** — Vitest는 Node 프로세스에서 돌기 때문에 Bun 전용 내장 모듈을 import할 수 없습니다. Bun으로 가려면 테스트 러너를 `bun test`로 바꿔야 합니다.

`node:sqlite`(Node 내장)도 동작하지만 drizzle-orm 0.45에 어댑터가 없어 `better-sqlite3`를 씁니다.

## 명령어

전부 검증된 값입니다. 루트에서 `--workspace @taskflow/backend`를 붙이거나 `backend/`에서 직접 실행합니다.

```bash
npm install                                   # 루트에서 1회

npm run dev        --workspace @taskflow/backend   # tsx watch, http://localhost:3000 (backend/.env를 읽음, JWT_SECRET 필수)
npm test           --workspace @taskflow/backend   # vitest run
npm run typecheck  --workspace @taskflow/backend   # tsc --noEmit

npm run dev:frontend                                 # vite, http://localhost:5173 (/api → 3000 프록시)
npm test           --workspace @taskflow/frontend   # vitest run (jsdom)
npm run build      --workspace @taskflow/frontend   # tsc --noEmit && vite build

# 단일 테스트
cd backend && npx vitest run tests/auth.test.ts
cd backend && npx vitest run -t '이미 등록된 이메일'   # 테스트 이름으로 필터
cd backend && npx vitest                              # watch 모드

# DB
npm run db:generate --workspace @taskflow/backend   # 스키마 변경 → drizzle/*.sql 생성
npm run db:migrate  --workspace @taskflow/backend   # 마이그레이션 적용
npm run db:studio   --workspace @taskflow/backend
```

`npm test`(루트)는 워크스페이스 전체를 순회합니다.

## backend 아키텍처

여러 파일을 읽어야 파악되는 부분만 적습니다.

### DB 주입 — `createApp(db, options)`

`src/app.ts`의 `createApp(db, { jwtSecret? })`는 **서버를 띄우지 않고 Hono 인스턴스만 돌려줍니다.** 서버 기동(`serve`)은
`src/index.ts`에만 있습니다. 이 분리 덕분에 테스트는 포트도 mock도 없이 `app.request('/api/...')`로
실제 라우터를 그대로 호출합니다.

`src/db/client.ts`의 `createDb(url)`은 URL을 인자로 받습니다. 테스트 헬퍼(`tests/helpers/db.ts`)가
`':memory:'`를 넘겨 **케이스마다 완전히 격리된 새 DB**를 만들고 마이그레이션까지 적용합니다.

새 라우트를 추가할 때 이 구조를 깨지 마세요 — 모듈 최상위에서 DB를 import하는 싱글턴을 만들면
테스트 격리가 무너집니다. 라우트 팩토리는 `authRoutes(db, { jwtSecret })`처럼 의존성을 인자로 받아 `Hono`를 반환합니다.
JWT 서명 키도 같은 방식입니다. 테스트는 `createApp(db, { jwtSecret: 'test-secret' })`로 넘기고,
생략하면 `process.env.JWT_SECRET`을 씁니다. `src/index.ts`는 키가 없으면 기동을 거부합니다.

### 검증 계약 — `src/lib/validate.ts`

Zod 검증은 `zValidator`를 직접 쓰지 말고 `validate('json', schema)` 래퍼를 쓰세요.
모든 검증 실패 응답 형태를 한 곳에서 고정합니다.

```
400 → { error: 'ValidationError', issues: [{ path: 'email', message: '...' }] }
409 → { error: 'EmailAlreadyRegistered' }
401 → { error: 'InvalidCredentials' }   # 로그인 실패. 비밀번호 오류와 없는 이메일을 구분하지 않음
401 → { error: 'Unauthorized' }         # requireAuth 실패
404 → { error: 'TaskNotFound' }         # 없거나 남의 할 일
```

`issues[].path`는 Zod의 배열 경로를 `.`으로 join한 문자열입니다.

### 비밀번호

`src/lib/password.ts`가 `node:crypto`의 scrypt만 씁니다(네이티브 의존성 없음).
저장 형태는 파라미터를 포함한 단일 문자열 `scrypt$<salt hex>$<key hex>`이며, 검증은 `timingSafeEqual`을 씁니다.

**응답에서 `passwordHash`를 지우는 방식으로 막지 마세요.** 라우트는 `.returning({ id, email, createdAt })`로
내보낼 컬럼만 명시적으로 고릅니다 — 해시가 새어 나갈 경로 자체를 없애는 방식입니다.

### 인증 — `POST /api/auth/login`

`hono/jwt`로 HS256 토큰(`sub` = 사용자 id, 7일 만료)을 발급합니다. 추가 의존성은 없습니다.
없는 이메일에도 더미 해시로 scrypt를 돌려 응답 시간으로 가입 여부가 드러나지 않게 합니다.
보호할 라우트에는 `src/middleware/auth.ts`의 `requireAuth(db, jwtSecret)`를 붙입니다.
`Authorization: Bearer <JWT>`를 검증해 `c.var.userId`를 채우며(타입은 `AuthEnv`), 서명 불일치·만료·`sub` 누락·
삭제된 사용자는 모두 `401 { error: 'Unauthorized' }`로 막습니다. 예시는 `GET /api/auth/me`.

### 마이그레이션

`src/db/schema.ts`를 고쳤으면 **반드시 `db:generate`를 돌려 `drizzle/`에 SQL을 만들어야 합니다.**
테스트는 이 폴더를 읽어 in-memory DB를 세우므로, 생성하지 않으면 스키마 변경이 테스트에 반영되지 않습니다.
`MIGRATIONS_FOLDER`는 `src/db/migrate.ts`가 export합니다.

### Drizzle + better-sqlite3는 동기다

`.get()` / `.all()` / `.run()`으로 끝나며 **`await`이 붙지 않습니다.** 다른 드라이버 예제를 그대로 가져오면
Promise가 남아 조용히 깨집니다.

```ts
const user = db.select().from(users).where(eq(users.email, email)).get()   // await 없음
```

## frontend 아키텍처

- `vite.config.ts` 하나가 빌드와 테스트 설정을 함께 가집니다(`vitest/config`의 `defineConfig`).
  별도 `vitest.config.ts`를 만들면 플러그인 설정이 갈라지니 만들지 마세요.
- 개발 서버는 `/api`를 `http://localhost:3000`으로 프록시합니다. 프론트 코드는 **상대 경로 `/api/...`로만**
  호출하세요 — 같은 출처라 backend에 CORS 설정이 필요 없습니다. backend를 함께 띄워야 합니다.
- Tailwind 4는 설정 파일이 없습니다. `@tailwindcss/vite` 플러그인과 `src/index.css`의 `@import "tailwindcss"`가 전부입니다.
- 테스트는 `tests/**/*.test.{ts,tsx}`, 환경은 jsdom입니다. `tests/setup.ts`가 jest-dom matcher
  (`toBeInTheDocument` 등)를 등록합니다. 요소는 `getByRole`로 찾습니다.
- 컴포넌트는 named export(`export function App`)를 씁니다.

## 작업 방식: TDD

프로젝트 이름이 곧 규칙입니다. 기능 요청을 받으면 구현부터 쓰지 말고:

1. 해당 워크스페이스 `tests/`에 실패하는 테스트를 먼저 작성 → 실행해 **red 확인**
2. 통과시키는 최소 구현
3. 리팩터링 후 재실행

### 테스트 규약

- Vitest `globals: true` — `describe`/`it`/`expect`/`beforeEach`를 **import 없이** 씁니다 (`vitest.config.ts`).
  타입은 tsconfig의 `types: ["vitest/globals"]`가 담당합니다.
- 파일 첫 줄에 경로 주석: `// backend/tests/auth.test.ts`, `// frontend/tests/App.test.tsx`
- `describe` 이름은 대상 엔드포인트 그대로: `POST /api/auth/register`
- 테스트 이름은 한국어 서술형: `'이미 등록된 이메일이면 409를 반환한다'`
- 상태 코드뿐 아니라 **DB에 실제로 무엇이 남았는지**까지 검증합니다 (예: 실패 요청이 사용자를 만들지 않는지)

## 도메인

`src/db/schema.ts`에 `users`와 `tasks`가 있습니다. `tasks.userId`는 `users.id`를 `onDelete: 'cascade'`로
참조하며 `foreign_keys = ON` pragma가 켜져 있습니다.

`src/routes/tasks.ts`가 `/api/tasks` CRUD를 제공하며 라우터 전체에 `requireAuth`가 걸려 있습니다.

- **모든 쿼리를 `id`와 `userId`로 함께 거릅니다**(`owned()`). 다른 사용자의 할 일은 403이 아니라
  `404 { error: 'TaskNotFound' }` — 존재 여부 자체를 숨깁니다.
- 소유자는 항상 `c.var.userId`(토큰)에서 정합니다. Zod `z.object`가 본문의 `userId` 같은 모르는 키를 버립니다.
- 응답 컬럼은 `id, title, done, createdAt` — `userId`는 내보내지 않습니다.
- 목록은 `createdAt, rowid` 순입니다(같은 ms에 생성돼도 삽입 순서 유지).
- 테스트 헬퍼 `tests/helpers/auth.ts`의 `signUp(app, email)`이 가입+로그인 후 `{ token, userId }`를 돌려줍니다.

## Git

원격은 `github.com/jephari78/taskflow` (public), `origin`은 SSH입니다.

- **이 네트워크는 SSH 22번 포트가 막혀 있습니다.** `~/.ssh/config`가 `github.com`을
  `ssh.github.com:443`으로 넘기도록 설정되어 있어 `git@github.com:...` 주소를 그대로 쓰면 됩니다.
  푸시가 `Operation timed out`으로 죽으면 이 설정이 사라졌는지 먼저 확인하세요.
- **커밋은 SSH 키로 자동 서명됩니다** (전역 `commit.gpgsign=true`, `gpg.format=ssh`).
  서명을 건너뛰려면 `--no-gpg-sign`을 붙입니다.
- 초기 4개 커밋은 서명 설정 이전이라 서명이 없습니다.
