/**
 * mIRC / NNScript-style compatibility diagnostics.
 * Original MisstIRC analysis — not proprietary script content.
 * Unsupported constructs are reported; never silently ignored.
 */

export type CompatStatus = 'works' | 'partial' | 'unsupported'

export interface CompatFinding {
  status: CompatStatus
  code: string
  message: string
  line?: number
  /** Short construct name for COMPATIBILITY.md cross-ref */
  construct: string
}

export interface CompatReport {
  findings: CompatFinding[]
  unsupportedCount: number
  partialCount: number
  /** True when import should refuse enable until user acknowledges unsupported bits */
  hasBlockingUnsupported: boolean
}

/** Known-unsupported command names (runtime must not treat as IRC passthrough). */
export const UNSUPPORTED_COMMANDS: ReadonlySet<string> = new Set([
  'dll',
  'comopen',
  'comclose',
  'comreg',
  'comcall',
  'dialog',
  'mdx',
  'dcx',
  'uxtheme',
  'signal',
  'sockopen',
  'sockclose',
  'sockwrite',
  'socklisten',
  'sockread',
  'fopen',
  'fclose',
  'fwrite',
  'fread',
  'fseek',
  'bread',
  'bwrite',
  'run',
  'filter',
  'window',
  'drawtext',
  'drawrect',
  'drawdot',
  'drawline',
  'drawpic',
  'drawsave',
  'splay',
  'clipboard',
  'regread',
  'regwrite',
  'regdelete',
  'dde',
  'ddeserver',
  'loadbuf',
  'savebuf',
  'writeini',
  'remini',
  'cnick',
  'font',
  'color',
  'background',
  'titlebar',
  'toolbar',
  'dock',
  'flash',
  'beep',
  'exit',
  'load',
  'unload',
  'reload',
  'remote',
  'aop',
  'avoice',
  'protect',
  'ignore' // network ignore is app-level; script /ignore is partial elsewhere
])

/** Identifiers that are unsupported or only partial. */
const UNSUPPORTED_IDENTS: ReadonlyArray<{ re: RegExp; code: string; construct: string; message: string; status: CompatStatus }> =
  [
    {
      re: /\$dll\b/i,
      code: 'ident.dll',
      construct: '$dll',
      message: '$dll / native DLL calls are unsupported',
      status: 'unsupported'
    },
    {
      re: /\$com\b/i,
      code: 'ident.com',
      construct: '$com',
      message: 'COM identifiers are unsupported',
      status: 'unsupported'
    },
    {
      re: /\$dialog\b/i,
      code: 'ident.dialog',
      construct: '$dialog',
      message: 'Dialog identifiers are unsupported',
      status: 'unsupported'
    },
    {
      re: /\$window\b/i,
      code: 'ident.window',
      construct: '$window',
      message: 'Custom window identifiers are unsupported',
      status: 'unsupported'
    },
    {
      re: /\$menu\b/i,
      code: 'ident.menu',
      construct: '$menu',
      message: '$menu state helpers are partial (menus are scaffold-only)',
      status: 'partial'
    },
    {
      re: /\$iif\b/i,
      code: 'ident.iif',
      construct: '$iif',
      message: '$iif(condition,true[,false]) is supported (comparison subset)',
      status: 'works'
    },
    {
      re: /\$calc\b/i,
      code: 'ident.calc',
      construct: '$calc',
      message: '$calc supports + - * / and parentheses (no functions)',
      status: 'works'
    },
    {
      re: /\$regex\b/i,
      code: 'ident.regex',
      construct: '$regex',
      message: '$regex / $regml are unsupported',
      status: 'unsupported'
    },
    {
      re: /\$readini\b|\$ini\b/i,
      code: 'ident.ini',
      construct: '$readini',
      message: 'INI helpers are unsupported',
      status: 'unsupported'
    },
    {
      re: /\$nnscript\b|\$nns\b/i,
      code: 'ident.nnscript',
      construct: '$nnscript',
      message: 'NNScript-specific identifiers are unsupported (no nnscript.dll)',
      status: 'unsupported'
    }
  ]

