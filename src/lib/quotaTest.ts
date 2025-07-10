/**
 * Test utilities for quota management
 */

import { quotaManager } from './quotaManager'

export function testQuotaSystem() {
  console.log('=== Testing Quota System ===')
  
  // Test 1: Check initial state
  console.log('Initial quota info:', quotaManager.getQuotaInfo())
  console.log('Can make request:', quotaManager.canMakeRequest())
  
  // Test 2: Simulate some requests
  console.log('\n--- Simulating 5 requests ---')
  for (let i = 0; i < 5; i++) {
    quotaManager.recordRequest()
    console.log(`Request ${i + 1}: ${quotaManager.getQuotaInfo().usedQuota} used`)
  }
  
  // Test 3: Check if we can still make requests
  console.log('\nCan still make requests:', quotaManager.canMakeRequest())
  console.log('Remaining requests:', quotaManager.getRemainingRequests())
  
  // Test 4: Simulate quota exceeded
  console.log('\n--- Simulating quota exceeded ---')
  quotaManager.simulateQuotaExceeded()
  console.log('Quota exceeded:', quotaManager.isQuotaExceeded())
  console.log('Can make request:', quotaManager.canMakeRequest())
  
  // Test 5: Reset quota
  console.log('\n--- Resetting quota ---')
  localStorage.removeItem('youtube_api_quota')
  console.log('After reset:', quotaManager.getQuotaInfo())
  
  console.log('=== Quota Test Complete ===')
}

// Run test if this file is imported directly
if (typeof window !== 'undefined') {
  // Add to window for console access
  (window as any).testQuota = testQuotaSystem
} 