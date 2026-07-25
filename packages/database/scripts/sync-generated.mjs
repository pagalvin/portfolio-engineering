import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const source = resolve(process.cwd(), 'src', 'generated', 'prisma')
const destination = resolve(process.cwd(), 'dist', 'generated', 'prisma')

if (!existsSync(source)) {
  throw new Error(`Prisma client source directory not found: ${source}`)
}

rmSync(destination, { recursive: true, force: true })
mkdirSync(resolve(process.cwd(), 'dist', 'generated'), { recursive: true })
cpSync(source, destination, { recursive: true })
