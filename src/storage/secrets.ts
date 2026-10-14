import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface SecretStore {
  set(service: string, account: string, secret: string): Promise<void>
  get(service: string, account: string): Promise<string | null>
  delete(service: string, account: string): Promise<void>
}

/**
 * File-backed secret store for non-Windows / CI.
 * Uses AES-256-GCM with a machine-local key file.
 * Not a substitute for OS credential managers in production Windows installs.
 */
export class FileSecretStore implements SecretStore {
  private readonly filePath: string
  private readonly keyPath: string
  private data: Record<string, string> = {}

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true })
    this.filePath = join(dir, 'secrets.enc.json')
    this.keyPath = join(dir, 'secrets.key')
    this.load()
  }

  async set(service: string, account: string, secret: string): Promise<void> {
    this.data[key(service, account)] = secret
    this.save()
  }

  async get(service: string, account: string): Promise<string | null> {
    return this.data[key(service, account)] ?? null
  }

  async delete(service: string, account: string): Promise<void> {
    delete this.data[key(service, account)]
    this.save()
  }

  private keyBytes(): Buffer {
    if (!existsSync(this.keyPath)) {
      const k = randomBytes(32)
      writeFileSync(this.keyPath, k)
      return k
    }
    return readFileSync(this.keyPath)
  }

  private load(): void {
    if (!existsSync(this.filePath)) {
      this.data = {}
      return
    }
    try {
      const raw = readFileSync(this.filePath)
      const iv = raw.subarray(0, 12)
      const tag = raw.subarray(12, 28)
      const enc = raw.subarray(28)
      const decipher = createDecipheriv('aes-256-gcm', this.keyBytes(), iv)
      decipher.setAuthTag(tag)
      const json = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
      this.data = JSON.parse(json) as Record<string, string>
    } catch {
      this.data = {}
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.keyBytes(), iv)
    const enc = Buffer.concat([
      cipher.update(JSON.stringify(this.data), 'utf8'),
      cipher.final()
    ])
    const tag = cipher.getAuthTag()
    writeFileSync(this.filePath, Buffer.concat([iv, tag, enc]))
  }
}

/** Hash helper for deriving deterministic account keys if needed by callers. */
export function secretAccountId(networkId: string): string {
  return createHash('sha256').update(networkId).digest('hex').slice(0, 16)
}

function key(service: string, account: string): string {
  return `${service}::${account}`
}

const SERVICE = 'MisstIRC'

export async function createSecretStore(userDataPath: string): Promise<SecretStore> {
  // keytar is optional — attempt dynamic import for Windows Credential Manager later.
  // First slice always uses the encrypted file fallback so CI/Linux works.
  return new FileSecretStore(join(userDataPath, 'credentials'))
}

export { SERVICE as SECRET_SERVICE }
