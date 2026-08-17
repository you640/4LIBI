// useUtmTracker.ts — Nuxt 4 composable pre UTM + gclid tracking
// Zachytáva utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid.

const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid']

export function useUtmTracker() {
  function captureUtmParameters(): Record<string, string> {
    if (typeof window === 'undefined') return {}
    const urlParams = new URLSearchParams(window.location.search)
    const utmData: Record<string, string> = {}
    UTM_PARAMS.forEach((param) => {
      const value = urlParams.get(param)
      if (value) utmData[param] = value
    })
    if (Object.keys(utmData).length > 0) {
      localStorage.setItem('forenz_utm_data', JSON.stringify(utmData))
      window.history.replaceState({}, '', window.location.pathname)
    }
    return utmData
  }

  function getUtmData(): Record<string, string> {
    if (typeof window === 'undefined') return {}
    try {
      return JSON.parse(localStorage.getItem('forenz_utm_data') || '{}')
    } catch {
      return {}
    }
  }

  function initUtmTracking(): void {
    const utmData = captureUtmParameters()
    if (Object.keys(utmData).length > 0) {
      console.log('[UTM] Zachytené:', utmData)
    }
  }

  function withUtm(properties: Record<string, any>): Record<string, any> {
    const utm = getUtmData()
    return { ...properties, ...utm }
  }

  return { captureUtmParameters, getUtmData, initUtmTracking, withUtm }
}
