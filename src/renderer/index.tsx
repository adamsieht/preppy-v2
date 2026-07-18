import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { HashRouter } from 'react-router-dom'
import './styles/touch.css'
import './styles/tailwind.css'
import { store } from './store'
import App from './App'
import { THEME_KEY, ACCENT_KEY, applyDowAccent } from './pages/Preppy/constants'

// Apply theme + accent before first paint to avoid flash
;(function () {
  const theme  = localStorage.getItem(THEME_KEY)  ?? 'dark'
  const accent = localStorage.getItem(ACCENT_KEY) ?? 'green'
  if (theme === 'light') document.documentElement.classList.add('theme-light')
  if (accent === 'dow') {
    applyDowAccent()
  } else {
    document.documentElement.setAttribute('data-accent', accent)
  }
})()

const container = document.getElementById('root')!
createRoot(container).render(
  <React.StrictMode>
    <Provider store={store}>
      <HashRouter>
        <App />
      </HashRouter>
    </Provider>
  </React.StrictMode>
)
