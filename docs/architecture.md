# Architecture

Modular monolith. Each module can be split.

Entry: src/app.ts (Fastify), src/container.ts (DI)
DB: PostgreSQL (Kysely)
Queue: BullMQ + Redis
Auth: session cookie
Modules: users, crm, bulk, engagement, organizations, shared
