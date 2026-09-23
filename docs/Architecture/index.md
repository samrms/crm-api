# Architecture — Distributed Modular Monolith

Modules are isolated and can become independent services:
- users (auth service)
- crm (company/contact/lead/deal service)
- bulk (import/export service)
- engagement (task/activity service)
- organizations (org/member/audit service)
- shared (common DB, auth, logging, cache)

Deployment: each module deployable separately via Docker.
Database: PostgreSQL shared (or split by module if needed).
Queue: BullMQ + Redis (shared queue layer).
