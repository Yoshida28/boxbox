import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'
import { RacePage } from './pages/RacePage'
import { ProfilePage } from './pages/ProfilePage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { MobileNavigation } from './components/MobileNavigation'
import { initializeAutoImport } from './lib/autoImportService'
import { useAuthStore } from './store/authStore'

function App() {
  const { user } = useAuthStore()
  
  useEffect(() => {
    // Initialize auto-import service when app starts
    initializeAutoImport().catch(console.error)
  }, [])

  return (
    <Router>
      <div className="min-h-screen-mobile bg-black">
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/race/:id" 
            element={
              <ProtectedRoute>
                <RacePage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } 
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        
        {/* Mobile Navigation - Only show when user is logged in */}
        {user && (
          <MobileNavigation />
        )}
      </div>
    </Router>
  )
}

export default App