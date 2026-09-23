# Architecture / Modules

Modules (independent deploy units):
- users: auth, login, register, password reset
- crm: companies, contacts, leads, deals
- bulk: exports, imports
- engagement: tasks, activities
- organizations: members, audit, organization management
- shared: database, auth, config, logging, pagination

Each module has: application/, infrastructure/, http/, domain/ (where needed).

Distributed readiness:
- Each folder (users, crm, bulk, engagement, organizations) has its own application/, infrastructure/, http/ — ready for independent deployment.
- Shared/ provides cross-cutting services (DB connection, auth utils, logging, pagination, errors).
- Container (buildContainer) wires modules together for monolith mode, or can be split per module for service mode.
