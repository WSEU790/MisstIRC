/**
 * DCC subsystem scaffold (Phase 4).
 * SEND/GET/CHAT are not implemented. Keep DCC isolated from the IRC core.
 */

export type DccTransferState = 'planned' | 'unsupported'

export interface DccTransferRequest {
  connectionId: string
  peerNick: string
  filename: string
  size?: number
}

export function assertDccUnavailable(action: string): never {
  throw new Error(
    `MisstIRC DCC: "${action}" is not implemented. Transfers will be an isolated subsystem.`
  )
}
