import { useEffect, useState } from 'react'
import { Button, Card, TextField, notify } from '@dulidan/design-system'
import { de as t } from '../i18n/de'

/** Looks for companies in a branch and town via Google Places. */
export function SearchPage(): React.JSX.Element {
  const [branche, setBranche] = useState('')
  const [ort, setOrt] = useState('')
  const [running, setRunning] = useState(false)

  useEffect(() => {
    void window.radar.config.get().then((config) => {
      setBranche(config.branche)
      setOrt(config.ort)
    })
  }, [])

  async function run(): Promise<void> {
    setRunning(true)
    try {
      await window.radar.config.update({ branche, ort })
      const result = await window.radar.search.run()
      notify(result.message, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : t.notices.error, 'error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <section aria-labelledby="search-title" className="radar-page">
      <h1 id="search-title">{t.search.title}</h1>
      <Card className="radar-card">
        <p>{t.search.text}</p>
        <div className="radar-form">
          <TextField label={t.search.branche} value={branche} onChange={(event) => setBranche(event.target.value)} />
          <TextField label={t.search.ort} value={ort} onChange={(event) => setOrt(event.target.value)} />
        </div>
        <Button variant="primary" onClick={() => void run()} disabled={running || !branche || !ort}>
          {running ? t.search.running : t.search.run}
        </Button>
      </Card>
    </section>
  )
}
