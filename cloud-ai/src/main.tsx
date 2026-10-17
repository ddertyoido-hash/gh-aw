import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'highlight.js/styles/github.css'
import './index.css'
import App from './App'

const container = document.getElementById('root')
if (!container) throw new Error('Cloud AI could not find its root element')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
