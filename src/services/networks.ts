import type { NetworkConfig } from '../shared/types'
import type { AppDatabase } from '../storage/database'

/** Server profile service — thin repository facade over SQLite. */
export class NetworkService {
  constructor(private readonly db: AppDatabase) {}

  list(): NetworkConfig[] {
    return this.db.listNetworks()
  }

  save(network: NetworkConfig): void {
    this.db.saveNetwork(network)
  }

  delete(id: string): void {
    this.db.deleteNetwork(id)
  }
}
