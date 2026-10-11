/**
 * Isolated DCC subsystem.
 *
 * Classic SEND receive + RESUME/ACCEPT are implemented for local/direct peers
 * and covered by mock-server tests. NAT/firewall reliability is **not** claimed.
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
  defaultTestDownloadDir
} from './manager'
export { DccReceiveTransfer, existingFileSize } from './transfer'
export { startMockDccSend, type MockDccSendHandle } from './mock-server'

export function assertDccUnavailable(action: string): never {
  throw new Error(
    `MisstIRC DCC: "${action}" is not available. See DCC_LIMITATIONS — outbound SEND and NAT traversal are limited.`
  )
}
