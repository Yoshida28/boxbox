import { useState, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Flag } from 'lucide-react'

export function AuthPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { user, signInWithGoogle, initialize } = useAuthStore()
  const location = useLocation()
  
  const from = (location.state as any)?.from?.pathname || '/dashboard'

  useEffect(() => {
    initialize()
  }, [initialize])

  if (user) {
    return <Navigate to={from} replace />
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setLoading(true)

    try {
      const { error } = await signInWithGoogle()
      if (error) {
        setError(error.message || 'Failed to sign in with Google')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen-mobile bg-black flex items-center justify-center p-4 safe-top safe-bottom">
      <div className="w-full max-w-md animate-fade-in-mobile">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center mb-3 sm:mb-4">
            <Flag className="w-6 h-6 sm:w-8 sm:h-8 text-red-600 mr-2" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: 'Oswald' }}>
              boxbox
            </h1>
          </div>
          <p className="text-gray-400 text-sm sm:text-base">
            Welcome to the F1 community
          </p>
        </div>

        {/* Auth Form */}
        <div className="card-mobile p-6 sm:p-8 animate-slide-up-mobile">
          {error && (
            <div className="bg-red-900/50 border border-red-600 text-red-400 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm sm:text-base mb-4">
              {error}
            </div>
          )}

          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-white mb-2">Sign in to BoxBox</h2>
            <p className="text-gray-400 text-sm">
              Use your Google account to access F1 race reviews
            </p>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="btn-primary-mobile w-full text-sm sm:text-base flex items-center justify-center space-x-3"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-xs sm:text-sm">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}