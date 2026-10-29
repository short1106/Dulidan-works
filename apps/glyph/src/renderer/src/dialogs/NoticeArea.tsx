import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { Notice } from '@dulidan/design-system'
import { t } from '../i18n'
import { dismissNotice, useNotices } from '../state/notices'

const ICONS = { info: <Info />, success: <CircleCheck />, error: <CircleAlert /> }

/** Short messages at the bottom right, e.g. "Gespeichert". */
export function NoticeArea(): React.JSX.Element {
  const notices = useNotices()
  return (
    <div className="notice-area">
      {notices.map((notice) => (
        <Notice
          key={notice.id}
          tone={notice.tone}
          icon={ICONS[notice.tone]}
          className="notice-area__item"
          onClose={() => dismissNotice(notice.id)}
          closeLabel={t.dialogs.close}
        >
          {notice.text}
        </Notice>
      ))}
    </div>
  )
}
