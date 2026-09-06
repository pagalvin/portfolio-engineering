import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const packageRoot = resolve(import.meta.dirname, '..')
const source = resolve(packageRoot, 'src', 'generated', 'prisma')
const destination = resolve(packageRoot, 'dist', 'generated', 'prisma')

if (!existsSync(source)) {
  throw new Error(`Prisma client source directory not found: ${source}`)
}

mkdirSync(destination, { recursive: true })
cpSync(source, destination, {
  recursive: true,
  filter: (src) => !src.endsWith('.ts'),
})
