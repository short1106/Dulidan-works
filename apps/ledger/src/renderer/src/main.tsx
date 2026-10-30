import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@dulidan/design-system/styles.css'
import './styles/app.css'
import { App } from './App'
import { loadData } from './state/data'
import { loadSettings } from './state/settings'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root is missing in index.html')

// Settings and company data are loaded first, so no form starts out empty.
void Promise.all([loadSettings(), loadData()]).then(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
})
