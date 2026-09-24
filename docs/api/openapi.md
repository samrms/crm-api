# OpenAPI documentation

Interactive documentation is served by the API itself:

| URL | What it serves |
| --- | --- |
| `/docs` | Swagger UI |
| `/docs/json` | the OpenAPI 3.0.3 document |
| `/docs/yaml` | the same document as YAML |

## How the document is authored

The spec is a **static, hand-written document** in
`src/shared/http/openapi/`, not a reflection of route objects:

| File | Contents |
| --- | --- |
| `helpers.ts` | schema and response builders (`data`, `page`, `jsonBody`, `err`, …) |
| `schemas.ts` | the 34 component schemas: entities, requests, errors, pagination |
| `paths.ts` | all 27 paths, with parameters, request bodies, and per-status responses |
| `index.ts` | assembles the document and exports the `@fastify/swagger` options |

`src/app.ts` registers it in `mode: 'static'`, and `/docs` is exempt from the
CSP headers that `@fastify/helmet` sets, so the UI can load.

## Why static

A generated document is only as good as the annotations on the handlers, and
annotations drift. Here the document is the specification: every operation
lists its real request shape, its real success payloads, and the error codes the
implementation can actually return. The cost is that a route change requires a
document change — which is the point, and it shows up in review.

## Keeping it accurate

- Adding an endpoint: add its path in `paths.ts`, its request/response schemas
  in `schemas.ts`, and a regression assertion if the behavior is subtle.
- A contract change that alters a response is a breaking change: update
  `schemas.ts` and the affected `paths.ts` entries in the same commit.
- `tests/integration/health.test.ts` asserts the document's shape (version,
  tags, a representative operation's response set, security scheme, and the
  `Error` schema), so a broken or empty document fails the suite.

## Coverage

All endpoints are documented, including the operational ones: `/`, `/health`,
`/ready`, and `/metrics`. `sessionCookie` is declared in
`components.securitySchemes` and applied to every protected operation; the
register and login operations intentionally carry no security requirement.
