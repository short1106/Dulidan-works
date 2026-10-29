import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@dulidan/design-system/tokens.css'
import './app.css'
import { App } from './App'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root is missing in index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
