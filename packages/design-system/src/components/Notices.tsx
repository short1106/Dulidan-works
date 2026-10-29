import { useSyncExternalStore, type ReactNode } from 'react'
import { Notice } from './Notice'

/**
 * Short messages at the bottom right, e.g. "Gespeichert".
 * Call notify() from anywhere and render <NoticeArea /> once in the app.
 */
export interface NoticeItem {
  id: number
  tone: 'info' | 'success' | 'error'
  text: string
}

let notices: NoticeItem[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit(next: NoticeItem[]): void {
  notices = next
  listeners.forEach((listener) => listener())
}

/** Shows a message. Errors stay until closed, others vanish after a few seconds. */
export function notify(text: string, tone: NoticeItem['tone'] = 'info'): void {
  const id = nextId++
  emit([...notices.slice(-2), { id, tone, text }])
  if (tone !== 'error') setTimeout(() => dismissNotice(id), 3500)
}

export function dismissNotice(id: number): void {
  emit(notices.filter((item) => item.id !== id))
}

export interface NoticeAreaProps {
  icons: Record<NoticeItem['tone'], ReactNode>
  closeLabel: string
}

export function NoticeArea({ icons, closeLabel }: NoticeAreaProps): React.JSX.Element {
  const items = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => notices
  )
  return (
    <div className="dd-notice-area">
      {items.map((notice) => (
        <Notice
          key={notice.id}
          tone={notice.tone}
          icon={icons[notice.tone]}
          className="dd-notice-area__item"
          onClose={() => dismissNotice(notice.id)}
          closeLabel={closeLabel}
        >
          {notice.text}
        </Notice>
      ))}
    </div>
  )
}
