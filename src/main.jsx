import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App'
import { AuthProvider } from '@/context/AuthContext'
import PageLoader from '@/components/PageLoader'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <PageLoader />
          <App />
        </AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'text-sm',
            style: { background: '#0F172A', color: '#F8FAFC', border: '1px solid #1E293B' },
            success: { iconTheme: { primary: '#22C55E', secondary: '#ffffff' } },
            error:   { iconTheme: { primary: '#9C1C2A', secondary: '#ffffff' } },
          }}
        />
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>,
)
