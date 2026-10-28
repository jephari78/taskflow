// e2e/tests/flow.spec.ts
import { expect, test } from '@playwright/test'
import { addTask, login, register, uniqueEmail } from './helpers'

test('회원가입부터 할 일 관리, 로그아웃 후 재로그인까지 전체 흐름이 동작한다', async ({ page }) => {
  const email = uniqueEmail('flow')

  // 가입하면 바로 로그인되어 빈 목록을 본다
  await register(page, email)
  await expect(page.getByText('아직 할 일이 없습니다')).toBeVisible()

  // 추가
  await addTask(page, '우유 사기')
  await addTask(page, '운동하기')
  await addTask(page, '책 읽기')
  await expect(page.getByRole('listitem')).toHaveText([/우유 사기/, /운동하기/, /책 읽기/])
  await expect(page.getByText('남은 할 일 3개')).toBeVisible()

  // 완료 체크 — 화면은 서버 응답 후에 체크되므로 check() 대신 click() 후 기다린다
  await page.getByRole('checkbox', { name: '운동하기' }).click()
  await expect(page.getByRole('checkbox', { name: '운동하기' })).toBeChecked()
  await expect(page.getByText('남은 할 일 2개')).toBeVisible()

  // 삭제
  await page.getByRole('button', { name: '책 읽기 삭제' }).click()
  await expect(page.getByRole('listitem')).toHaveCount(2)

  // 새로고침해도 로그인과 데이터가 유지된다 (서버 DB + 저장된 토큰)
  await page.reload()
  await expect(page.getByText(`${email} 님, 환영합니다`)).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveText([/우유 사기/, /운동하기/])
  await expect(page.getByRole('checkbox', { name: '운동하기' })).toBeChecked()

  // 로그아웃하면 로그인 폼으로, 새로고침해도 로그인 상태로 돌아가지 않는다
  await page.getByRole('button', { name: '로그아웃' }).click()
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()

  // 다시 로그인하면 같은 데이터가 보인다
  await login(page, email)
  await expect(page.getByRole('listitem')).toHaveText([/우유 사기/, /운동하기/])
  await expect(page.getByText('남은 할 일 1개')).toBeVisible()
})

test('틀린 비밀번호로는 로그인할 수 없다', async ({ page }) => {
  const email = uniqueEmail('wrong')
  await register(page, email)
  await page.getByRole('button', { name: '로그아웃' }).click()

  await login(page, email, 'wrong-password')

  await expect(page.getByRole('alert')).toHaveText('이메일 또는 비밀번호가 올바르지 않습니다')
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()
})

test('이미 가입된 이메일로는 다시 가입할 수 없다', async ({ page }) => {
  const email = uniqueEmail('dup')
  await register(page, email)
  await page.getByRole('button', { name: '로그아웃' }).click()

  await page.getByRole('button', { name: '계정이 없나요? 회원가입' }).click()
  await page.getByLabel('이메일').fill(email)
  await page.getByLabel('비밀번호').fill('another-password')
  await page.getByRole('button', { name: '회원가입' }).click()

  await expect(page.getByRole('alert')).toHaveText('이미 가입된 이메일입니다')
  await expect(page.getByRole('heading', { name: '회원가입' })).toBeVisible()
})

test('짧은 비밀번호로는 가입할 수 없다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '계정이 없나요? 회원가입' }).click()
  await page.getByLabel('이메일').fill(uniqueEmail('short'))
  await page.getByLabel('비밀번호').fill('short')
  await page.getByRole('button', { name: '회원가입' }).click()

  await expect(page.getByRole('alert')).toHaveText('비밀번호는 8자 이상이어야 합니다')
})

test('다른 사용자의 할 일은 보이지 않는다', async ({ browser }) => {
  // 브라우저 컨텍스트를 나눠 두 사용자가 동시에 쓰는 상황을 만든다 (localStorage 분리)
  const alice = await (await browser.newContext()).newPage()
  const bob = await (await browser.newContext()).newPage()

  await register(alice, uniqueEmail('alice'))
  await addTask(alice, '앨리스의 비밀 할 일')

  await register(bob, uniqueEmail('bob'))
  await expect(bob.getByText('아직 할 일이 없습니다')).toBeVisible()
  await expect(bob.getByText('앨리스의 비밀 할 일')).toHaveCount(0)

  await bob.reload()
  await expect(bob.getByText('앨리스의 비밀 할 일')).toHaveCount(0)
})
