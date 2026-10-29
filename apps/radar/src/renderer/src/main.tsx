import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@dulidan/design-system/styles.css'
import './styles/app.css'
import { App } from './App'
import { loadSettings } from './state/settings'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root is missing in index.html')

void loadSettings().then(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
})
