import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import './theme.css'
import './styles/mobile-pro.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter basename="/app"><App /></BrowserRouter>
)
