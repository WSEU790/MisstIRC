import type { MisstIrcApi } from '../../shared/types'

declare global {
  interface Window {
    misstirc: MisstIrcApi
  }
}

export {}
