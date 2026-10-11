import { connect, type Socket } from 'node:net'
import { writeFileSync } from 'node:fs'

export interface MockDccReceiveOptions {
  host: string
  port: number
  /** Expected total size (optional — closes when peer ends) */
  expectedSize?: number
  /** Write received bytes here */
  destPath?: string
  /** Resume: pretend we already have this many bytes (send ACKs from that offset) */
  position?: number
}

export interface MockDccReceiveResult {
  bytesReceived: number
  data: Buffer
}

/**
 * Local mock DCC SEND *client* (receiver) for testing outbound SEND.
 * Connects, ACKs with 4-byte BE counts, collects payload.
 */
export async function mockDccReceive(opts: MockDccReceiveOptions): Promise<MockDccReceiveResult> {
  const position = opts.position ?? 0
  const chunks: Buffer[] = []
  let bytesReceived = position

  return new Promise((resolve, reject) => {
    const socket: Socket = connect({ host: opts.host, port: opts.port })
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error('mock DCC receive timeout'))
    }, 8000)

    socket.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
      bytesReceived += chunk.length
      const ack = Buffer.alloc(4)
      ack.writeUInt32BE(bytesReceived >>> 0, 0)
      socket.write(ack)
      if (opts.expectedSize !== undefined && bytesReceived >= opts.expectedSize) {
        finish()
      }
    })
    socket.on('end', () => finish())
    socket.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    function finish(): void {
      clearTimeout(timer)
      socket.destroy()
      const data = Buffer.concat(chunks)
      if (opts.destPath) writeFileSync(opts.destPath, data)
      resolve({ bytesReceived, data })
    }
  })
}
