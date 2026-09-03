import React from 'react'
import ReactDOM from 'react-dom/client'
import TeachersApp from './TeachersApp'
import '../index.css'

ReactDOM.createRoot(document.getElementById('teachers-root')!).render(
  <React.StrictMode>
    <TeachersApp />
  </React.StrictMode>,
)
