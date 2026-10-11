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

export interface IrcMessageView {
  id: string
  connectionId: string
  target: string
  kind: 'privmsg' | 'notice' | 'join' | 'part' | 'quit' | 'nick' | 'mode' | 'system' | 'error' | 'raw'
  nick?: string
  text: string
  timestamp: number
  tags?: Record<string, string>
}

export interface NickEntry {
  nick: string
  modes: string
}

export interface BufferInfo {
  connectionId: string
  name: string
  type: 'server' | 'channel' | 'query'
  topic?: string
  nicks?: NickEntry[]
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

export type MainToRendererEvent =
  | { type: 'state'; payload: AppStateSnapshot }
  | { type: 'message'; payload: IrcMessageView }
  | { type: 'connection'; payload: ConnectionSnapshot }
  | { type: 'error'; payload: { message: string } }

export interface MisstIrcApi {
  getState: () => Promise<AppStateSnapshot>
  listNetworks: () => Promise<NetworkConfig[]>
  saveNetwork: (network: NetworkConfig, password?: string) => Promise<void>
  deleteNetwork: (id: string) => Promise<void>
  connect: (request: ConnectRequest) => Promise<{ connectionId: string }>
  disconnect: (connectionId: string) => Promise<void>
  sendRaw: (connectionId: string, line: string) => Promise<void>
  sendInput: (connectionId: string, buffer: string, text: string) => Promise<void>
  setActiveBuffer: (key: string | null) => Promise<void>
  onEvent: (handler: (event: MainToRendererEvent) => void) => () => void
}
