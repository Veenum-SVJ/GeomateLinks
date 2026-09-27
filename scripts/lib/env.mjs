// Minimal .env.local loader shared by the maintenance scripts (the repo has
// no dotenv dependency). Values already present in the real environment win,
// so CI/shell overrides always take precedence over the file.
import { readFileSync } from 'node:fs'

export function loadEnv(path = new URL('../../.env.local', import.meta.url)) {
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^"|"$/g, '')
      }
    }
  } catch {
    // No .env.local — the environment may come from the shell instead.
  }
}
