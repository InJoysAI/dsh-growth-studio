/**
 * Global test isolation guard.
 *
 * ⚠️ INCIDENT BACKGROUND: `ConfigStore` resolves its on-disk path via `resolveDshHome()`,
 * which falls back to the developer's REAL `$DSH_HOME` (usually `~/.dsh`). A test that
 * constructed `new ConfigStore(undefined, {...})` and called `.save()` therefore wrote to
 * the real user configuration — a test run actually overwrote
 * `~/.dsh/ops-manager/config.json` with a temporary `draftsDir` that was deleted
 * afterwards, leaving the host config pointing at a dead path.
 *
 * ⚠️ WHY THIS IS ASSIGNED AT MODULE SCOPE, NOT IN `beforeAll`:
 * a `beforeAll` hook does not run until *after* the test file has been imported and its
 * suites collected. A spec that captures `process.env.DSH_HOME` at describe scope during
 * collection would read the un-isolated entry value, and any `afterEach` restoring that
 * captured value would silently put the real home back for every later suite. Assigning
 * here — setup files are evaluated before the test file is imported — means collection
 * already sees the isolated directory, so no capture/restore can resurrect the real one.
 *
 * It is a backstop, not a substitute for tests being explicit about their paths.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Isolated home for the whole test file. Never the developer's real home. */
const isolatedDshHome = mkdtempSync(join(tmpdir(), 'growth-studio-test-home-'))

// Assigned during setup-file evaluation, i.e. BEFORE the test file is imported/collected.
process.env.DSH_HOME = isolatedDshHome

// Fail loudly if isolation ever regresses: a spec must never see a home outside tmp.
if (!isolatedDshHome.startsWith(tmpdir())) {
  throw new Error(`Test isolation broken: refusing to use DSH_HOME=${isolatedDshHome}`)
}

process.on('exit', () => {
  try {
    rmSync(isolatedDshHome, { recursive: true, force: true })
  } catch {
    // Best-effort cleanup; a leftover temp dir must not fail the run.
  }
})
