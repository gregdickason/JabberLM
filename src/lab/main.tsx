import React from 'react'
import ReactDOM from 'react-dom/client'
import LabApp from './LabApp'
import '../index.css'

ReactDOM.createRoot(document.getElementById('lab-root')!).render(
  <React.StrictMode>
    <LabApp />
  </React.StrictMode>,
)
