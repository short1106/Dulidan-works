import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@dulidan/design-system/styles.css'
import '@dulidan/editor/editor.css'
import './styles/app.css'
import { App } from './App'
import { applySettingsToDocument, loadSettings } from './state/settings'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root is missing in index.html')

void loadSettings().then((settings) => {
  applySettingsToDocument(settings)
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
})
