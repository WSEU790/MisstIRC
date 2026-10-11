import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  ConnectRequest,
  CustomMenuDef,
  MainToRendererEvent,
  MisstIrcApi,
  NetworkConfig,
  ScriptPermissionName
} from '../shared/types'

const api: MisstIrcApi = {
  getState: () => ipcRenderer.invoke('misstirc:getState'),
  listNetworks: () => ipcRenderer.invoke('misstirc:listNetworks'),
  saveNetwork: (network: NetworkConfig, password?: string) =>
    ipcRenderer.invoke('misstirc:saveNetwork', network, password),
  deleteNetwork: (id: string) => ipcRenderer.invoke('misstirc:deleteNetwork', id),
  connect: (request: ConnectRequest) => ipcRenderer.invoke('misstirc:connect', request),
  disconnect: (connectionId: string) => ipcRenderer.invoke('misstirc:disconnect', connectionId),
  reconnect: (connectionId: string) => ipcRenderer.invoke('misstirc:reconnect', connectionId),
  sendRaw: (connectionId: string, line: string) =>
    ipcRenderer.invoke('misstirc:sendRaw', connectionId, line),
  sendInput: (connectionId: string, buffer: string, text: string) =>
    ipcRenderer.invoke('misstirc:sendInput', connectionId, buffer, text),
  setActiveBuffer: (key: string | null) => ipcRenderer.invoke('misstirc:setActiveBuffer', key),
  searchLogs: (query: string, limit?: number) =>
    ipcRenderer.invoke('misstirc:searchLogs', query, limit),
  getCompletions: (connectionId: string, buffer: string, prefix: string) =>
    ipcRenderer.invoke('misstirc:getCompletions', connectionId, buffer, prefix),
  respondDcc: (offerId: string, accept: boolean) =>
    ipcRenderer.invoke('misstirc:respondDcc', offerId, accept),
  listScripts: () => ipcRenderer.invoke('misstirc:listScripts'),
  importScript: (name, source, opts) =>
    ipcRenderer.invoke('misstirc:importScript', name, source, opts),
  enableScript: (id: string, force?: boolean) =>
    ipcRenderer.invoke('misstirc:enableScript', id, force),
  disableScript: (id: string) => ipcRenderer.invoke('misstirc:disableScript', id),
  reloadScript: (id: string) => ipcRenderer.invoke('misstirc:reloadScript', id),
  unloadScript: (id: string) => ipcRenderer.invoke('misstirc:unloadScript', id),
  setScriptPermissions: (id: string, permissions: ScriptPermissionName[]) =>
    ipcRenderer.invoke('misstirc:setScriptPermissions', id, permissions),
  listScriptMenus: (target?: string) => ipcRenderer.invoke('misstirc:listScriptMenus', target),
  getSettings: () => ipcRenderer.invoke('misstirc:getSettings'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('misstirc:saveSettings', settings),
  exportConfig: () => ipcRenderer.invoke('misstirc:exportConfig'),
  importConfig: (json: string) => ipcRenderer.invoke('misstirc:importConfig', json),
  listBackups: () => ipcRenderer.invoke('misstirc:listBackups'),
  createBackup: (label?: string) => ipcRenderer.invoke('misstirc:createBackup', label),
  restoreBackup: (id: string) => ipcRenderer.invoke('misstirc:restoreBackup', id),
  deleteBackup: (id: string) => ipcRenderer.invoke('misstirc:deleteBackup', id),
  validateCustomMenus: (menus: CustomMenuDef[]) =>
    ipcRenderer.invoke('misstirc:validateCustomMenus', menus),
  onEvent: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: MainToRendererEvent): void => {
      handler(payload)
    }
    ipcRenderer.on('misstirc:event', listener)
    return () => ipcRenderer.removeListener('misstirc:event', listener)
  }
}

contextBridge.exposeInMainWorld('misstirc', api)
