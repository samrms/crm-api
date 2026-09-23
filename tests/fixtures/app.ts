import { buildApp } from '../../src/app.js'
import { startTestDatabase, getTestDb } from './testDatabase.js'

let app: Awaited<ReturnType<typeof buildApp>> | null = null

export async function getApp() {
  if (!app) {
    await startTestDatabase()
    app = await buildApp()
  }
  return app
}

export function getDb() {
  return getTestDb()
}

export async function closeApp() {
  if (app) {
    await app.close()
    app = null
  }
}
