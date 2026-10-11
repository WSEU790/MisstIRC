/**
 * Isolated DCC subsystem (Phase 4).
 *
 * Offers are parsed and path-validated. Full SEND/GET through NAT/firewalls is
 * **not** claimed — transfers require user approval and remain limited.
 */

import { randomUUID } from 'node:crypto'
import type { DccOfferView } from '../shared/types'
import { sanitizeDccFilename } from './paths'

export type { DccOfferView }
export { sanitizeDccFilename, resolveDownloadPath } from './paths'

export const DCC_LIMITATIONS =
  'DCC SEND/GET often fails behind NAT/firewalls without passive modes or port forwards. MisstIRC validates paths and queues offers; full transfer reliability is not guaranteed.'

export interface ParsedDccSend {
  filename: string
  address: string
  port: number
  size?: number
}

/** Parse `DCC SEND filename addr port [size]` CTCP args (filename may be quoted). */
export function parseDccSendArgs(args: string): ParsedDccSend | null {
  const trimmed = args.trim()
  if (!trimmed.toUpperCase().startsWith('SEND')) return null
  let rest = trimmed.slice(4).trim()
  let filename: string
  if (rest.startsWith('"')) {
    const end = rest.indexOf('"', 1)
    if (end === -1) return null
    filename = rest.slice(1, end)
    rest = rest.slice(end + 1).trim()
  } else {
    const sp = rest.indexOf(' ')
    if (sp === -1) return null
    filename = rest.slice(0, sp)
    rest = rest.slice(sp + 1).trim()
  }
  const parts = rest.split(/\s+/)
  if (parts.length < 2) return null
  const address = parts[0]!
  const port = Number(parts[1])
  const size = parts[2] ? Number(parts[2]) : undefined
  if (!Number.isFinite(port) || port <= 0 || port > 65535) return null
  return { filename, address, port, size: Number.isFinite(size) ? size : undefined }
}

export class DccManager {
  private offers = new Map<string, DccOfferView>()

  list(): DccOfferView[] {
    return [...this.offers.values()].sort((a, b) => b.createdAt - a.createdAt)
  }

  ingestCtcp(
    connectionId: string,
    peerNick: string,
    args: string
  ): DccOfferView | null {
    const parsed = parseDccSendArgs(args)
    if (!parsed) return null
    const safe = sanitizeDccFilename(parsed.filename)
    const id = randomUUID()
    const offer: DccOfferView = {
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
      createdAt: Date.now()
    }
    this.offers.set(id, offer)
    return offer
  }

  respond(offerId: string, accept: boolean): DccOfferView | null {
    const offer = this.offers.get(offerId)
    if (!offer) return null
    if (offer.status !== 'pending') return offer
    if (!accept) {
      offer.status = 'rejected'
      return offer
    }
    // Full socket transfer not implemented — mark unsupported with clear label.
    offer.status = 'unsupported'
    offer.note = `${DCC_LIMITATIONS} Accept recorded; active transfer sockets are not enabled in this build.`
    return offer
  }
}

export function assertDccUnavailable(action: string): never {
  throw new Error(
    `MisstIRC DCC: "${action}" is not fully implemented. ${DCC_LIMITATIONS}`
  )
}
