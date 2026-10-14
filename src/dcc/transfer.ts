import { createWriteStream, existsSync, statSync } from 'node:fs'
import { connect, type Socket } from 'node:net'
import { EventEmitter } from 'node:events'
import { dccAddressToHost } from './parse'

export interface TransferParams {
  id: string
  host: string
  port: number
  destPath: string
  /** Resume offset (bytes already on disk) */
  position: number
  expectedSize?: number
  /** Max bytes to accept (safety) */
  maxBytes: number
  /** Fail if TCP connect does not succeed in time */
  connectTimeoutMs?: number
}

export interface TransferProgress {
  id: string
  bytesReceived: number
  expectedSize?: number
  path: string
}

/**
 * Classic DCC SEND receiver: connect to peer, write file, ACK with 4-byte BE counts.
 * Never executes the downloaded file.
 */
export class DccReceiveTransfer extends EventEmitter {
  private socket: Socket | null = null
  private bytesReceived = 0
  private destroyed = false
  private connectTimer: ReturnType<typeof setTimeout> | null = null
  private connected = false

  constructor(private readonly params: TransferParams) {
    super()
  }

  get received(): number {
    return this.bytesReceived
  }

  start(): void {
    const host = dccAddressToHost(this.params.host)
    const socket = connect({ host, port: this.params.port })
    this.socket = socket
    const stream = createWriteStream(this.params.destPath, {
      flags: this.params.position > 0 ? 'a' : 'w'
    })
    this.bytesReceived = this.params.position

    const timeoutMs = this.params.connectTimeoutMs ?? 15_000
    this.connectTimer = setTimeout(() => {
      if (!this.destroyed && !this.connected) {
        this.fail(new Error(`Connect timed out after ${timeoutMs}ms`))
      }
    }, timeoutMs)

    socket.on('connect', () => {
      this.connected = true
      if (this.connectTimer) clearTimeout(this.connectTimer)
      this.emit('started', { id: this.params.id })
    })

    socket.on('data', (chunk: Buffer) => {
      if (this.destroyed) return
      const next = this.bytesReceived + chunk.length
      if (next > this.params.maxBytes) {
        this.fail(new Error(`Transfer exceeds max size (${this.params.maxBytes} bytes)`))
        return
      }
      stream.write(chunk)
      this.bytesReceived = next
      // Classic 32-bit ACK (wraps for files >4GiB — documented limit)
      const ack = Buffer.alloc(4)
      ack.writeUInt32BE(this.bytesReceived >>> 0, 0)
      socket.write(ack)
      this.emit('progress', {
        id: this.params.id,
        bytesReceived: this.bytesReceived,
        expectedSize: this.params.expectedSize,
        path: this.params.destPath
      } satisfies TransferProgress)

      if (
        this.params.expectedSize !== undefined &&
        this.bytesReceived >= this.params.expectedSize
      ) {
        this.complete(stream)
      }
    })

    socket.on('end', () => {
      if (!this.destroyed) this.complete(stream)
    })
    socket.on('error', (err) => this.fail(err))
    stream.on('error', (err) => this.fail(err))
  }

  cancel(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.connectTimer) clearTimeout(this.connectTimer)
    this.socket?.destroy()
    this.emit('cancelled', { id: this.params.id, bytesReceived: this.bytesReceived })
  }

  private complete(stream: NodeJS.WritableStream): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.connectTimer) clearTimeout(this.connectTimer)
    const finish = (): void => {
      this.socket?.end()
      this.emit('completed', {
        id: this.params.id,
        bytesReceived: this.bytesReceived,
        path: this.params.destPath
      })
    }
    stream.end(finish)
  }

  private fail(err: Error): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.connectTimer) clearTimeout(this.connectTimer)
    this.socket?.destroy()
    this.emit('failed', { id: this.params.id, error: err.message, bytesReceived: this.bytesReceived })
  }
}

export function existingFileSize(path: string): number {
  if (!existsSync(path)) return 0
  try {
    return statSync(path).size
  } catch {
    return 0
  }
}
