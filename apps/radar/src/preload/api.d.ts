import type { RadarApi } from '../shared/api'

declare global {
  interface Window {
    radar: RadarApi
  }
}
