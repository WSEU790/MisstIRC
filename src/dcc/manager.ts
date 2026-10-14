import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { DccOfferView } from '../shared/types'
import { resolveDownloadPath, sanitizeDccFilename } from './paths'
import {
  ipv4ToDccNumber,
  parseDccAcceptArgs,
  parseDccResumeArgs,
  parseDccSendArgs,
  type ParsedDccSend
} from './parse'
import { DccReceiveTransfer, existingFileSize } from './transfer'
import { DccSendTransfer } from './send-transfer'

export const DCC_LIMITATIONS =
  'DCC often fails behind NAT/firewalls without passive modes or port forwards. MisstIRC supports local/direct SEND (send+receive) with RESUME/ACCEPT; reliability through NAT is not guaranteed.'

/** Hard cap per transfer (50 MiB) — safety, not a product marketing limit. */
export const DCC_MAX_BYTES = 50 * 1024 * 1024

export const DCC_MAX_QUEUE = 8

/** Connect timeout for inbound receives (ms). */
export const DCC_CONNECT_TIMEOUT_MS = 15_000

interface InternalOffer extends DccOfferView {
  resumePosition: number
  /** Absolute path for outbound send source */
  sourcePath?: string
}

export class DccManager extends EventEmitter {
  private offers = new Map<string, InternalOffer>()
  private receives = new Map<string, DccReceiveTransfer>()
  private sends = new Map<string, DccSendTransfer>()
  private downloadDir: string
  /** Outbound CTCP lines the IRC layer should send (RESUME / SEND / ACCEPT) */
  private pendingOutbound: { connectionId: string; nick: string; ctcp: string }[] = []

  constructor(downloadDir: string) {
    super()
    this.downloadDir = downloadDir
    mkdirSync(this.downloadDir, { recursive: true })
  }

  setDownloadDir(dir: string): void {
    this.downloadDir = dir
    mkdirSync(this.downloadDir, { recursive: true })
  }

