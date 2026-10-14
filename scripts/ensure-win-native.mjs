#!/usr/bin/env node
/**
 * Fetch win32-x64 Electron prebuilds for native addons before pack:win.
 *
 * `@electron/rebuild --platform win32` can report success on Linux while
 * leaving a host ELF better_sqlite3.node in place — that shipped in
 * v0.10.0-test.1 and crashes on Windows launch. Use prebuild-install
 * explicitly, then refuse to continue unless the binary is PE (MZ).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const moduleDir = join(root, 'node_modules/better-sqlite3')
const nativePath = join(moduleDir, 'build/Release/better_sqlite3.node')

function electronVersion() {
  return String(require(join(root, 'node_modules/electron/package.json')).version)
}

/** @returns {'pe'|'elf'|'unknown'} */
function binaryKind(file) {
  if (!existsSync(file)) return 'unknown'
  const buf = readFileSync(file)
  if (buf.length >= 2 && buf[0] === 0x4d && buf[1] === 0x5a) return 'pe' // MZ
  if (
    buf.length >= 4 &&
    buf[0] === 0x7f &&
    buf[1] === 0x45 &&
    buf[2] === 0x4c &&
    buf[3] === 0x46
  ) {
    return 'elf'
  }
  return 'unknown'
}

function run(cmd, args, cwd = root) {
  console.log(`> ${cmd} ${args.join(' ')}`)
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: process.env })
  if (r.status !== 0) throw new Error(`${cmd} exited ${r.status}`)
}

const electronVer = electronVersion()
console.log(`ensure-win-native: Electron ${electronVer}`)
console.log(`ensure-win-native: before → ${binaryKind(nativePath)}`)

if (!existsSync(moduleDir)) {
  console.error('ERROR: better-sqlite3 is not installed')
  process.exit(1)
}

// Download the Electron win32-x64 prebuild into build/Release/
run(
  'npx',
  [
    '--no-install',
    'prebuild-install',
    '--verbose',
    '--force',
    '--platform',
    'win32',
    '--arch',
    'x64',
    '--runtime',
    'electron',
    '--target',
    electronVer
  ],
  moduleDir
)

const kind = binaryKind(nativePath)
console.log(`ensure-win-native: after → ${kind} (${nativePath})`)
if (kind !== 'pe') {
  console.error(
    `ERROR: better_sqlite3.node must be Windows PE after prebuild-install, got ${kind}.`
  )
  console.error('Refusing to pack — ELF-in-Windows-app is the v0.10.0-test.1 failure.')
  process.exit(1)
}

console.log('ensure-win-native: OK (win32-x64 PE native module ready)')
