import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'

// Base: tokens, componentes, reset (sin media queries de layout)
import './index.css'
import './theme.css'
import './styles/mobile-pro.css'

// Device layers: se importan al final para que [data-device] tenga mayor
// especificidad (0,2,0) que los selectores genéricos de index.css (0,1,0).
// El orden importa: cada archivo gana sobre los anteriores.
import './styles/device-desktop.css'
import './styles/device-tablet.css'
import './styles/device-mobile.css'

// Inicialización sincrónica: aplica data-device y data-orient en <html>
// antes de que React renderice (ver useDevice.js — módulo-level call).
import './hooks/useDevice.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter basename="/app"><App /></BrowserRouter>
)
