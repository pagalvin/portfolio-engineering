#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const cwd = 'c:\\src\\portfolio-engineering\\portfolio-engineering';
const testFile = 'apps\\frontend\\src\\sessionState.test.ts';

console.log('=== EXECUTING TEST ===');
console.log(`Command: node --test --experimental-strip-types ${testFile}`);
console.log(`Working Directory: ${cwd}`);
console.log();

const child = spawn('node', ['--test', '--experimental-strip-types', testFile], {
  cwd: cwd,
  stdio: ['inherit', 'pipe', 'pipe']
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => {
  stdout += data.toString();
  process.stdout.write(data);
});

child.stderr.on('data', (data) => {
  stderr += data.toString();
  process.stderr.write(data);
});

child.on('close', (code) => {
  console.log('');
  console.log('=== EXIT CODE ===');
  console.log(code);
  process.exit(code);
});

child.on('error', (err) => {
  console.error('Error spawning process:', err);
  process.exit(1);
});
