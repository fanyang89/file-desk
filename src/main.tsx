import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Theme } from '@radix-ui/themes'
import '@radix-ui/themes/styles.css'
import './index.css'
import './App.css'
import App from './App.tsx'
import { ToastProvider } from '@/components/Toast/ToastProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Theme appearance="light" accentColor="blue" radius="medium">
      <App />
      <ToastProvider />
    </Theme>
  </StrictMode>,
)
