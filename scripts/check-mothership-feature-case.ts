#!/usr/bin/env bun
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { getErrorMessage } from '@sim/utils/errors'

type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

const ROOT = process.cwd()
const VALID_CASE_DIR = resolve(ROOT, 'scripts/fixtures/mothership-feature-cases/valid')
const INVALID_CASE_DIR = resolve(ROOT, 'scripts/fixtures/mothership-feature-cases/invalid')

const STATES = new Set([
  'INTAKE',
  'REPO_STATE_VERIFIED',
  'CHARTERED',
  'ORCHESTRATED',
  'IMPLEMENTED',
  'VERIFIED',
  'REVIEWED',
  'GRADED',
  'ITERATE',
  'BLOCKED',
  'REJECTED',
  'LEDGERED',
  'PROMOTED_OR_NONPROMOTED_CLOSED',
  'NEXT_SLICE_SELECTED',
])

const CLOSED_STATES = new Set(['PROMOTED_OR_NONPROMOTED_CLOSED', 'NEXT_SLICE_SELECTED'])
const DECISIONS = new Set([
  'PROMOTE',
  'CLOSE_SAFE_PARTIAL',
  'ITERATE',
  'BLOCKED',
  'REJECT_OR_REVERT',
])
const GRADES = new Set(['A', 'B', 'C', 'D', 'F'])
const REVIEW_TYPES = ['spec', 'code', 'evidence'] as const
const GRADE_VALUE: Record<Grade, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 }
const REQUIRED_CLOSED_GATES = ['F0', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'] as const

interface ClaimPattern {
  label: string
  pattern: RegExp
}

const FORBIDDEN_CLAIMS: ClaimPattern[] = [
  {
    label: 'replacement complete',
    pattern:
      /\b(replacement complete|complete(?:d)? (?:the )?(?:owned )?mothership replacement)\b/i,
  },
  {
    label: 'production ready',
    pattern: /\b(production ready|ready for production|prod(?:uction)? complete)\b/i,
  },
  {
    label: 'hosted fallback removed',
    pattern:
      /\b(hosted fallback removed|removed hosted fallback|cut(?:over)? away from hosted fallback)\b/i,
  },
  {
    label: 'browser/provider E2E proven',
    pattern:
      /\b(browser[/-]?provider e2e proven|real provider e2e proven|browser e2e (?:passed|complete|done)|provider e2e (?:passed|complete|done))\b/i,
  },
  {
    label: 'Docker image proof',
    pattern:
      /\b(docker (?:build|push) proven|docker image (?:built|pushed|proven)|image push proven)\b/i,
  },
  {
    label: 'Kubernetes smoke proof',
    pattern:
      /\b(kubernetes smoke proven|k8s smoke proven|live k8s (?:passed|proven|complete)|live kubernetes (?:passed|proven|complete))\b/i,
  },
  {
    label: 'CliProxyAPI workflow subagent support',
    pattern: /\bcliproxyapi workflow subagent callbacks supported\b/i,
  },
  {
    label: 'billing finality',
    pattern: /\b(billing final|billing complete|pricing final)\b/i,
  },
  {
    label: 'phase 3 control plane complete',
    pattern: /\bphase 3 (?:product )?control plane complete\b/i,
  },
]

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.flatMap((item) => stringValue(item) ?? []) : []
}

function normalizeActor(value: string): string {
  return value.trim().toLowerCase()
}

function jsonFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => join(dir, entry.name))
    .sort()
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8')) as unknown
}

function includesText(haystack: string[], needle: string): boolean {
  const normalizedNeedle = needle.toLowerCase()
  return haystack.some((item) => item.toLowerCase() === normalizedNeedle)
}

function hasPassedCommand(
  commands: Array<Record<string, unknown> | undefined>,
  cmd: string
): boolean {
  return commands.some(
    (command) => command?.result === 'passed' && stringValue(command.cmd) === cmd
  )
}

