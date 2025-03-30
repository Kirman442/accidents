import { StrictMode } from 'react'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { createRoot } from 'react-dom/client'
// import './index.css'
import App from './App.jsx'
import './css/custom.css'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  // <StrictMode>
  <App />
  // </StrictMode>,
)
