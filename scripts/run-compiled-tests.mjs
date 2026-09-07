import { readdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { join } from 'node:path'

async function testFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await testFiles(path))
    else if (entry.isFile() && entry.name.endsWith('.test.js')) files.push(path)
  }
  return files
}

const files = await testFiles(join(process.cwd(), 'dist'))
const child = spawn(process.execPath, ['--test', ...files], { stdio: 'inherit' })
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
