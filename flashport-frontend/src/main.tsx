import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LineraWalletProvider } from './hooks/useLineraWallet.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LineraWalletProvider>
      <App />
    </LineraWalletProvider>
  </StrictMode>,
)
