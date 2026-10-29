import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { ask, Button, cx, Dialog, notify, TextField } from '@dulidan/design-system'
import type { AccountInput, AccountSettings, MailErrorCode, ProviderPreset } from '../../../shared/ipc'
import { can } from '../features'
import { t } from '../i18n'
import { errorText, refreshLists } from '../state/mail'
import { reloadAccounts, useAccounts, useMode } from '../state/settings'
import { setUi, useUi } from '../state/ui'

type Provider = 'gmail' | 'ionos' | 'custom'

const EMPTY_SERVER = { host: '', port: 993, secure: true }

/**
 * Set up or edit a mail account. For Gmail and IONOS only address and
 * password are needed; the server settings are filled in automatically.
 */
export function AccountDialog({ firstRun = false }: { firstRun?: boolean }): React.JSX.Element | null {
  const { accountDialog } = useUi()
  const accounts = useAccounts()
  const mode = useMode()
  const editing: AccountSettings | null = accountDialog && accountDialog !== 'new' ? (accounts.find((item) => item.id === accountDialog) ?? null) : null
  const open = firstRun || accountDialog !== null

  const [presets, setPresets] = useState<Record<string, ProviderPreset>>({})
  const [provider, setProvider] = useState<Provider>('ionos')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [imap, setImap] = useState(EMPTY_SERVER)
  const [smtp, setSmtp] = useState({ ...EMPTY_SERVER, port: 465 })
  const [saveSentCopy, setSaveSentCopy] = useState(true)
  const [signature, setSignature] = useState('')
  const [showServer, setShowServer] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problems, setProblems] = useState<{ imap: MailErrorCode | null; smtp: MailErrorCode | null } | null>(null)
  const [secure, setSecure] = useState(true)

  useEffect(() => {
    void window.relay.accounts.presets().then(setPresets)
    void window.relay.appInfo().then((info) => setSecure(info.secureStorage))
  }, [])

  useEffect(() => {
    if (!open) return
    setProblems(null)
    setPassword('')
    if (editing) {
      setProvider(editing.provider)
      setDisplayName(editing.displayName)
      setEmail(editing.email)
      setUsername(editing.username)
      setImap(editing.imap)
      setSmtp(editing.smtp)
      setSaveSentCopy(editing.saveSentCopy)
      setSignature(editing.signature)
      setShowServer(editing.provider === 'custom')
    } else {
      setProvider('ionos')
      setDisplayName('')
      setEmail('')
      setUsername('')
      setSignature('')
      setShowServer(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountDialog])

  // Choosing Gmail or IONOS fills in the servers.
  useEffect(() => {
    if (editing) return
    const preset = provider === 'custom' ? null : presets[provider]
    if (preset) {
      setImap(preset.imap)
      setSmtp(preset.smtp)
      setSaveSentCopy(preset.saveSentCopy)
    } else {
      setImap(EMPTY_SERVER)
      setSmtp({ ...EMPTY_SERVER, port: 465 })
      setSaveSentCopy(true)
    }
    setShowServer(provider === 'custom')
  }, [provider, presets, editing])

  if (!open) return null
  const close = (): void => setUi({ accountDialog: null })

  const input = (): AccountInput => ({
    displayName: displayName.trim(),
    email: email.trim(),
    username: (username || email).trim(),
    provider,
    imap: { ...imap, host: imap.host.trim() },
    smtp: { ...smtp, host: smtp.host.trim() },
    saveSentCopy,
    // Kept as plain text; the composer turns it into HTML.
    signature: signature.trim(),
    dailySendLimit: editing?.dailySendLimit ?? null
  })

  const submit = async (): Promise<void> => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return notify(t.accounts.invalidEmail, 'error')
    if (!editing && !password) return notify(t.accounts.needPassword, 'error')
    setBusy(true)
    setProblems(null)
    try {
      const settings = input()
      // A new password or changed servers are checked before saving.
      if (password) {
        const test = await window.relay.accounts.test(settings, password)
        if (test.imap || test.smtp) {
          setProblems(test)
          return
        }
      }
      const result = editing ? await window.relay.accounts.update(editing.id, settings, password || undefined) : await window.relay.accounts.add(settings, password)
      if (!result.ok) return notify(errorText(result.error), 'error')
      await reloadAccounts()
      await refreshLists()
      if (!editing) notify(t.accounts.added, 'success')
      close()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (): Promise<void> => {
    if (!editing) return
    const answer = await ask({
      title: t.accounts.removeTitle,
      text: t.accounts.removeText(editing.email),
      cancelValue: 'no',
      choices: [
        { value: 'no', label: t.dialogs.cancel, variant: 'ghost' },
        { value: 'yes', label: t.dialogs.remove, variant: 'primary' }
      ]
    })
    if (answer !== 'yes') return
    await window.relay.accounts.remove(editing.id)
    await reloadAccounts()
    await refreshLists()
    close()
  }

  const providers: Array<{ id: Provider; label: string }> = [
    { id: 'ionos', label: t.accounts.ionos },
    { id: 'gmail', label: t.accounts.gmail },
    { id: 'custom', label: t.accounts.custom }
  ]
  const serverAllowed = provider === 'custom' || can('serverSettings', mode)

  return (
    <Dialog
      open
      title={editing ? t.accounts.editTitle : firstRun ? t.accounts.welcomeTitle : t.accounts.title}
      onClose={close}
      dismissible={!firstRun}
      className="account-dialog"
      actions={
        <>
          {editing && (
            <Button variant="ghost" onClick={() => void remove()}>
              {t.accounts.remove}
            </Button>
          )}
          {!firstRun && <Button onClick={close}>{t.dialogs.cancel}</Button>}
          <Button variant="primary" disabled={busy || !secure} onClick={() => void submit()}>
            {busy ? t.accounts.checking : editing ? t.accounts.save : t.accounts.check}
          </Button>
        </>
      }
    >
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {firstRun && <p>{t.accounts.welcomeText}</p>}
        {!secure && <p className="form-error">{t.accounts.noSecureStorage}</p>}

        {!editing && (
          <fieldset className="choice-cards">
            <legend>{t.accounts.provider}</legend>
            {providers.map((item) => (
              <label key={item.id} className={cx('choice-card', provider === item.id && 'is-selected')}>
                <input type="radio" name="provider" checked={provider === item.id} onChange={() => setProvider(item.id)} />
                {item.label}
              </label>
            ))}
          </fieldset>
        )}

        <TextField label={t.accounts.email} type="email" autoComplete="off" value={email} autoFocus={!editing} disabled={!!editing} onChange={(event) => setEmail(event.target.value)} />
        <TextField label={t.accounts.displayName} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        <TextField
          label={editing ? t.accounts.passwordKeep : provider === 'gmail' ? t.accounts.appPassword : t.accounts.password}
          type="password"
          autoComplete="off"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {provider === 'gmail' && !editing && (
          <section className="help-box" aria-label={t.accounts.gmailHelpTitle}>
            <h3>{t.accounts.gmailHelpTitle}</h3>
            <ol>
              {t.accounts.gmailHelp.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p>{t.accounts.gmailHelpNote}</p>
          </section>
        )}
        {provider === 'ionos' && !editing && <p className="hint">{t.accounts.ionosHelp}</p>}

        {problems && (
          <div className="problems" role="alert">
            {(['imap', 'smtp'] as const).map((part) => (
              <p key={part} className={problems[part] ? 'problems__bad' : 'problems__good'}>
                {problems[part] ? <CircleAlert aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
                <strong>{part === 'imap' ? t.accounts.imapFailed : t.accounts.smtpFailed}:</strong> {problems[part] ? errorText(problems[part]) : t.dialogs.ok}
              </p>
            ))}
          </div>
        )}

        <label className="field">
          <span className="field__label">{t.accounts.signature}</span>
          <textarea className="textarea" rows={3} value={signature} onChange={(event) => setSignature(event.target.value)} />
        </label>

        {serverAllowed && (
          <details className="server-box" open={showServer} onToggle={(event) => setShowServer((event.target as HTMLDetailsElement).open)}>
            <summary>{t.accounts.server}</summary>
            <p className="hint">{t.accounts.serverHint}</p>
            <TextField label={t.accounts.username} value={username} placeholder={email} onChange={(event) => setUsername(event.target.value)} />
            {(['imap', 'smtp'] as const).map((part) => {
              const server = part === 'imap' ? imap : smtp
              const set = part === 'imap' ? setImap : setSmtp
              return (
                <fieldset key={part} className="server-box__group">
                  <legend>{part === 'imap' ? t.accounts.imap : t.accounts.smtp}</legend>
                  <div className="form-row">
                    <TextField label={t.accounts.host} value={server.host} onChange={(event) => set({ ...server, host: event.target.value })} />
                    <TextField label={t.accounts.port} inputMode="numeric" value={String(server.port)} onChange={(event) => set({ ...server, port: Number(event.target.value.replace(/\D/g, '')) || 0 })} />
                  </div>
                  <label className="check">
                    <input type="checkbox" checked={server.secure} onChange={(event) => set({ ...server, secure: event.target.checked })} />
                    {t.accounts.secure}
                  </label>
                </fieldset>
              )
            })}
            <label className="check">
              <input type="checkbox" checked={saveSentCopy} onChange={(event) => setSaveSentCopy(event.target.checked)} />
              {t.accounts.saveSentCopy}
            </label>
          </details>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}
