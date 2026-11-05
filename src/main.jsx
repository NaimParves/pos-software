import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import { Toaster } from './components/Toast'
import './index.css'

// GitHub Pages cannot route /invoices etc. to index.html, so the demo uses #/invoices
const Router = import.meta.env.VITE_DEMO ? HashRouter : BrowserRouter

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <App />
      <Toaster />
    </Router>
  </React.StrictMode>,
)