function hasPassedVerificationCommand(
  commands: Array<Record<string, unknown> | undefined>
): boolean {
  return commands.some((command) => {
    const cmd = stringValue(command?.cmd)
    return (
      command?.result === 'passed' &&
      cmd !== 'pwd' &&
      cmd !== 'git status --short --branch' &&
      /\b(bun|bunx|vitest|tsc|biome|test|check|lint|type-check|playwright)\b/.test(cmd ?? '')
    )
  })
}

function addMissingString(
  errors: string[],
  record: Record<string, unknown>,
  field: string,
  label = field
): void {
  if (!stringValue(record[field])) errors.push(`${label} must be a non-empty string`)
}

function addMissingStringArray(
  errors: string[],
  record: Record<string, unknown>,
  field: string,
  label = field
): void {
  if (stringArray(record[field]).length === 0) {
    errors.push(`${label} must include at least one string`)
  }
}

function validateRepo(errors: string[], repo: Record<string, unknown> | undefined): void {
  if (!repo) {
    errors.push('repo is required')
    return
  }

  for (const field of ['workspace', 'root', 'branch', 'head', 'statusShortBranch']) {
    addMissingString(errors, repo, field, `repo.${field}`)
  }
  if (typeof repo.dirtyOverlap !== 'boolean') {
    errors.push('repo.dirtyOverlap must be boolean')
  }
}

function validateCharter(errors: string[], charter: Record<string, unknown> | undefined): void {
  if (!charter) {
    errors.push('charter is required')
    return
  }

  addMissingString(errors, charter, 'objective', 'charter.objective')
  for (const field of [
    'nonObjectives',
    'invariants',
    'proofRequired',
    'stopRules',
    'expectedNonClaims',
  ]) {
    addMissingStringArray(errors, charter, field, `charter.${field}`)
  }
}

function validateOrchestration(
  errors: string[],
  orchestration: Record<string, unknown> | undefined
): { roleSeparated: boolean; reviewers: Set<string> } {
  if (!orchestration) {
    errors.push('orchestration is required')
    return { roleSeparated: false, reviewers: new Set() }
  }

  addMissingString(errors, orchestration, 'owner', 'orchestration.owner')
  addMissingStringArray(errors, orchestration, 'workers', 'orchestration.workers')
  addMissingStringArray(errors, orchestration, 'reviewers', 'orchestration.reviewers')
  addMissingString(errors, orchestration, 'grader', 'orchestration.grader')
  if (typeof orchestration.roleSeparated !== 'boolean') {
    errors.push('orchestration.roleSeparated must be boolean')
    return { roleSeparated: false, reviewers: new Set() }
  }

  const owner = stringValue(orchestration.owner)
  const grader = stringValue(orchestration.grader)
  const workers = stringArray(orchestration.workers)
  const reviewers = stringArray(orchestration.reviewers)
  const roleGroups = [
    ['owner', owner ? [owner] : []],
    ['worker', workers],
    ['reviewer', reviewers],
    ['grader', grader ? [grader] : []],
  ] as const
  const seen = new Map<string, string[]>()
  for (const [role, actors] of roleGroups) {
    for (const actor of actors) {
      const key = normalizeActor(actor)
      seen.set(key, [...(seen.get(key) ?? []), role])
    }
  }
  if (orchestration.roleSeparated === true) {
    for (const [actor, roles] of seen) {
      if (new Set(roles).size > 1) {
        errors.push(
          `orchestration.roleSeparated=true but actor appears in multiple roles: ${actor}`
        )
      }
    }
  }

  return {
    roleSeparated: orchestration.roleSeparated,
    reviewers: new Set(reviewers.map(normalizeActor)),
  }
}

