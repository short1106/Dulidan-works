import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@dulidan/design-system/styles.css'
import './styles/app.css'
import './styles/editor.css'
import './styles/print.css'
import { App } from './App'
import { applySettingsToDocument, loadSettings } from './state/settings'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root is missing in index.html')

// Load the settings first, so theme and mode are right from the first frame.
void loadSettings().then((settings) => {
  applySettingsToDocument(settings)
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
})
