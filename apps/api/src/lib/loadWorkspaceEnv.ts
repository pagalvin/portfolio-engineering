import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DOTENV_KEY_VALUE_SEPARATOR = '='

function parseEnvValue(rawValue: string): string {
  const value = rawValue.trim()

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

export function loadWorkspaceEnv(): void {
  const currentDirectory = dirname(fileURLToPath(import.meta.url))
  const envFilePath = resolve(currentDirectory, '../../../../.env')

  if (!existsSync(envFilePath)) {
    return
  }

  const fileContents = readFileSync(envFilePath, 'utf8')
  const lines = fileContents.split(/\r?\n/)

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmedLine.indexOf(DOTENV_KEY_VALUE_SEPARATOR)

    if (separatorIndex <= 0) {
      continue
    }

    const key = trimmedLine.slice(0, separatorIndex).trim()
    const rawValue = trimmedLine.slice(separatorIndex + 1)

    if (key.length === 0 || process.env[key] !== undefined) {
      continue
    }

    process.env[key] = parseEnvValue(rawValue)
  }
}