function validateEvidence(errors: string[], evidence: Record<string, unknown> | undefined): void {
  if (!evidence) {
    errors.push('evidence is required')
    return
  }

  const commands = Array.isArray(evidence.commands) ? evidence.commands : []
  if (commands.length === 0) {
    errors.push('evidence.commands must include at least one command')
    return
  }

  for (const [index, value] of commands.entries()) {
    const command = asRecord(value)
    if (!command) {
      errors.push(`evidence.commands[${index}] must be object`)
      continue
    }
    addMissingString(errors, command, 'cmd', `evidence.commands[${index}].cmd`)
    if (
      command.result !== 'passed' &&
      command.result !== 'failed' &&
      command.result !== 'blocked'
    ) {
      errors.push(`evidence.commands[${index}].result must be passed, failed, or blocked`)
    }
    addMissingStringArray(errors, command, 'proves', `evidence.commands[${index}].proves`)
  }
}

function validateReviews(errors: string[], reviews: unknown, reviewers: Set<string>): boolean {
  const reviewList = Array.isArray(reviews) ? reviews : []
  if (reviewList.length === 0) {
    errors.push('reviews must include spec, code, and evidence reviews')
    return false
  }

  let selfReview = false
  for (const type of REVIEW_TYPES) {
    const review = reviewList.map(asRecord).find((item) => item?.type === type)
    if (!review) {
      errors.push(`reviews must include ${type} review`)
      continue
    }
    const reviewer = stringValue(review.reviewer)
    if (!reviewer) {
      errors.push(`${type} review reviewer must be a non-empty string`)
    } else if (!reviewers.has(normalizeActor(reviewer))) {
      errors.push(`${type} review reviewer must be listed in orchestration.reviewers`)
    }
    if (review.status !== 'pass' && review.status !== 'fail' && review.status !== 'self_review') {
      errors.push(`${type} review status must be pass, fail, or self_review`)
    }
    if (review.status === 'fail') errors.push(`${type} review failed`)
    if (review.status === 'self_review') selfReview = true
  }

  return selfReview
}

function validateGateEvidence(
  errors: string[],
  gateEvidence: Record<string, unknown> | undefined,
  commands: Array<Record<string, unknown> | undefined>,
  state: string | undefined
): void {
  if (!state || !CLOSED_STATES.has(state)) return
  if (!gateEvidence) {
    errors.push('closed cases require gateEvidence')
    return
  }

  for (const gate of REQUIRED_CLOSED_GATES) {
    const sources = stringArray(gateEvidence[gate])
    if (sources.length === 0) {
      errors.push(`closed cases require gateEvidence.${gate}`)
      continue
    }
    for (const source of sources) {
      if (!/^(cmd|field|diff|review|grade|ledger|artifact|subagent|oracle):/.test(source)) {
        errors.push(`gateEvidence.${gate} source must have a recognized prefix: ${source}`)
      }
      if (source.startsWith('cmd:')) {
        const cmd = source.slice('cmd:'.length).trim()
        if (!hasPassedCommand(commands, cmd)) {
          errors.push(`gateEvidence.${gate} references missing passed command: ${cmd}`)
        }
      }
    }
  }

  if (!hasPassedCommand(commands, 'pwd')) {
    errors.push('F0 gate requires passed pwd command')
  }
  if (!hasPassedCommand(commands, 'git status --short --branch')) {
    errors.push('F0 gate requires passed git status --short --branch command')
  }
  if (!hasPassedVerificationCommand(commands)) {
    errors.push('F4 gate requires at least one passed focused verification command')
  }
}

function isNegatedClaimContext(text: string): boolean {
  return /\b(not|no|never|without|blocked|deferred|unavailable|missing|future|cannot|can't|do not|does not|unproven|open|remaining)\b/i.test(
    text
  )
}