  list(): DccOfferView[] {
    return [...this.offers.values()]
      .map(publicView)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  takeOutbound(): { connectionId: string; nick: string; ctcp: string }[] {
    const out = this.pendingOutbound
    this.pendingOutbound = []
    return out
  }

  ingestCtcp(connectionId: string, peerNick: string, args: string): DccOfferView | null {
    const send = parseDccSendArgs(args)
    if (send) return this.ingestSend(connectionId, peerNick, send)

    const accept = parseDccAcceptArgs(args)
    if (accept) {
      for (const offer of this.offers.values()) {
        if (
          offer.connectionId === connectionId &&
          offer.peerNick.toLowerCase() === peerNick.toLowerCase() &&
          offer.port === accept.port &&
          offer.status === 'accepted' &&
          offer.direction !== 'outbound' &&
          offer.safeFilename === sanitizeDccFilename(accept.filename)
        ) {
          offer.resumePosition = accept.position
          offer.note = `RESUME accepted at byte ${accept.position}. Starting transfer…`
          this.startReceive(offer)
          this.emit('update', publicView(offer))
          return publicView(offer)
        }
      }
      return null
    }

    const resume = parseDccResumeArgs(args)
    if (resume) {
      for (const offer of this.offers.values()) {
        if (
          offer.direction === 'outbound' &&
          offer.connectionId === connectionId &&
          offer.peerNick.toLowerCase() === peerNick.toLowerCase() &&
          offer.port === resume.port &&
          ['accepted', 'transferring'].includes(offer.status) &&
          offer.safeFilename === sanitizeDccFilename(resume.filename)
        ) {
          const sendXfer = this.sends.get(offer.id)
          sendXfer?.setResumeFrom(resume.position)
          offer.resumePosition = resume.position
          offer.bytesReceived = resume.position
          offer.note = `Peer RESUME at ${resume.position} — sending ACCEPT.`
          this.pendingOutbound.push({
            connectionId: offer.connectionId,
            nick: offer.peerNick,
            ctcp: `ACCEPT ${quoteName(offer.filename)} ${offer.port} ${resume.position}`
          })
          this.emit('update', publicView(offer))
          return publicView(offer)
        }
      }
      return null
    }
    return null
  }

  private ingestSend(
    connectionId: string,
    peerNick: string,
    parsed: ParsedDccSend
  ): DccOfferView {
    const safe = sanitizeDccFilename(parsed.filename)
    const id = randomUUID()
    const offer: InternalOffer = {
      id,
      connectionId,
      peerNick,
      filename: parsed.filename,
      safeFilename: safe ?? '[rejected]',
      size: parsed.size,
      address: parsed.address,
      port: parsed.port,
      status: safe ? 'pending' : 'blocked',
      note: safe
        ? DCC_LIMITATIONS
        : 'Filename failed path-safety validation (traversal or reserved name).',
      createdAt: Date.now(),
      bytesReceived: 0,
      resumePosition: 0,
      localPath: undefined,
      direction: 'inbound'
    }
    const active = [...this.offers.values()].filter((o) =>
      ['pending', 'accepted', 'transferring'].includes(o.status)
    ).length
    if (safe && active >= DCC_MAX_QUEUE) {
      offer.status = 'blocked'
      offer.note = `DCC queue full (max ${DCC_MAX_QUEUE}). Reject or finish existing offers.`
    }
    this.offers.set(id, offer)
    return publicView(offer)
  }

  /**
   * Offer an outbound SEND to a peer. Listens on localhost by default.
   * Never auto-executes anything; only streams the chosen file.
   */
  async offerSend(opts: {
    connectionId: string
    peerNick: string
    filePath: string
    bindHost?: string
  }): Promise<DccOfferView> {
    const active = [...this.offers.values()].filter((o) =>
      ['pending', 'accepted', 'transferring'].includes(o.status)
    ).length
    if (active >= DCC_MAX_QUEUE) {
      throw new Error(`DCC queue full (max ${DCC_MAX_QUEUE})`)
    }
    if (!existsSync(opts.filePath)) throw new Error('File not found')
    const st = statSync(opts.filePath)
    if (!st.isFile()) throw new Error('Not a regular file')
    const safe = sanitizeDccFilename(basename(opts.filePath))
    if (!safe) throw new Error('Unsafe filename')

    const id = randomUUID()
    const transfer = new DccSendTransfer({
      id,
      filePath: opts.filePath,
      bindHost: opts.bindHost ?? '127.0.0.1',
      maxBytes: DCC_MAX_BYTES
    })
    const listen = await transfer.listen()
    const dccAddr = String(ipv4ToDccNumber(listen.host) ?? listen.host)

    const offer: InternalOffer = {
      id,
      connectionId: opts.connectionId,
      peerNick: opts.peerNick,
      filename: safe,
      safeFilename: safe,
      size: listen.size,
      address: dccAddr,
      port: listen.port,
      status: 'accepted',
      note: `Outgoing SEND listening on ${listen.host}:${listen.port}. ${DCC_LIMITATIONS}`,
      createdAt: Date.now(),
      bytesReceived: 0,
      resumePosition: 0,
      localPath: opts.filePath,
      sourcePath: opts.filePath,
      direction: 'outbound'
    }
    this.offers.set(id, offer)
    this.sends.set(id, transfer)
    this.wireSend(offer, transfer)

    this.pendingOutbound.push({
      connectionId: opts.connectionId,
      nick: opts.peerNick,
      ctcp: `SEND ${quoteName(safe)} ${dccAddr} ${listen.port} ${listen.size}`
    })
    this.emit('update', publicView(offer))
    return publicView(offer)
  }

  /**
   * Accept or reject inbound offer. On accept: RESUME if partial file exists.
   * Never auto-runs downloaded files.
   */
  respond(offerId: string, accept: boolean): DccOfferView | null {
    const offer = this.offers.get(offerId)
    if (!offer) return null
    if (offer.direction === 'outbound') return publicView(offer)
    if (offer.status !== 'pending') return publicView(offer)
    if (!accept) {
      offer.status = 'rejected'
      offer.note = 'Rejected by user.'
      this.emit('update', publicView(offer))
      return publicView(offer)
    }

    const dest = resolveDownloadPath(this.downloadDir, offer.safeFilename)
    if (!dest) {
      offer.status = 'blocked'
      offer.note = 'Could not resolve a safe download path.'
      this.emit('update', publicView(offer))
      return publicView(offer)
    }
    offer.localPath = dest
    const existing = existingFileSize(dest)
    offer.status = 'accepted'
    offer.bytesReceived = existing

    if (existing > 0 && offer.port) {
      offer.resumePosition = existing
      offer.note = `Partial file (${existing} bytes) — requesting DCC RESUME. ${DCC_LIMITATIONS}`
      this.pendingOutbound.push({
        connectionId: offer.connectionId,
        nick: offer.peerNick,
        ctcp: `RESUME ${quoteName(offer.filename)} ${offer.port} ${existing}`
      })
      this.emit('update', publicView(offer))
      return publicView(offer)
    }

    offer.note = `Receiving… ${DCC_LIMITATIONS}`
    this.startReceive(offer)
    this.emit('update', publicView(offer))
    return publicView(offer)
  }

  /** Begin receive without waiting for peer ACCEPT. */
  startTransferDirect(offerId: string): DccOfferView | null {
    const offer = this.offers.get(offerId)
    if (!offer || offer.direction === 'outbound') return null
    this.startReceive(offer)
    return publicView(offer)
  }

  cancel(offerId: string): DccOfferView | null {
    const offer = this.offers.get(offerId)
    if (!offer) return null
    const recv = this.receives.get(offerId)
    if (recv) {
      recv.cancel()
      this.receives.delete(offerId)
    }
    const send = this.sends.get(offerId)
    if (send) {
      send.cancel()
      this.sends.delete(offerId)
    }
    if (['pending', 'accepted', 'transferring'].includes(offer.status)) {
      offer.status = 'cancelled'
      offer.note = 'Cancelled by user.'
      this.emit('update', publicView(offer))
    }
    return publicView(offer)
  }

  private startReceive(offer: InternalOffer): void {
    if (!offer.address || !offer.port || !offer.localPath) {
      offer.status = 'failed'
      offer.note = 'Missing address/port/path for transfer.'
      return
    }
    if (this.receives.has(offer.id)) return

    const position = offer.resumePosition || 0
    const transfer = new DccReceiveTransfer({
      id: offer.id,
      host: offer.address,
      port: offer.port,
      destPath: offer.localPath,
      position,
      expectedSize: offer.size,
      maxBytes: DCC_MAX_BYTES,
      connectTimeoutMs: DCC_CONNECT_TIMEOUT_MS
    })
    this.receives.set(offer.id, transfer)
    offer.status = 'transferring'

    transfer.on('progress', (p: { bytesReceived: number }) => {
      offer.bytesReceived = p.bytesReceived
      this.emit('update', publicView(offer))
    })
    transfer.on('completed', (p: { bytesReceived: number; path: string }) => {
      offer.bytesReceived = p.bytesReceived
      offer.status = 'completed'
      offer.note = `Saved to ${p.path} (not executed). ${DCC_LIMITATIONS}`
      this.receives.delete(offer.id)
      this.emit('update', publicView(offer))
    })
    transfer.on('failed', (p: { error: string; bytesReceived: number }) => {
      offer.bytesReceived = p.bytesReceived
      offer.status = 'failed'
      offer.note = `Transfer failed: ${p.error}. ${DCC_LIMITATIONS}`
      this.receives.delete(offer.id)
      this.emit('update', publicView(offer))
    })
    transfer.on('cancelled', (p: { bytesReceived: number }) => {
      offer.bytesReceived = p.bytesReceived
      offer.status = 'cancelled'
      this.receives.delete(offer.id)
      this.emit('update', publicView(offer))
    })

    transfer.start()
  }

  private wireSend(offer: InternalOffer, transfer: DccSendTransfer): void {
    transfer.on('started', () => {
      offer.status = 'transferring'
      offer.note = `Sending… ${DCC_LIMITATIONS}`
      this.emit('update', publicView(offer))
    })
    transfer.on('progress', (p: { bytesSent: number }) => {
      offer.bytesReceived = p.bytesSent
      this.emit('update', publicView(offer))
    })
    transfer.on('completed', (p: { bytesSent: number }) => {
      offer.bytesReceived = p.bytesSent
      offer.status = 'completed'
      offer.note = `Sent ${p.bytesSent} bytes (outbound). ${DCC_LIMITATIONS}`
      this.sends.delete(offer.id)
      this.emit('update', publicView(offer))
    })
    transfer.on('failed', (p: { error: string; bytesSent: number }) => {
      offer.bytesReceived = p.bytesSent
      offer.status = 'failed'
      offer.note = `Send failed: ${p.error}. ${DCC_LIMITATIONS}`
      this.sends.delete(offer.id)
      this.emit('update', publicView(offer))
    })
    transfer.on('cancelled', (p: { bytesSent: number }) => {
      offer.bytesReceived = p.bytesSent
      offer.status = 'cancelled'
      this.sends.delete(offer.id)
      this.emit('update', publicView(offer))
    })
  }
}

function publicView(o: InternalOffer): DccOfferView {
  return {
    id: o.id,
    connectionId: o.connectionId,
    peerNick: o.peerNick,
    filename: o.filename,
    safeFilename: o.safeFilename,
    size: o.size,
    address: o.address,
    port: o.port,
    status: o.status,
    note: o.note,
    createdAt: o.createdAt,
    bytesReceived: o.bytesReceived,
    localPath: o.localPath,
    direction: o.direction ?? 'inbound'
  }
}

function quoteName(name: string): string {
  return /\s/.test(name) ? `"${name}"` : name
}

/** Test helper: default download dir under tmp */
export function defaultTestDownloadDir(base: string): string {
  const dir = join(base, 'dcc-downloads')
  mkdirSync(dir, { recursive: true })
  return dir
}
