import { useEffect, useState } from 'react'
import ThemeContext from './themeContext'

const THEME_STORAGE_KEY = 'missing-marks-theme'

function getInitialTheme() {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  const theme = savedTheme === 'dark' ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme
  return theme
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => setTheme((current) => current === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
