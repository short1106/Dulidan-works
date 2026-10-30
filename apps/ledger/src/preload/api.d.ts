import type { LedgerApi } from '../shared/api'

declare global {
  interface Window {
    ledger: LedgerApi
  }
}
