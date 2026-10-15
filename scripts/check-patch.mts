/**
 * Structural check for a DSH cordis.patch.yml.
 *
 * DSH's own `yaml` dependency lives inside app.asar and cannot be required from
 * here, so this validates the shape the loader cares about instead: a top-level
 * sequence of mappings, each entry either id-targeted (`id` + optional `name` +
 * optional `config`) or an `insert` list of such entries, with consistent
 * indentation. It is a guard against a malformed edit, not a full YAML parser.
 */

import { readFileSync } from 'node:fs'

const path = process.argv[2]
if (!path) {
  console.error('usage: node check-patch.mts <cordis.patch.yml>')
  process.exit(1)
}

const lines = readFileSync(path, 'utf8').split('\n')
const errors: string[] = []
const entries: Array<{ line: number; id?: string; insert?: number }> = []

/** Indentation of a line, or -1 for blank/comment. */
function indentOf(line: string): number {
  if (!line.trim() || line.trim().startsWith('#')) return -1
  return line.length - line.trimStart().length
}

/** A top-level entry starts at column 0 with `- `. */
let current: { line: number; id?: string; insert?: number } | null = null
let insideInsert = false

for (let i = 0; i < lines.length; i += 1) {
  const raw = lines[i]
  const lineNo = i + 1
  const indent = indentOf(raw)
  if (indent === -1) continue
  const trimmed = raw.trim()

  if (indent === 0) {
    if (!trimmed.startsWith('- ')) {
      errors.push(`L${lineNo}: 顶层条目必须以 "- " 开头: ${JSON.stringify(trimmed.slice(0, 40))}`)
      continue
    }
    current = { line: lineNo }
    entries.push(current)
    insideInsert = false
    const body = trimmed.slice(2).trim()
    if (body === 'insert:') {
      insideInsert = true
      current.insert = 0
    } else if (body.startsWith('id:')) {
      current.id = body.slice(3).trim().replace(/^["']|["']$/g, '')
    }
    continue
  }

  if (!current) {
    errors.push(`L${lineNo}: 内容出现在任何顶层条目之前`)
    continue
  }

  if (insideInsert) {
    // Entries inside `insert:` are indented; a `- id:` there is a child entry.
    if (trimmed.startsWith('- ')) {
      current.insert = (current.insert ?? 0) + 1
      const body = trimmed.slice(2).trim()
      if (!body.startsWith('id:')) {
        errors.push(`L${lineNo}: insert 子条目应以 "id:" 开头: ${JSON.stringify(body.slice(0, 40))}`)
      }
    }
    continue
  }

  if (trimmed.startsWith('id:') && current.id === undefined) {
    current.id = trimmed.slice(3).trim().replace(/^["']|["']$/g, '')
  }
}

// Every entry needs a discriminator.
for (const entry of entries) {
  if (entry.id === undefined && entry.insert === undefined) {
    errors.push(`L${entry.line}: 条目既无 id 也无 insert`)
  }
}

// Ids must be unique.
const seen = new Map<string, number>()
for (const entry of entries) {
  if (entry.id === undefined) continue
  const prior = seen.get(entry.id)
  if (prior !== undefined) {
    errors.push(`L${entry.line}: id "${entry.id}" 与 L${prior} 重复`)
  } else {
    seen.set(entry.id, entry.line)
  }
}

if (errors.length > 0) {
  console.log(`✗ ${path} 结构校验失败:`)
  for (const e of errors) console.log('  ' + e)
  process.exit(1)
}

console.log(`✓ ${path} 结构合法`)
console.log(`  顶层条目: ${entries.length}`)
for (const entry of entries) {
  if (entry.insert !== undefined) console.log(`    L${entry.line}: insert (${entry.insert} 个子条目)`)
  else console.log(`    L${entry.line}: id=${entry.id}`)
}
