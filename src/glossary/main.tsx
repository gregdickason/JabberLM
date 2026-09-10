import React from 'react'
import ReactDOM from 'react-dom/client'
import GlossaryApp from './GlossaryApp'
import '../index.css'

ReactDOM.createRoot(document.getElementById('glossary-root')!).render(
  <React.StrictMode>
    <GlossaryApp />
  </React.StrictMode>,
)
