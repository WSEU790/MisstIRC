import { createServer, type Server, type Socket } from 'node:net'
import { ipv4ToDccNumber } from './parse'

export interface MockDccSendOptions {
  /** Payload to send after a client connects */
  data: Buffer
  /** Resume: skip this many bytes from the start of data */
  resumeFrom?: number
  host?: string
  /** Delay before writing payload (ms) — useful for cancel races */
  sendDelayMs?: number
  /** If set, never send payload (hold connection open) */
  holdOnly?: boolean
}

export interface MockDccSendHandle {
  host: string
  port: number
  /** Classic DCC decimal IP for 127.0.0.1 */
  dccAddress: string
  close: () => Promise<void>
  /** Resolves when transfer finished (client disconnected after send) */
  done: Promise<void>
}

/**
 * Local mock DCC SEND peer for tests: listen, stream bytes, ignore ACK payload.
 * Never used for production traffic.
 */
export async function startMockDccSend(opts: MockDccSendOptions): Promise<MockDccSendHandle> {
  const host = opts.host ?? '127.0.0.1'
  const resumeFrom = opts.resumeFrom ?? 0
  const payload = opts.data.subarray(Math.min(resumeFrom, opts.data.length))

  let resolveDone!: () => void
  const done = new Promise<void>((r) => {
    resolveDone = r
  })

  const server: Server = createServer((socket: Socket) => {
    const send = (): void => {
      if (opts.holdOnly) return
      socket.write(payload)
    }
    if (opts.sendDelayMs && opts.sendDelayMs > 0) {
      setTimeout(send, opts.sendDelayMs)
    } else {
      send()
    }
    // Keep reading ACKs until peer closes
    socket.on('data', () => {
      /* ack bytes ignored */
    })
    socket.on('close', () => {
      resolveDone()
      server.close()
    })
    socket.on('error', () => {
      resolveDone()
      server.close()
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, host, () => resolve())
  })

  const addr = server.address()
  if (!addr || typeof addr === 'string') throw new Error('mock DCC bind failed')
  const port = addr.port
  const dccAddress = String(ipv4ToDccNumber(host) ?? 2130706433)

  return {
    host,
    port,
    dccAddress,
    done,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve())
      })
  }
}
