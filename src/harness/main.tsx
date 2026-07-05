import React from 'react'
import ReactDOM from 'react-dom/client'
import HarnessApp from './HarnessApp'
import '../index.css'

ReactDOM.createRoot(document.getElementById('harness-root')!).render(
  <React.StrictMode>
    <HarnessApp />
  </React.StrictMode>,
)
