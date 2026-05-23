import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App'
import { AuthProvider } from '@/context/AuthContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'text-sm',
          style: { background: '#0F172A', color: '#F8FAFC', border: '1px solid #1E293B' },
          success: { iconTheme: { primary: '#22C55E', secondary: '#ffffff' } },
          error:   { iconTheme: { primary: '#B7202E', secondary: '#ffffff' } },
        }}
      />
    </BrowserRouter>
  </StrictMode>,
)