function collectClaimTexts(
  record: Record<string, unknown>,
  charter: Record<string, unknown> | undefined,
  evidence: Record<string, unknown> | undefined,
  grade: Record<string, unknown> | undefined
): Array<{ path: string; text: string }> {
  const texts: Array<{ path: string; text: string }> = []
  const add = (path: string, value: unknown): void => {
    const text = stringValue(value)
    if (text) texts.push({ path, text })
  }
  const addArray = (path: string, value: unknown): void => {
    for (const [index, text] of stringArray(value).entries()) {
      texts.push({ path: `${path}[${index}]`, text })
    }
  }

  add('charter.objective', charter?.objective)
  addArray('charter.invariants', charter?.invariants)
  addArray('charter.proofRequired', charter?.proofRequired)
  addArray('grade.claimsAdvanced', grade?.claimsAdvanced)
  add('nextAction', record.nextAction)

  const commands = Array.isArray(evidence?.commands) ? evidence.commands.map(asRecord) : []
  for (const [commandIndex, command] of commands.entries()) {
    for (const [proveIndex, text] of stringArray(command?.proves).entries()) {
      texts.push({ path: `evidence.commands[${commandIndex}].proves[${proveIndex}]`, text })
    }
  }

  const reviews = Array.isArray(record.reviews) ? record.reviews.map(asRecord) : []
  for (const [reviewIndex, review] of reviews.entries()) {
    for (const [findingIndex, text] of stringArray(review?.findings).entries()) {
      texts.push({ path: `reviews[${reviewIndex}].findings[${findingIndex}]`, text })
    }
  }

  return texts
}

function validateForbiddenClaims(
  errors: string[],
  texts: Array<{ path: string; text: string }>
): void {
  for (const { path, text } of texts) {
    if (isNegatedClaimContext(text)) continue
    for (const { label, pattern } of FORBIDDEN_CLAIMS) {
      if (pattern.test(text)) {
        errors.push(`forbidden ${label} claim in ${path}: ${text}`)
      }
    }
  }
}

function validateGrade(errors: string[], grade: Record<string, unknown> | undefined): Grade | null {
  if (!grade) {
    errors.push('grade is required')
    return null
  }

  if (!DECISIONS.has(String(grade.decision))) {
    errors.push('grade.decision is invalid')
  }
  if (!GRADES.has(String(grade.grade))) {
    errors.push('grade.grade is invalid')
    return null
  }
  addMissingString(errors, grade, 'capReason', 'grade.capReason')
  addMissingStringArray(errors, grade, 'claimsAdvanced')
  addMissingStringArray(errors, grade, 'nonClaims')
  return grade.grade as Grade
}

function validateLedger(errors: string[], ledger: Record<string, unknown> | undefined): void {
  if (!ledger) {
    errors.push('ledger is required')
    return
  }

  if (ledger.coverageAuditUpdated !== true) {
    errors.push('ledger.coverageAuditUpdated must be true')
  }
  const handoffPath = stringValue(ledger.handoffPath)
  if (!handoffPath || !/sim-mothership.*handoff.*\.md$/.test(handoffPath)) {
    errors.push('ledger.handoffPath must point to a timestamped Sim Mothership handoff')
  }
  if (ledger.redactionAudit !== true) {
    errors.push('ledger.redactionAudit must be true')
  }
}

