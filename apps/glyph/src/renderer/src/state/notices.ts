import { useSyncExternalStore } from 'react'
import { createStore } from '@dulidan/core'

export interface NoticeItem {
  id: number
  tone: 'info' | 'success' | 'error'
  text: string
}

const noticeStore = createStore<NoticeItem[]>([])
let nextId = 1

/** Shows a short message at the bottom. Errors stay until closed. */
export function notify(text: string, tone: NoticeItem['tone'] = 'info'): void {
  const id = nextId++
  noticeStore.set((list) => [...list.slice(-2), { id, tone, text }])
  if (tone !== 'error') setTimeout(() => dismissNotice(id), 3500)
}

export function dismissNotice(id: number): void {
  noticeStore.set((list) => list.filter((item) => item.id !== id))
}

export function useNotices(): NoticeItem[] {
  return useSyncExternalStore(noticeStore.subscribe, noticeStore.get)
}
