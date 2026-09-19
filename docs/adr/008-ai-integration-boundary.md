# ADR-008: AI Integration Boundary

## Context

Add AI features (e.g., deal summary) without compromising security or reliability.

## Decision

**Isolated AI service with strict boundaries.**

Architecture:

```
Application use case
  → AI Service Interface
  → Provider Implementation (OpenAI)
  → Structured output (JSON schema)
  → Zod validation
  → Business rule validation
  → Persist
```

Constraints:

- AI never executes SQL or commands
- AI never changes permissions/membership
- Input: sanitized, limited context (no passwords, tokens, cross-org data)
- Output: validated before use
- Rate-limited per organization
- Audited

## Alternatives Considered

### AI as microservice

- **Pros**: Isolation
- **Cons**: Overhead for single feature

### LangChain / Agents

- **Pros**: Powerful abstractions
- **Cons**: Complexity, prompt injection surface, hard to audit

### Direct OpenAI calls in controllers

- **Pros**: Simple
- **Cons**: No validation, security risk, hard to test

## Consequences

**Positive:**

- Clear security boundary
- Testable with mock provider
- Provider swappable
- Failures don't crash CRM operations

**Negative:**

- More code than direct call
- Limited to well-defined use cases
- Additional latency