const LINE_PATTERNS: ReadonlyArray<{
  re: RegExp
  code: string
  construct: string
  message: string
  status: CompatStatus
  blocking?: boolean
}> = [
  {
    re: /^\s*(?:\/)?dll\b/i,
    code: 'cmd.dll',
    construct: '/dll',
    message: '/dll and native plugin loading are unsupported',
    status: 'unsupported',
    blocking: true
  },
  {
    re: /^\s*(?:\/)?(?:mdx|dcx)\b/i,
    code: 'cmd.mdx',
    construct: '/mdx|/dcx',
    message: 'MDX/DCX UI DLLs are unsupported',
    status: 'unsupported',
    blocking: true
  },
  {
    re: /^\s*(?:\/)?dialog\b/i,
    code: 'cmd.dialog',
    construct: '/dialog',
    message: 'Custom dialogs are unsupported',
    status: 'unsupported',
    blocking: true
  },
  {
    re: /^\s*(?:\/)?(?:comopen|comcall|comclose|comreg)\b/i,
    code: 'cmd.com',
    construct: '/com*',
    message: 'COM automation is unsupported',
    status: 'unsupported',
    blocking: true
  },
  {
    re: /^\s*(?:\/)?(?:sockopen|socklisten|sockwrite|sockread)\b/i,
    code: 'cmd.sock',
    construct: '/sock*',
    message: 'Script sockets are unsupported (IRC uses the app engine)',
    status: 'unsupported',
    blocking: true
  },
  {
    re: /^\s*(?:\/)?(?:fopen|fwrite|fread|writeini|remini)\b/i,
    code: 'cmd.fs',
    construct: 'file/ini',
    message: 'Script filesystem/INI commands are unsupported',
    status: 'unsupported',
    blocking: true
  },
  {
    re: /^\s*(?:\/)?run\b/i,
    code: 'cmd.run',
    construct: '/run',
    message: '/run (process exec) is unsupported',
    status: 'unsupported',
    blocking: true
  },
  {
    re: /^\s*(?:\/)?window\b/i,
    code: 'cmd.window',
    construct: '/window',
    message: 'Custom @windows are unsupported',
    status: 'unsupported',
    blocking: true
  },
  {
    re: /^\s*goto\b/i,
    code: 'stmt.goto',
    construct: 'goto',
    message: 'goto labels are unsupported — use structured if/while',
    status: 'unsupported'
  },
  {
    re: /^\s*#.*\bon\b/i,
    code: 'group.hash',
    construct: '#group',
    message: 'Hash-style #groups are partial — groups are not toggled yet',
    status: 'partial'
  },
  {
    re: /^\s*menu\s+/i,
    code: 'menu.decl',
    construct: 'menu',
    message: 'menu/popup blocks parse into a scaffold (invoke via Scripts/menus API; no full mIRC popup engine)',
    status: 'partial'
  },
  {
    re: /^\s*(?:alias|on|raw)\b/i,
    code: 'toplevel.core',
    construct: 'alias|on|raw',
    message: 'Core top-level recognized by MisstIRC subset parser',
    status: 'works'
  }
]

/**
 * Scan source text for compatibility findings.
 * Does not execute the script. Safe for untrusted imports.
 */
export function diagnoseCompatibility(source: string): CompatReport {
  const findings: CompatFinding[] = []
  const seen = new Set<string>()
  let hasBlockingUnsupported = false

  const push = (f: CompatFinding, blocking = false): void => {
    const key = `${f.code}:${f.line ?? 0}:${f.message}`
    if (seen.has(key)) return
    seen.add(key)
    findings.push(f)
    if (f.status === 'unsupported' && blocking) hasBlockingUnsupported = true
  }

  const lines = source.replace(/\r\n/g, '\n').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const lineNo = i + 1
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith(';')) continue

    for (const pat of LINE_PATTERNS) {
      if (pat.re.test(line)) {
        // Skip noisy "works" for every alias/on line — only keep one summary
        if (pat.status === 'works') {
          push({
            status: 'works',
            code: pat.code,
            construct: pat.construct,
            message: pat.message,
            line: lineNo
          })
          continue
        }
        push(
          {
            status: pat.status,
            code: pat.code,
            construct: pat.construct,
            message: pat.message,
            line: lineNo
          },
          Boolean(pat.blocking)
        )
      }
    }

    for (const id of UNSUPPORTED_IDENTS) {
      if (id.re.test(line)) {
        push(
          {
            status: id.status,
            code: id.code,
            construct: id.construct,
            message: id.message,
            line: lineNo
          },
          id.status === 'unsupported'
        )
      }
    }

    // .nns extension / nnscript.dll references in comments or strings
    if (/\.nns\b/i.test(line) || /nnscript\.dll/i.test(line)) {
      push(
        {
          status: 'unsupported',
          code: 'pack.nns',
          construct: '.nns / nnscript.dll',
          message: 'NNScript pack files and nnscript.dll are not loaded (license + security)',
          line: lineNo
        },
        true
      )
    }
  }

  // Deduplicate works noise: keep at most 3 "works" findings
  const works = findings.filter((f) => f.status === 'works')
  const rest = findings.filter((f) => f.status !== 'works')
  const trimmedWorks = works.slice(0, 3)
  const finalFindings = [...rest, ...trimmedWorks].sort((a, b) => (a.line ?? 0) - (b.line ?? 0))

  return {
    findings: finalFindings,
    unsupportedCount: finalFindings.filter((f) => f.status === 'unsupported').length,
    partialCount: finalFindings.filter((f) => f.status === 'partial').length,
    hasBlockingUnsupported
  }
}

