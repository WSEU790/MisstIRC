/**
 * Isolated DCC subsystem.
 *
 * Classic SEND send+receive with RESUME/ACCEPT for local/direct peers.
 * Covered by mock-server / mock-client tests. NAT/firewall reliability is **not** claimed.
 * Downloaded files are never auto-executed.
 */

export type { DccOfferView } from '../shared/types'
export { sanitizeDccFilename, resolveDownloadPath } from './paths'
export {
  parseDccSendArgs,
  parseDccResumeArgs,
  parseDccAcceptArgs,
  parseDccArgs,
  dccAddressToHost,
  ipv4ToDccNumber,
  type ParsedDccSend,
  type ParsedDccResume,
  type ParsedDccAccept,
  type ParsedDcc
} from './parse'
export {
  DccManager,
  DCC_LIMITATIONS,
  DCC_MAX_BYTES,
  DCC_MAX_QUEUE,
  DCC_CONNECT_TIMEOUT_MS,
  defaultTestDownloadDir
} from './manager'
export { DccReceiveTransfer, existingFileSize } from './transfer'
export { DccSendTransfer } from './send-transfer'
export { startMockDccSend, type MockDccSendHandle } from './mock-server'
export { mockDccReceive } from './mock-client'

export function assertDccUnavailable(action: string): never {
  throw new Error(
    `MisstIRC DCC: "${action}" is not available. See DCC_LIMITATIONS — NAT traversal remains limited.`
  )
}
