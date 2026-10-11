export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'registering'
  | 'connected'
  | 'reconnecting'
  | 'error'

export interface NetworkConfig {
  id: string
  name: string
  host: string
  port: number
  tls: boolean
  rejectUnauthorized: boolean
  nick: string
  username: string
  realname: string
  /** Channel names; optional key as `"#chan key"` */
  channels: string[]
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
}

export interface NickEntry {
  nick: string
  /** Prefix modes such as @ % + */
  modes: string
}

export interface BufferInfo {
  connectionId: string
  name: string
  type: 'server' | 'channel' | 'query'
  topic?: string
  nicks?: NickEntry[]
  unread?: number
  /** True when the local nick has op/halfop/owner/admin in this channel */
  selfIsOp?: boolean
}

export interface ConnectionSnapshot {
  id: string
  network: NetworkConfig
  state: ConnectionState
  nick: string
  lastError?: string
  buffers: BufferInfo[]
}

export interface AppSettings {
  theme: 'misstirc-dark'
  showStatusBar: boolean
  fontSize: number
  loggingEnabled: boolean
}

export interface AppStateSnapshot {
  connections: ConnectionSnapshot[]
  activeBufferKey: string | null
  settings: AppSettings
  unfinished: UnfinishedFeature[]
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

export type MainToRendererEvent =
  | { type: 'state'; payload: AppStateSnapshot }
  | { type: 'message'; payload: IrcMessageView }
  | { type: 'connection'; payload: ConnectionSnapshot }
  | { type: 'error'; payload: { message: string } }
  | { type: 'whois'; payload: WhoisInfo }

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
  onEvent: (handler: (event: MainToRendererEvent) => void) => () => void
}