export function validateCase(file: string, value: unknown): string[] {
  const errors: string[] = []
  const record = asRecord(value)
  if (!record) return ['feature case must be a JSON object']

  addMissingString(errors, record, 'id')
  if (!STATES.has(String(record.state))) errors.push('state is invalid')

  const repo = asRecord(record.repo)
  const charter = asRecord(record.charter)
  const orchestration = asRecord(record.orchestration)
  const evidence = asRecord(record.evidence)
  const grade = asRecord(record.grade)
  const ledger = asRecord(record.ledger)
  const state = stringValue(record.state)

  validateRepo(errors, repo)
  validateCharter(errors, charter)
  const { roleSeparated, reviewers } = validateOrchestration(errors, orchestration)
  validateEvidence(errors, evidence)
  const commands = Array.isArray(evidence?.commands) ? evidence.commands.map(asRecord) : []
  validateGateEvidence(errors, asRecord(record.gateEvidence), commands, state)
  const selfReview = validateReviews(errors, record.reviews, reviewers)
  const gradeValue = validateGrade(errors, grade)
  validateLedger(errors, ledger)

  const expectedNonClaims = stringArray(charter?.expectedNonClaims)
  const nonClaims = stringArray(grade?.nonClaims)
  for (const expected of expectedNonClaims) {
    if (!includesText(nonClaims, expected)) {
      errors.push(`expected non-claim missing from grade.nonClaims: ${expected}`)
    }
  }

  if (repo?.dirtyOverlap === true && state && CLOSED_STATES.has(state)) {
    errors.push('closed cases cannot have repo.dirtyOverlap=true')
  }

  const failedCommands = commands.filter((command) => command?.result === 'failed')
  const blockedCommands = commands.filter((command) => command?.result === 'blocked')
  const decision = stringValue(grade?.decision)
  if (failedCommands.length > 0 && decision !== 'ITERATE' && decision !== 'REJECT_OR_REVERT') {
    errors.push('failed commands require ITERATE or REJECT_OR_REVERT decision')
  }
  if (blockedCommands.length > 0 && stringArray(record.blockers).length === 0) {
    errors.push('blocked commands require blockers')
  }
  if (blockedCommands.length > 0 && decision === 'PROMOTE') {
    errors.push('blocked commands cannot produce PROMOTE decision')
  }

  validateForbiddenClaims(errors, collectClaimTexts(record, charter, evidence, grade))

  if ((!roleSeparated || selfReview) && gradeValue && GRADE_VALUE[gradeValue] > GRADE_VALUE.C) {
    errors.push('missing separated review caps grade at C')
  }

  if (state && CLOSED_STATES.has(state) && ledger?.coverageAuditUpdated !== true) {
    errors.push('closed cases must update coverage audit')
  }

  if (!stringValue(record.nextAction)) errors.push('nextAction must be a non-empty string')

  return errors.map((error) => `${basename(file)}: ${error}`)
}

function validateExpectedValid(file: string): void {
  const errors = validateCase(file, readJson(file))
  if (errors.length > 0) {
    throw new Error(errors.join('\n'))
  }
  console.log(`${basename(file)}: valid feature case`)
}

function validateExpectedInvalid(file: string): void {
  const value = readJson(file)
  const expectedErrors = stringArray(asRecord(value)?.expectedErrors)
  if (expectedErrors.length === 0) {
    throw new Error(`${basename(file)} must declare expectedErrors`)
  }

  const errors = validateCase(file, value)
  if (errors.length === 0) {
    throw new Error(`${basename(file)} unexpectedly passed validation`)
  }
  for (const expectedError of expectedErrors) {
    if (!errors.some((error) => error.includes(expectedError))) {
      throw new Error(
        `${basename(file)} did not fail for expected reason "${expectedError}"\nActual errors:\n${errors.join('\n')}`
      )
    }
  }
  console.log(`${basename(file)}: rejected as expected (${expectedErrors.join('; ')})`)
}

function runDefaultFixtures(): void {
  for (const file of jsonFiles(VALID_CASE_DIR)) {
    validateExpectedValid(file)
  }
  for (const file of jsonFiles(INVALID_CASE_DIR)) {
    validateExpectedInvalid(file)
  }
}

function runFiles(files: string[]): void {
  for (const file of files) {
    validateExpectedValid(resolve(file))
  }
}

function main(): void {
  const files = process.argv.slice(2)
  if (files.length === 0) {
    runDefaultFixtures()
  } else {
    runFiles(files)
  }
}

try {
  if (process.argv[1] && basename(process.argv[1]) === 'check-mothership-feature-case.ts') {
    main()
  }
} catch (error) {
  console.error(getErrorMessage(error))
  process.exitCode = 1
}
