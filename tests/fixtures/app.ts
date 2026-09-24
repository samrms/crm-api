import { Application } from '../../src/app.js'
import type { FastifyInstance } from 'fastify'
import { startTestDatabase } from './testDatabase.js'

export async function buildTestApp(): Promise<FastifyInstance> {
  await startTestDatabase()
  return new Application().build()
}
