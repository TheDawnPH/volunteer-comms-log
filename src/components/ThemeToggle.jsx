import React from 'react'
import { useTheme } from '../context/ThemeContext.jsx'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const options = [
    { key: 'light', label: '☀️' },
    { key: 'system', label: '💻' },
    { key: 'dark', label: '🌙' }
  ]
  return (
    <div className="theme-toggle" aria-label="Theme">
      {options.map(o => (
        <button
          key={o.key}
          className={theme === o.key ? 'active' : ''}
          onClick={() => setTheme(o.key)}
          title={o.key}
        >{o.label}</button>
      ))}
    </div>
  )
}
