import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { DccOfferView } from '../shared/types'
import { resolveDownloadPath, sanitizeDccFilename } from './paths'
import {
  parseDccAcceptArgs,
  parseDccResumeArgs,
  parseDccSendArgs,
  type ParsedDccSend
} from './parse'
import { DccReceiveTransfer, existingFileSize } from './transfer'

export const DCC_LIMITATIONS =
  'DCC often fails behind NAT/firewalls without passive modes or port forwards. MisstIRC supports local/direct SEND receive with RESUME/ACCEPT; reliability through NAT is not guaranteed.'

/** Hard cap per transfer (50 MiB) — safety, not a product marketing limit. */
export const DCC_MAX_BYTES = 50 * 1024 * 1024

export const DCC_MAX_QUEUE = 8

interface InternalOffer extends DccOfferView {
  resumePosition: number
}

export class DccManager extends EventEmitter {
  private offers = new Map<string, InternalOffer>()
  private transfers = new Map<string, DccReceiveTransfer>()
  private downloadDir: string
  /** Outbound CTCP lines the IRC layer should send (RESUME requests, etc.) */
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
      // Match pending resume by filename+port
      for (const offer of this.offers.values()) {
        if (
          offer.connectionId === connectionId &&
          offer.peerNick.toLowerCase() === peerNick.toLowerCase() &&
          offer.port === accept.port &&
          offer.status === 'accepted' &&
          offer.safeFilename === sanitizeDccFilename(accept.filename)
        ) {
          offer.resumePosition = accept.position
          offer.note = `RESUME accepted at byte ${accept.position}. Starting transfer…`
          this.startTransfer(offer)
          this.emit('update', publicView(offer))
          return publicView(offer)
        }
      }
      return null
    }

    // RESUME from peer (we are sender) — unsupported outbound send in this slice
    if (parseDccResumeArgs(args)) {
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
      localPath: undefined
    }
    // Queue pressure
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
   * Accept or reject. On accept: if partial file exists, send RESUME CTCP; else start transfer.
   * Never auto-runs downloaded files.
   */
  respond(offerId: string, accept: boolean): DccOfferView | null {
    const offer = this.offers.get(offerId)
    if (!offer) return null
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
      // If peer never ACCEPT, UI can still "Force receive" later via cancel+re-accept;
      // for mock tests without RESUME, call startTransferDirect in tests.
      return publicView(offer)
    }

    offer.note = `Receiving… ${DCC_LIMITATIONS}`
    this.startTransfer(offer)
    this.emit('update', publicView(offer))
    return publicView(offer)
  }

  /** Begin receive without waiting for RESUME/ACCEPT (fresh file or after ACCEPT). */
  startTransferDirect(offerId: string): DccOfferView | null {
    const offer = this.offers.get(offerId)
    if (!offer) return null
    this.startTransfer(offer)
    return publicView(offer)
  }

  cancel(offerId: string): DccOfferView | null {
    const offer = this.offers.get(offerId)
    if (!offer) return null
    const t = this.transfers.get(offerId)
    if (t) {
      t.cancel()
      this.transfers.delete(offerId)
    }
    if (['pending', 'accepted', 'transferring'].includes(offer.status)) {
      offer.status = 'cancelled'
      offer.note = 'Cancelled by user.'
      this.emit('update', publicView(offer))
    }
    return publicView(offer)
  }

  private startTransfer(offer: InternalOffer): void {
    if (!offer.address || !offer.port || !offer.localPath) {
      offer.status = 'failed'
      offer.note = 'Missing address/port/path for transfer.'
      return
    }
    if (this.transfers.has(offer.id)) return

    const position = offer.resumePosition || 0
    const transfer = new DccReceiveTransfer({
      id: offer.id,
      host: offer.address,
      port: offer.port,
      destPath: offer.localPath,
      position,
      expectedSize: offer.size,
      maxBytes: DCC_MAX_BYTES
    })
    this.transfers.set(offer.id, transfer)
    offer.status = 'transferring'

    transfer.on('progress', (p: { bytesReceived: number }) => {
      offer.bytesReceived = p.bytesReceived
      this.emit('update', publicView(offer))
    })
    transfer.on('completed', (p: { bytesReceived: number; path: string }) => {
      offer.bytesReceived = p.bytesReceived
      offer.status = 'completed'
      offer.note = `Saved to ${p.path} (not executed). ${DCC_LIMITATIONS}`
      this.transfers.delete(offer.id)
      this.emit('update', publicView(offer))
    })
    transfer.on('failed', (p: { error: string; bytesReceived: number }) => {
      offer.bytesReceived = p.bytesReceived
      offer.status = 'failed'
      offer.note = `Transfer failed: ${p.error}. ${DCC_LIMITATIONS}`
      this.transfers.delete(offer.id)
      this.emit('update', publicView(offer))
    })
    transfer.on('cancelled', (p: { bytesReceived: number }) => {
      offer.bytesReceived = p.bytesReceived
      offer.status = 'cancelled'
      this.transfers.delete(offer.id)
      this.emit('update', publicView(offer))
    })

    transfer.start()
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
    localPath: o.localPath
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
