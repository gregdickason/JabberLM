import React from 'react'
import ReactDOM from 'react-dom/client'
import EmbedApp from './EmbedApp'
import '../index.css'

ReactDOM.createRoot(document.getElementById('embed-root')!).render(
  <React.StrictMode>
    <EmbedApp />
  </React.StrictMode>,
)