/** Human-readable summary for UI / import diagnostics. */
export function formatCompatSummary(report: CompatReport): string {
  if (!report.findings.length) return 'No compatibility findings (empty or comment-only script).'
  const parts = [
    `${report.unsupportedCount} unsupported`,
    `${report.partialCount} partial`,
    `${report.findings.filter((f) => f.status === 'works').length} recognized`
  ]
  return parts.join(', ')
}

/**
 * Static catalog of language constructs for COMPATIBILITY.md / UI docs.
 * Status reflects the MisstIRC subset with Phase 6 fixtures — not full mIRC.
 */
export const COMPAT_CATALOG: ReadonlyArray<{
  construct: string
  status: CompatStatus
  notes: string
}> = [
  { construct: 'alias { }', status: 'works', notes: 'Named aliases; nested alias calls' },
  {
    construct: 'on LEVEL:EVENT:…',
    status: 'partial',
    notes:
      'TEXT/ACTION/JOIN/PART/QUIT/NOTICE/NICK/KICK/TOPIC/MODE/CONNECT/DISCONNECT; pattern match subset'
  },
  { construct: 'raw N:…', status: 'partial', notes: 'Numeric handlers; match subset' },
  { construct: 'if / else / while', status: 'works', notes: 'Parenthesized tests; iteration capped' },
  { construct: 'var %x / inc / dec', status: 'works', notes: 'Script-local/global %vars' },
  {
    construct: '$nick $chan $me $network $1 $1- $*',
    status: 'partial',
    notes: 'Common idents; many mIRC idents still missing'
  },
  {
    construct: '$upper $lower $len $left $right $mid $replace $pos $ctime $asctime',
    status: 'works',
    notes: 'Safe string/time helpers (single-pair $replace)'
  },
  { construct: 'echo / timer', status: 'works', notes: 'Permission-gated' },
  { construct: 'msg join part nick …', status: 'works', notes: 'Requires irc.command + network.send grants' },
  {
    construct: 'menu <target> { }',
    status: 'partial',
    notes: 'Parsed + context menus in nicklist/channel UI; no $menu / dynamic enable exprs'
  },
  { construct: 'halt / return', status: 'works', notes: 'Event cancellation via halt' },
  { construct: 'goto / labels', status: 'unsupported', notes: 'Use structured control flow' },
  { construct: '/dll $dll DCX MDX', status: 'unsupported', notes: 'No native plugin host' },
  { construct: '/dialog /window /draw*', status: 'unsupported', notes: 'No custom UI surfaces from scripts' },
  { construct: '/com* /sock* /run', status: 'unsupported', notes: 'COM, script sockets, process exec forbidden' },
  { construct: 'file / INI helpers', status: 'unsupported', notes: 'No script filesystem' },
  { construct: '.nns / nnscript.dll', status: 'unsupported', notes: 'Not loaded or redistributed' },
  { construct: '$iif', status: 'works', notes: 'Comparison subset + truthy tokens' },
  { construct: '$calc', status: 'works', notes: 'Safe + - * / () only' },
  { construct: '$regex $readini', status: 'unsupported', notes: 'Regex/INI out of scope' }
]
