/**
 * Guards against drift between .github/workflows/ci.yml and package.json.
 *
 * The pre-push gate runs package scripts, not the workflow, so renaming or
 * deleting a script would keep every local gate green while CI started failing
 * with "script not found". This reads the workflow and fails early instead.
 *
 * Only the CI -> package direction is checked: a script CI does not use (a
 * local-only helper such as `seed`) is legitimate, a script CI uses but
 * package.json lacks is a broken pipeline.
 *
 * Run by the pre-push gate. No dependencies: Bun parses the YAML.
 */
import { readFileSync } from 'node:fs'

const WORKFLOW = '.github/workflows/ci.yml'
const PACKAGE = 'package.json'

interface Workflow {
  jobs?: Record<string, { steps?: { run?: string }[] }>
}

type Scripts = Record<string, string>

function main(): void {
  const workflow = Bun.YAML.parse(
    readFileSync(WORKFLOW, 'utf8'),
  ) as Workflow
  const pkg = JSON.parse(readFileSync(PACKAGE, 'utf8')) as {
    scripts: Scripts
  }

  const used = new Set<string>()
  for (const job of Object.values(workflow.jobs ?? {})) {
    for (const step of job?.steps ?? []) {
      for (const [, name] of (step.run ?? '').matchAll(/bun run (\S+)/g)) {
        used.add(name)
      }
    }
  }

  if (used.size === 0) {
    fail(`no "bun run" step found in ${WORKFLOW}; the workflow format changed`)
  }

  const missing = [...used].filter((name) => !(name in pkg.scripts)).sort()
  if (missing.length > 0) {
    fail(
      `${WORKFLOW} runs scripts that ${PACKAGE} does not define:\n` +
        missing.map((name) => `  - ${name}`).join('\n') +
        `\nCI would fail with "script not found". Fix the name or restore the script.`,
    )
  }

  console.log(
    `ci:check: ${used.size} scripts referenced by ci.yml exist in package.json (${[...used].sort().join(', ')})`,
  )
}

function fail(message: string): never {
  console.error(`ci:check: ${message}`)
  process.exit(1)
}

main()
