import { useState, useEffect } from 'react'
import { getQuotaWarningMessage } from '../lib/quotaManager'
import { X } from 'lucide-react'

export function QuotaWarning() {
  const [warning, setWarning] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const checkQuota = () => {
      const quotaWarning = getQuotaWarningMessage()
      setWarning(quotaWarning)
      setIsVisible(!!quotaWarning)
    }

    // Check immediately
    checkQuota()

    // Check every 30 seconds
    const interval = setInterval(checkQuota, 30000)

    return () => clearInterval(interval)
  }, [])

  if (!isVisible || !warning) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <div className="bg-yellow-600/90 backdrop-blur-sm border border-yellow-500/50 rounded-lg p-4 shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-100 mb-1">
               API Quota Warning
            </h3>
            <p className="text-xs text-yellow-200">
              {warning}
            </p>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="ml-3 text-yellow-300 hover:text-yellow-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
} 