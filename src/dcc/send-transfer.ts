import { existsSync, readFileSync, statSync } from 'node:fs'
import { createServer, type Server, type Socket } from 'node:net'
import { EventEmitter } from 'node:events'

export interface SendTransferParams {
  id: string
  /** Absolute path to file to send (already validated) */
  filePath: string
  /** Bind host — default 127.0.0.1 for local/direct tests */
  bindHost?: string
  /** Resume: skip this many bytes when a peer connects */
  resumeFrom?: number
  maxBytes: number
}

export interface SendListenInfo {
  host: string
  port: number
  size: number
}

/**
 * Classic DCC SEND sender: listen, stream file, consume 4-byte BE ACKs.
 * Binds localhost by default — NAT/firewall traversal is not claimed.
 */
export class DccSendTransfer extends EventEmitter {
  private server: Server | null = null
  private socket: Socket | null = null
  private destroyed = false
  private bytesSent = 0
  private resumeFrom = 0
  private fileSize = 0
  private payload: Buffer | null = null

  constructor(private readonly params: SendTransferParams) {
    super()
    this.resumeFrom = params.resumeFrom ?? 0
  }

  get sent(): number {
    return this.bytesSent
  }

  /** Start listening; resolves with host/port/size for the CTCP SEND offer. */
  listen(): Promise<SendListenInfo> {
    if (!existsSync(this.params.filePath)) {
      return Promise.reject(new Error('File not found'))
    }
    const st = statSync(this.params.filePath)
    if (!st.isFile()) return Promise.reject(new Error('Not a regular file'))
    if (st.size > this.params.maxBytes) {
      return Promise.reject(new Error(`File exceeds max size (${this.params.maxBytes} bytes)`))
    }
    this.fileSize = st.size
    this.payload = readFileSync(this.params.filePath)
    const host = this.params.bindHost ?? '127.0.0.1'

    return new Promise((resolve, reject) => {
      const server = createServer((socket) => this.onPeer(socket))
      this.server = server
      server.once('error', reject)
      server.listen(0, host, () => {
        const addr = server.address()
        if (!addr || typeof addr === 'string') {
          reject(new Error('bind failed'))
          return
        }
        resolve({ host, port: addr.port, size: this.fileSize })
      })
    })
  }

  /** Update resume offset before the peer connects (from DCC RESUME). */
  setResumeFrom(position: number): void {
    if (position < 0 || position > this.fileSize) return
    this.resumeFrom = position
  }

  cancel(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.socket?.destroy()
    this.server?.close()
    this.emit('cancelled', { id: this.params.id, bytesSent: this.bytesSent })
  }

  private onPeer(socket: Socket): void {
    if (this.destroyed || !this.payload) {
      socket.destroy()
      return
    }
    // One peer only
    this.server?.close()
    this.socket = socket
    const slice = this.payload.subarray(Math.min(this.resumeFrom, this.payload.length))
    this.bytesSent = this.resumeFrom
    this.emit('started', { id: this.params.id, resumeFrom: this.resumeFrom })

    socket.on('data', () => {
      /* classic ACK bytes — ignored for pacing in this slice */
    })
    socket.on('error', (err) => this.fail(err))

    socket.write(slice, (err) => {
      if (err) {
        this.fail(err)
        return
      }
      if (this.destroyed) return
      this.bytesSent = this.resumeFrom + slice.length
      this.emit('progress', {
        id: this.params.id,
        bytesSent: this.bytesSent,
        expectedSize: this.fileSize
      })
      this.destroyed = true
      socket.end()
      this.emit('completed', {
        id: this.params.id,
        bytesSent: this.bytesSent,
        path: this.params.filePath
      })
    })
  }

  private fail(err: Error): void {
    if (this.destroyed) return
    this.destroyed = true
    this.socket?.destroy()
    this.server?.close()
    this.emit('failed', { id: this.params.id, error: err.message, bytesSent: this.bytesSent })
  }
}
