import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), '..', 'data')

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function readJson(file: string) {
  const full = path.join(DATA_DIR, file)
  if (!fs.existsSync(full)) return {}
  return JSON.parse(fs.readFileSync(full, 'utf-8'))
}

function writeJson(file: string, data: unknown) {
  ensureDataDir()
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2))
}

export { readJson, writeJson }
