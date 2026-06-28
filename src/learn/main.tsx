import React from 'react'
import ReactDOM from 'react-dom/client'
import LearnApp from './LearnApp'
import '../index.css'

ReactDOM.createRoot(document.getElementById('learn-root')!).render(
  <React.StrictMode>
    <LearnApp />
  </React.StrictMode>,
)
