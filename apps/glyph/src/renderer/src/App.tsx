import { t } from './i18n'

/**
 * Step 1: an empty window in the Dulidan look.
 * The card in the middle is a placeholder until the editor exists.
 */
export function App(): React.JSX.Element {
  return (
    <main className="app">
      <section className="placeholder-card" aria-labelledby="welcome-title">
        <span className="corner corner--tl" aria-hidden="true" />
        <span className="corner corner--tr" aria-hidden="true" />
        <span className="corner corner--bl" aria-hidden="true" />
        <span className="corner corner--br" aria-hidden="true" />

        <p className="brand">{t.brand}</p>
        <h1 className="app-name">{t.appName}</h1>
        <h2 id="welcome-title" className="welcome-title">
          {t.welcomeTitle}
        </h2>
        <p className="welcome-text">{t.welcomeText}</p>
      </section>
    </main>
  )
}
