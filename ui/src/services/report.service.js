import { apiHelpers } from './api'

export const reportService = {
  // Daily summary report
  async getDailySummary(date) {
    return apiHelpers.get(`/reports/daily-summary?date=${date}`)
  },

  // Transaction trends
  async getTransactionTrends(days = 30) {
    return apiHelpers.get(`/reports/trends?days=${days}`)
  },

  // Institution comparison
  async getInstitutionComparison(days = 30) {
    return apiHelpers.get(`/reports/institution-comparison?days=${days}`)
  },

  // Peak hours analysis
  async getPeakHoursAnalysis(days = 7) {
    return apiHelpers.get(`/reports/peak-hours?days=${days}`)
  },

  // Success rate by bank
  async getSuccessRateByBank(days = 30) {
    return apiHelpers.get(`/reports/success-rate-by-bank?days=${days}`)
  },

  // Revenue report
  async getRevenueReport(fromDate, toDate) {
    return apiHelpers.get(`/reports/revenue?fromDate=${fromDate}&toDate=${toDate}`)
  },

  // Export report as CSV
  async exportReport(type, params = {}) {
    const queryParams = new URLSearchParams(params)
    const response = await apiHelpers.get(`/reports/export/${type}?${queryParams.toString()}`, {
      responseType: 'blob',
    })
    return response
  },

  // KPI metrics
  async getKpiMetrics() {
    return apiHelpers.get('/reports/kpi')
  },

  // System health
  async getSystemHealth() {
    return apiHelpers.get('/admin/system-health')
  },

  // API logs
  async getApiLogs(params = {}) {
    const queryParams = new URLSearchParams(params)
    return apiHelpers.get(`/admin/logs?${queryParams.toString()}`)
  },

  // DB metrics
  async getDbMetrics() {
    return apiHelpers.get('/admin/db-metrics')
  },
}
