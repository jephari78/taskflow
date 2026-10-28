import { expect, type Page } from '@playwright/test'

export const PASSWORD = 'correct-horse'

/** 테스트끼리 병렬로 돌아도 겹치지 않는 이메일 */
export const uniqueEmail = (name: string) => `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`

export async function register(page: Page, email: string, password = PASSWORD) {
  await page.goto('/')
  await page.getByRole('button', { name: '계정이 없나요? 회원가입' }).click()
  await page.getByLabel('이메일').fill(email)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '회원가입' }).click()
  await expect(page.getByText(`${email} 님, 환영합니다`)).toBeVisible()
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel('이메일').fill(email)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
}

export async function addTask(page: Page, title: string) {
  await page.getByLabel('새 할 일').fill(title)
  await page.getByLabel('새 할 일').press('Enter')
  await expect(page.getByRole('checkbox', { name: title })).toBeVisible()
}
