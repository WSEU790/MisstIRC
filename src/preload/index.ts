import { contextBridge, ipcRenderer } from 'electron'
import type {
  ConnectRequest,
  MainToRendererEvent,
  MisstIrcApi,
  NetworkConfig
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
  onEvent: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: MainToRendererEvent): void => {
      handler(payload)
    }
    ipcRenderer.on('misstirc:event', listener)
    return () => ipcRenderer.removeListener('misstirc:event', listener)
  }
}

contextBridge.exposeInMainWorld('misstirc', api)
