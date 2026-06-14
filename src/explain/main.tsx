import React from 'react'
import ReactDOM from 'react-dom/client'
import ExplainApp from './ExplainApp'
import '../index.css'

ReactDOM.createRoot(document.getElementById('explain-root')!).render(
  <React.StrictMode>
    <ExplainApp />
  </React.StrictMode>,
)
