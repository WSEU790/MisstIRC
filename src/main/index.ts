import { app, BrowserWindow, ipcMain, shell, session, Notification } from 'electron'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { ConnectionManager } from '../core/manager'
import { ChatLogger } from '../services/logging'
import { AppDatabase } from '../storage/database'
import {
  createSecretStore,
  SECRET_SERVICE,
  secretAccountId,
  type SecretStore
} from '../storage/secrets'
import type {
  AppStateSnapshot,
  ConnectRequest,
  LogSearchHit,
  MainToRendererEvent,
  NetworkConfig,
  WhoisInfo
} from '../shared/types'

let mainWindow: BrowserWindow | null = null
let db: AppDatabase
let secrets: SecretStore
let logger: ChatLogger
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

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
        ]
      }
    })
  })

  db = new AppDatabase(userDataDbPath())
  secrets = await createSecretStore(app.getPath('userData'))
  logger = new ChatLogger(join(app.getPath('userData'), 'logs'))
  manager.settings = db.getSettings()
  manager.setLogger(logger)

  registerIpc()
  wireManager()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    db?.close()
    app.quit()
  }
})
