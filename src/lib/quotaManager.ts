/**
 * YouTube API Quota Management
 * Helps track and manage API quota usage
 */

interface QuotaInfo {
  dailyQuota: number
  usedQuota: number
  remainingQuota: number
  resetTime: string
}

class QuotaManager {
  private static instance: QuotaManager
  private quotaKey = 'youtube_api_quota'
  private requestCount = 0
  private dailyLimit = 10000 // Default daily quota for YouTube API

  private constructor() {
    this.loadQuotaInfo()
  }

  static getInstance(): QuotaManager {
    if (!QuotaManager.instance) {
      QuotaManager.instance = new QuotaManager()
    }
    return QuotaManager.instance
  }

  private loadQuotaInfo(): void {
    try {
      const stored = localStorage.getItem(this.quotaKey)
      if (stored) {
        const quotaInfo: QuotaInfo = JSON.parse(stored)
        const now = new Date()
        const resetTime = new Date(quotaInfo.resetTime)
        
        // Check if we need to reset the daily count
        if (now > resetTime) {
          this.resetDailyQuota()
        } else {
          this.requestCount = quotaInfo.usedQuota
        }
      }
    } catch (error) {
      console.warn('Failed to load quota info:', error)
      this.resetDailyQuota()
    }
  }

  private saveQuotaInfo(): void {
    try {
      const quotaInfo: QuotaInfo = {
        dailyQuota: this.dailyLimit,
        usedQuota: this.requestCount,
        remainingQuota: this.dailyLimit - this.requestCount,
        resetTime: this.getNextResetTime()
      }
      localStorage.setItem(this.quotaKey, JSON.stringify(quotaInfo))
    } catch (error) {
      console.warn('Failed to save quota info:', error)
    }
  }

  private getNextResetTime(): string {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    return tomorrow.toISOString()
  }

  private resetDailyQuota(): void {
    this.requestCount = 0
    this.saveQuotaInfo()
  }

  /**
   * Record an API request
   */
  recordRequest(): void {
    this.requestCount++
    this.saveQuotaInfo()
  }

  /**
   * Check if we can make an API request
   */
  canMakeRequest(): boolean {
    return this.requestCount < this.dailyLimit
  }

  /**
   * Get remaining requests for today
   */
  getRemainingRequests(): number {
    return Math.max(0, this.dailyLimit - this.requestCount)
  }

  /**
   * Check if we're approaching quota limit
   */
  isQuotaLow(): boolean {
    return this.requestCount >= this.dailyLimit * 0.8 // 80% of daily limit
  }

  /**
   * Check if quota is exceeded
   */
  isQuotaExceeded(): boolean {
    return this.requestCount >= this.dailyLimit
  }

  /**
   * Get current quota information
   */
  getQuotaInfo(): QuotaInfo {
    return {
      dailyQuota: this.dailyLimit,
      usedQuota: this.requestCount,
      remainingQuota: this.dailyLimit - this.requestCount,
      resetTime: this.getNextResetTime()
    }
  }

  /**
   * Set custom daily limit
   */
  setDailyLimit(limit: number): void {
    this.dailyLimit = limit
    this.saveQuotaInfo()
  }

  /**
   * Set current request count (for testing)
   */
  setRequestCount(count: number): void {
    this.requestCount = count
    this.saveQuotaInfo()
  }

  /**
   * Simulate quota exceeded (for testing)
   */
  simulateQuotaExceeded(): void {
    this.requestCount = this.dailyLimit
    this.saveQuotaInfo()
  }

  /**
   * Get quota usage percentage
   */
  getUsagePercentage(): number {
    return (this.requestCount / this.dailyLimit) * 100
  }

  /**
   * Get formatted quota status
   */
  getQuotaStatus(): string {
    const percentage = this.getUsagePercentage()
    if (percentage >= 100) {
      return 'Quota Exceeded'
    } else if (percentage >= 80) {
      return 'Quota Low'
    } else {
      return 'Quota OK'
    }
  }
}

// Export singleton instance
export const quotaManager = QuotaManager.getInstance()

/**
 * Utility function to check if we should skip API calls
 */
export function shouldSkipApiCall(): boolean {
  return !quotaManager.canMakeRequest()
}

/**
 * Utility function to get quota warning message
 */
export function getQuotaWarningMessage(): string | null {
  if (quotaManager.isQuotaExceeded()) {
    return 'YouTube API quota exceeded. Using cached data only.'
  } else if (quotaManager.isQuotaLow()) {
    return `YouTube API quota is running low (${quotaManager.getUsagePercentage().toFixed(1)}% used).`
  }
  return null
} 