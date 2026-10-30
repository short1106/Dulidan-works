import type { PrismApi } from '../shared/api'

declare global {
  interface Window {
    prism: PrismApi
  }
}
