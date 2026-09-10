import React from 'react'
import ReactDOM from 'react-dom/client'
import SeriesApp from './SeriesApp'
import '../index.css'

ReactDOM.createRoot(document.getElementById('series-root')!).render(
  <React.StrictMode>
    <SeriesApp />
  </React.StrictMode>,
)
