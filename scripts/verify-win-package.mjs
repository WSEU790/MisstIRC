#!/usr/bin/env node
/**
 * Post-pack sanity check: MisstIRC.exe and better_sqlite3.node must be PE, not ELF.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const unpacked = join(root, 'release', 'win-unpacked')
const exe = join(unpacked, 'MisstIRC.exe')
const native = join(
  unpacked,
  'resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
)

/** @returns {'pe'|'elf'|'unknown'} */
function binaryKind(file) {
  if (!existsSync(file)) return 'unknown'
  const buf = readFileSync(file)
  if (buf.length >= 2 && buf[0] === 0x4d && buf[1] === 0x5a) return 'pe'
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

function fail(msg) {
  console.error(`verify-win-package: ${msg}`)
  process.exit(1)
}

if (!existsSync(unpacked)) fail(`missing ${unpacked}`)
if (!existsSync(exe)) fail(`missing ${exe}`)

const exeKind = binaryKind(exe)
const nativeKind = binaryKind(native)
console.log(`MisstIRC.exe → ${exeKind} (${statSync(exe).size} bytes)`)
console.log(`better_sqlite3.node → ${nativeKind} (${existsSync(native) ? statSync(native).size : 0} bytes)`)

if (exeKind !== 'pe') fail('MisstIRC.exe is not a Windows PE executable')
if (nativeKind !== 'pe') {
  fail(
    `better_sqlite3.node is ${nativeKind}, expected PE (win32). Do not ship this build.`
  )
}

// Spot-check: no ELF .node anywhere under win-unpacked
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (name.endsWith('.node')) out.push(p)
  }
  return out
}

const nodes = walk(unpacked)
for (const p of nodes) {
  const k = binaryKind(p)
  console.log(`check ${p} → ${k}`)
  if (k !== 'pe') fail(`non-PE native module packaged: ${p} (${k})`)
}

console.log('verify-win-package: OK')
