export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'registering'
  | 'connected'
  | 'reconnecting'
  | 'error'

export interface IgnoreRule {
  id: string
  mask: string
  /** Empty = all channels / PMs */
  channel?: string
  privmsg?: boolean
  notice?: boolean
  ctcp?: boolean
  enabled: boolean
}

export interface AliasRule {
  id: string
  name: string
  /** Expansion; $1..$n and $* supported */
  expansion: string
  enabled: boolean
}

export interface NetworkConfig {
  id: string
  name: string
  host: string
  port: number
  tls: boolean
  rejectUnauthorized: boolean
  nick: string
  /** Tried in order if primary nick is taken */
  altNicks?: string[]
  username: string
  realname: string
  /** Channel names; optional key as `"#chan key"` */
  channels: string[]
  /** Lines to send after 001 (no secrets — use SASL/password fields) */
  perform?: string[]
  ignoreRules?: IgnoreRule[]
  highlights?: string[]
  aliases?: AliasRule[]
  autoAwayMinutes?: number
  autoAwayMessage?: string
  replyCtcpVersion?: boolean
  replyCtcpTime?: boolean
  replyCtcpPing?: boolean
  /** Max CTCP replies per 10s window */
  ctcpFloodLimit?: number
  /** Presence of password only — never the secret itself */
  hasPassword?: boolean
  autoConnect?: boolean
}

export interface ConnectRequest {
  network: NetworkConfig
  password?: string
  saslPassword?: string
}

export type MessageKind =
  | 'privmsg'
  | 'notice'
  | 'join'
  | 'part'
  | 'quit'
  | 'nick'
  | 'mode'
  | 'kick'
  | 'topic'
  | 'system'
  | 'error'
  | 'ctcp'
  | 'highlight'
  | 'raw'

export interface IrcMessageView {
  id: string
  connectionId: string
  target: string
  kind: MessageKind
  nick?: string
  text: string
  timestamp: number
  tags?: Record<string, string>
  account?: string
  ignored?: boolean
  highlighted?: boolean
}

export interface NickEntry {
  nick: string
  modes: string
  account?: string
  away?: boolean
}

export interface BufferInfo {
  connectionId: string
  name: string
  type: 'server' | 'channel' | 'query'
  topic?: string
  nicks?: NickEntry[]
  unread?: number
  selfIsOp?: boolean
}

export interface ConnectionSnapshot {
  id: string
  network: NetworkConfig
  state: ConnectionState
  nick: string
  lastError?: string
  buffers: BufferInfo[]
  caps?: string[]
  isupport?: Record<string, string>
}

export interface AppSettings {
  theme: 'misstirc-dark'
  showStatusBar: boolean
  fontSize: number
  loggingEnabled: boolean
  notificationsEnabled: boolean
}

export type ScriptPermissionName =
  | 'network.send'
  | 'irc.command'
  | 'ui.echo'
  | 'timer'
  | 'filesystem.read'
  | 'filesystem.write'
  | 'process.exec'

export type ScriptStatusView = 'enabled' | 'disabled' | 'error'

export interface ScriptParseErrorView {
  line: number
  column: number
  message: string
}

/** Sandboxed script metadata exposed to the UI (source omitted from hot state). */
export interface ScriptRecordView {
  id: string
  name: string
  filename: string
  enabled: boolean
  trusted: boolean
  permissions: ScriptPermissionName[]
  parseErrors: ScriptParseErrorView[]
  execErrors: string[]
  status: ScriptStatusView
  aliasCount: number
  eventCount: number
  loadedAt: number
}

export interface AppStateSnapshot {
  connections: ConnectionSnapshot[]
  activeBufferKey: string | null
  settings: AppSettings
  unfinished: UnfinishedFeature[]
  dccOffers: DccOfferView[]
  scripts: ScriptRecordView[]
}

export interface UnfinishedFeature {
  id: string
  label: string
  detail: string
}

export interface LogSearchHit {
  id: string
  connectionId: string
  networkName: string
  target: string
  nick?: string
  text: string
  timestamp: number
  kind: MessageKind
}

export interface WhoisInfo {
  nick: string
  user?: string
  host?: string
  realname?: string
  server?: string
  channels?: string
  idle?: string
  account?: string
  raw: string[]
}

export type DccOfferStatus = 'pending' | 'accepted' | 'rejected' | 'blocked' | 'unsupported'

export interface DccOfferView {
  id: string
  connectionId: string
  peerNick: string
  filename: string
  safeFilename: string
  size?: number
  address?: string
  port?: number
  status: DccOfferStatus
  /** NAT/firewall limitation note */
  note: string
  createdAt: number
}

export type MainToRendererEvent =
  | { type: 'state'; payload: AppStateSnapshot }
  | { type: 'message'; payload: IrcMessageView }
  | { type: 'connection'; payload: ConnectionSnapshot }
  | { type: 'error'; payload: { message: string } }
  | { type: 'whois'; payload: WhoisInfo }
  | { type: 'notify'; payload: { title: string; body: string } }
  | { type: 'dcc'; payload: DccOfferView }
  | { type: 'scripts'; payload: ScriptRecordView[] }

export interface MisstIrcApi {
  getState: () => Promise<AppStateSnapshot>
  listNetworks: () => Promise<NetworkConfig[]>
  saveNetwork: (network: NetworkConfig, password?: string) => Promise<void>
  deleteNetwork: (id: string) => Promise<void>
  connect: (request: ConnectRequest) => Promise<{ connectionId: string }>
  disconnect: (connectionId: string) => Promise<void>
  reconnect: (connectionId: string) => Promise<{ connectionId: string }>
  sendRaw: (connectionId: string, line: string) => Promise<void>
  sendInput: (connectionId: string, buffer: string, text: string) => Promise<void>
  setActiveBuffer: (key: string | null) => Promise<void>
  searchLogs: (query: string, limit?: number) => Promise<LogSearchHit[]>
  getCompletions: (connectionId: string, buffer: string, prefix: string) => Promise<string[]>
  respondDcc: (offerId: string, accept: boolean) => Promise<void>
  listScripts: () => Promise<ScriptRecordView[]>
  importScript: (
    name: string,
    source: string,
    opts?: { trusted?: boolean; permissions?: ScriptPermissionName[] }
  ) => Promise<ScriptRecordView>
  enableScript: (id: string) => Promise<void>
  disableScript: (id: string) => Promise<void>
  reloadScript: (id: string) => Promise<ScriptRecordView | null>
  unloadScript: (id: string) => Promise<void>
  setScriptPermissions: (id: string, permissions: ScriptPermissionName[]) => Promise<void>
  onEvent: (handler: (event: MainToRendererEvent) => void) => () => void
}
