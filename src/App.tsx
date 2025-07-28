import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'
import { RacePage } from './pages/RacePage'
import { ProfilePage } from './pages/ProfilePage'
import ThumbnailAdminPage from './pages/ThumbnailAdminPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { initializeAutoImport } from './lib/autoImportService'

function App() {
  useEffect(() => {
    // Initialize auto-import service when app starts
    initializeAutoImport().catch(console.error)
  }, [])

  return (
    <Router>
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
        <Route 
          path="/admin/thumbnails" 
          element={
            <ProtectedRoute>
              <ThumbnailAdminPage />
            </ProtectedRoute>
          } 
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  )
}

export default App