/* global console, process */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
const patterns = [
  /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g,
  /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/g,
  /^[ \t]*(?:TELEGRAM_BOT_TOKEN|GITHUB_TOKEN|API_KEY|PASSWORD|SECRET)[ \t]*[:=][ \t]*["']?[^\s"'#]{10,}/gm,
];
const problems = [];
function scan(label, content) {
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) problems.push(`${label}: possible credential`);
  }
}

const tracked = git('ls-files', '-z').split('\0').filter(Boolean);
const staged = git('diff', '--cached', '--name-only', '-z')
  .split('\0')
  .filter(Boolean);
for (const path of tracked) {
  if (
    /(^|\/)(?:\.env(?:\..*)?|node_modules|dry-run|dist)(\/|$)/.test(path) &&
    path !== '.env.example'
  )
    problems.push(`${path}: forbidden tracked path`);
}
if (tracked.includes('.env')) problems.push('.env is tracked');
try {
  git('check-ignore', '-q', '.env');
} catch {
  problems.push('.env is not ignored');
}
for (const path of [...new Set([...tracked, ...staged])]) {
  try {
    if (statSync(path).isFile())
      scan(`worktree ${path}`, readFileSync(path, 'utf8'));
  } catch {
    /* A staged deletion has no worktree file. */
  }
}
for (const path of staged) {
  try {
    scan(`index ${path}`, git('show', `:${path}`));
  } catch {
    /* A deleted path has no index entry. */
  }
}
scan('all Git history', git('log', '--all', '-p', '--no-ext-diff', '--binary'));
const example = readFileSync('.env.example', 'utf8');
for (const line of example.split(/\r?\n/)) {
  if (/^\s*#/.test(line) || !line.includes('=')) continue;
  const [key, ...value] = line.split('=');
  if (/TOKEN|SECRET|PASSWORD|KEY/.test(key ?? '') && value.join('=').trim())
    problems.push('.env.example contains a nonempty credential field');
}
if (problems.length) {
  for (const problem of problems) console.error(problem);
  process.exitCode = 1;
} else
  console.log(
    `Security audit passed: ${tracked.length} tracked files, ${staged.length} staged files, full history checked; no secret values printed.`,
  );
