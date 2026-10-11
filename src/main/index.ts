import { app, BrowserWindow, ipcMain, shell, session, Notification } from 'electron'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { ConnectionManager } from '../core/manager'
import { BackupStore } from '../services/backups'
import { validateAllCustomMenus } from '../services/custom-menus'
import { ChatLogger } from '../services/logging'
import { ScriptManager } from '../scripting'
import { installCrashHooks } from './crash'
import {
  buildConfigExport,
  parseConfigImport
} from '../shared/config-export'
import { normalizeAppSettings } from '../shared/defaults'
import { AppDatabase } from '../storage/database'
import {
  createSecretStore,
  SECRET_SERVICE,
  secretAccountId,
  type SecretStore
} from '../storage/secrets'
import type {
  AppSettings,
  AppStateSnapshot,
  ConnectRequest,
  CustomMenuDef,
  LogSearchHit,
  MainToRendererEvent,
  NetworkConfig,
  ScriptPermissionName,
  ScriptRecordView,
  WhoisInfo
} from '../shared/types'

let mainWindow: BrowserWindow | null = null
let db: AppDatabase
let secrets: SecretStore
let logger: ChatLogger
let scripts: ScriptManager
let backups: BackupStore
const manager = new ConnectionManager()

function userDataDbPath(): string {
  return join(app.getPath('userData'), 'misstirc.sqlite')
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 560,
    title: 'MisstIRC',
    show: false,
    backgroundColor: '#0f1419',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function send(event: MainToRendererEvent): void {
  mainWindow?.webContents.send('misstirc:event', event)
}

function emitScripts(): void {
  send({ type: 'scripts', payload: manager.listScripts() })
  send({ type: 'state', payload: manager.getSnapshot() })
}

async function resolvePassword(networkId: string, provided?: string): Promise<string | undefined> {
  if (provided) return provided
  return (await secrets.get(SECRET_SERVICE, secretAccountId(networkId))) ?? undefined
}

function registerIpc(): void {
  ipcMain.handle('misstirc:getState', (): AppStateSnapshot => manager.getSnapshot())

  ipcMain.handle('misstirc:listNetworks', (): NetworkConfig[] => db.listNetworks())

  ipcMain.handle(
    'misstirc:saveNetwork',
    async (_e, network: NetworkConfig, password?: string): Promise<void> => {
      const toSave: NetworkConfig = {
        ...network,
        id: network.id || randomUUID(),
        hasPassword: Boolean(password) || Boolean(network.hasPassword)
      }
      db.saveNetwork(toSave)
      if (password) {
        await secrets.set(SECRET_SERVICE, secretAccountId(toSave.id), password)
      }
    }
  )

  ipcMain.handle('misstirc:deleteNetwork', async (_e, id: string): Promise<void> => {
    db.deleteNetwork(id)
    await secrets.delete(SECRET_SERVICE, secretAccountId(id))
  })

  ipcMain.handle(
    'misstirc:connect',
    async (_e, request: ConnectRequest): Promise<{ connectionId: string }> => {
      const password = await resolvePassword(request.network.id, request.password)
      const saslPassword = request.saslPassword ?? password

      db.saveNetwork({
        ...request.network,
        hasPassword: Boolean(password)
      })
      if (password) {
        await secrets.set(SECRET_SERVICE, secretAccountId(request.network.id), password)
      }

      const connectionId = await manager.connect({
        ...request,
        password,
        saslPassword
      })
      return { connectionId }
    }
  )

  ipcMain.handle('misstirc:disconnect', (_e, connectionId: string): void => {
    manager.disconnect(connectionId)
  })

  ipcMain.handle(
    'misstirc:reconnect',
    async (_e, connectionId: string): Promise<{ connectionId: string }> => {
      const snap = manager.listConnections().find((c) => c.id === connectionId)
      if (!snap) throw new Error('Unknown connection')
      const password = await resolvePassword(snap.network.id)
      const id = await manager.reconnect(connectionId, password, password)
      return { connectionId: id }
    }
  )

  ipcMain.handle('misstirc:sendRaw', (_e, connectionId: string, line: string): void => {
    manager.sendRaw(connectionId, line)
  })

  ipcMain.handle(
    'misstirc:sendInput',
    (_e, connectionId: string, buffer: string, text: string): void => {
      manager.sendInput(connectionId, buffer, text)
    }
  )

  ipcMain.handle('misstirc:setActiveBuffer', (_e, key: string | null): void => {
    manager.setActiveBuffer(key)
  })

  ipcMain.handle(
    'misstirc:searchLogs',
    (_e, query: string, limit?: number): LogSearchHit[] => manager.searchLogs(query, limit)
  )

  ipcMain.handle(
    'misstirc:getCompletions',
    (_e, connectionId: string, buffer: string, prefix: string): string[] =>
      manager.getCompletions(connectionId, buffer, prefix)
  )

  ipcMain.handle('misstirc:respondDcc', (_e, offerId: string, accept: boolean) =>
    manager.respondDcc(offerId, accept)
  )

  ipcMain.handle('misstirc:cancelDcc', (_e, offerId: string) => manager.cancelDcc(offerId))

  ipcMain.handle('misstirc:forceDccReceive', (_e, offerId: string) =>
    manager.forceDccReceive(offerId)
  )

  ipcMain.handle(
    'misstirc:offerDccSend',
    (_e, connectionId: string, peerNick: string, filePath: string) =>
      manager.offerDccSend(connectionId, peerNick, filePath)
  )

  ipcMain.handle('misstirc:listScripts', (): ScriptRecordView[] => manager.listScripts())

  ipcMain.handle(
    'misstirc:importScript',
    (
      _e,
      name: string,
      source: string,
      opts?: { trusted?: boolean; permissions?: ScriptPermissionName[] }
    ): ScriptRecordView => {
      const record = scripts.importSource(name, source, {
        trusted: opts?.trusted,
        permissions: opts?.permissions as never
      })
      emitScripts()
      return toScriptRecordView(record)
    }
  )

  ipcMain.handle('misstirc:enableScript', (_e, id: string, force?: boolean): void => {
    scripts.enable(id, Boolean(force))
    emitScripts()
  })

  ipcMain.handle('misstirc:listScriptMenus', (_e, target?: string) => manager.listScriptMenus(target))

  ipcMain.handle(
    'misstirc:runScriptMenuCommand',
    (
      _e,
      scriptId: string,
      command: string,
      ctx?: { nick?: string; chan?: string; connectionId?: string }
    ): boolean => manager.runScriptMenuCommand(scriptId, command, ctx)
  )

  ipcMain.handle('misstirc:disableScript', (_e, id: string): void => {
    scripts.disable(id)
    emitScripts()
  })

  ipcMain.handle('misstirc:reloadScript', (_e, id: string): ScriptRecordView | null => {
    const record = scripts.reload(id)
    emitScripts()
    if (!record) return null
    return toScriptRecordView(record)
  })

  ipcMain.handle('misstirc:unloadScript', (_e, id: string): void => {
    scripts.unload(id)
    emitScripts()
  })

  ipcMain.handle(
    'misstirc:setScriptPermissions',
    (_e, id: string, permissions: ScriptPermissionName[]): void => {
      scripts.setPermissions(id, permissions as never)
      emitScripts()
    }
  )

  ipcMain.handle('misstirc:getSettings', (): AppSettings => normalizeAppSettings(db.getSettings()))

  ipcMain.handle('misstirc:saveSettings', (_e, settings: AppSettings): AppSettings => {
    const normalized = normalizeAppSettings(settings)
    db.saveSettings(normalized)
    manager.settings = normalized
    send({ type: 'state', payload: manager.getSnapshot() })
    return normalized
  })

  ipcMain.handle('misstirc:exportConfig', (): string => {
    const bundle = buildConfigExport(db.getSettings(), db.listNetworks())
    return JSON.stringify(bundle, null, 2)
  })

  ipcMain.handle(
    'misstirc:importConfig',
    (_e, json: string): { networks: number; settings: AppSettings } => {
      let raw: unknown
      try {
        raw = JSON.parse(json)
      } catch {
        throw new Error('Invalid JSON')
      }
      const parsed = parseConfigImport(raw)
      if (!parsed.ok) throw new Error(parsed.error)
      const settings = normalizeAppSettings(parsed.bundle.settings)
      db.saveSettings(settings)
      manager.settings = settings
      for (const n of parsed.bundle.networks) {
        const id = n.id || randomUUID()
        db.saveNetwork({ ...n, id, hasPassword: false })
      }
      send({ type: 'state', payload: manager.getSnapshot() })
      return { networks: parsed.bundle.networks.length, settings }
    }
  )

  ipcMain.handle('misstirc:listBackups', () => backups.list())

  ipcMain.handle('misstirc:createBackup', (_e, label?: string) =>
    backups.create(db.getSettings(), db.listNetworks(), label)
  )

  ipcMain.handle(
    'misstirc:restoreBackup',
    (_e, id: string): { networks: number; settings: AppSettings } => {
      const bundle = backups.read(id)
      if (!bundle) throw new Error('Backup not found')
      const settings = normalizeAppSettings(bundle.settings)
      db.saveSettings(settings)
      manager.settings = settings
      for (const n of bundle.networks) {
        const nid = n.id || randomUUID()
        db.saveNetwork({ ...n, id: nid, hasPassword: false })
      }
      send({ type: 'state', payload: manager.getSnapshot() })
      return { networks: bundle.networks.length, settings }
    }
  )

  ipcMain.handle('misstirc:deleteBackup', (_e, id: string): void => {
    backups.delete(id)
  })

  ipcMain.handle('misstirc:validateCustomMenus', (_e, menus: CustomMenuDef[]) =>
    validateAllCustomMenus(menus)
  )
}

function wireManager(): void {
  manager.on('state', (state: AppStateSnapshot) => send({ type: 'state', payload: state }))
  manager.on('message', (payload) => send({ type: 'message', payload }))
  manager.on('connection', (payload) => send({ type: 'connection', payload }))
  manager.on('error', (payload: { message: string }) => send({ type: 'error', payload }))
  manager.on('whois', (payload: WhoisInfo) => send({ type: 'whois', payload }))
  manager.on('dcc', (payload) => send({ type: 'dcc', payload }))
  manager.on('notify', (payload: { title: string; body: string }) => {
    send({ type: 'notify', payload })
    if (Notification.isSupported()) {
      new Notification({ title: payload.title, body: payload.body }).show()
    }
  })
}

// Install as early as practical once userData is available
app.whenReady().then(async () => {
  installCrashHooks(app.getPath('userData'))
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // Dev (Vite HMR) needs unsafe-inline + ws; production stays locked down.
    const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)
    const csp = isDev
      ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss: http://127.0.0.1:* http://localhost:*"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })

  db = new AppDatabase(userDataDbPath())
  secrets = await createSecretStore(app.getPath('userData'))
  logger = new ChatLogger(join(app.getPath('userData'), 'logs'))
  manager.setDccDownloadDir(join(app.getPath('userData'), 'downloads'))
  scripts = new ScriptManager(join(app.getPath('userData'), 'scripts'), {
    echo: (id, text) => manager.scriptEcho(id, text),
    sendCommand: (id, line) => manager.scriptSendCommand(id, line)
  })
  scripts.loadFromDisk()
  manager.setScriptManager(scripts)
  backups = new BackupStore(join(app.getPath('userData'), 'backups'))
  manager.settings = db.getSettings()
  manager.setLogger(logger)

  registerIpc()
  wireManager()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  try {
    db?.close()
  } catch {
    /* ignore */
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function toScriptRecordView(record: {
  id: string
  name: string
  filename: string
  enabled: boolean
  trusted: boolean
  permissions: ScriptRecordView['permissions']
  parseErrors: ScriptRecordView['parseErrors']
  execErrors: string[]
  diagnostics: ScriptRecordView['diagnostics']
  menus: { target: string; rawTarget: string; items: unknown[]; line: number }[]
  status: ScriptRecordView['status']
  aliasCount: number
  eventCount: number
  menuCount: number
  loadedAt: number
}): ScriptRecordView {
  return {
    id: record.id,
    name: record.name,
    filename: record.filename,
    enabled: record.enabled,
    trusted: record.trusted,
    permissions: record.permissions,
    parseErrors: record.parseErrors,
    execErrors: record.execErrors,
    diagnostics: record.diagnostics,
    menus: record.menus.map((m) => ({
      target: m.target,
      rawTarget: m.rawTarget,
      itemCount: m.items.length,
      line: m.line
    })),
    status: record.status,
    aliasCount: record.aliasCount,
    eventCount: record.eventCount,
    menuCount: record.menuCount,
    loadedAt: record.loadedAt
  }
}
