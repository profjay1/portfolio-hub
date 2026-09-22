#!/usr/bin/env node
// PostToolUse hook (Edit|Write|MultiEdit).
// Formats frontend files with Prettier when it is installed. Never blocks and never fails the session.
// Backend formatting is handled by Spotless in the Maven build (added in Phase 2).
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const file = input?.tool_input?.file_path;
if (!file) process.exit(0);

const projectDir = (process.env.CLAUDE_PROJECT_DIR ?? process.cwd()).replaceAll('\\', '/');
const normalized = String(file).replaceAll('\\', '/');
const rel = normalized.startsWith(projectDir) ? normalized.slice(projectDir.length).replace(/^\//, '') : normalized;

if (!rel.startsWith('frontend/')) process.exit(0);
if (rel.includes('/generated/') || rel.includes('/node_modules/')) process.exit(0);
if (!/\.(ts|html|scss|css|json|md)$/.test(rel)) process.exit(0);

const frontendDir = path.join(projectDir, 'frontend');
if (!existsSync(path.join(frontendDir, 'node_modules', '.bin'))) process.exit(0);

spawnSync('npx', ['--no-install', 'prettier', '--write', file], {
  cwd: frontendDir,
  stdio: 'ignore',
  shell: process.platform === 'win32',
});
process.exit(0);
