import { Home, User, LogOut } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useLocation } from 'react-router-dom'

export function MobileNavigation() {
  const { user, signOut } = useAuthStore()
  const location = useLocation()

  const navItems = [
    {
      path: '/dashboard',
      icon: Home,
      label: 'Home'
    },
    {
      path: '/profile',
      icon: User,
      label: 'Profile'
    }
  ]

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <nav className="nav-mobile">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = location.pathname === item.path
        
        return (
          <a
            key={item.path}
            href={item.path}
            className={`nav-item-mobile ${isActive ? 'active' : ''}`}
          >
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm font-medium">
              {item.label}
            </span>
          </a>
        )
      })}
      
      <button
        onClick={handleSignOut}
        className="nav-item-mobile text-red-400 hover:text-red-300"
      >
        <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="text-xs sm:text-sm font-medium">
          Logout
        </span>
      </button>
    </nav>
  )
}
