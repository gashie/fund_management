import { apiHelpers } from './api'

export const transactionService = {
  // Get transactions list with filters
  async getTransactions(params = {}) {
    const queryParams = new URLSearchParams()
    if (params.status) queryParams.append('status', params.status)
    if (params.type) queryParams.append('type', params.type)
    if (params.fromDate) queryParams.append('fromDate', params.fromDate)
    if (params.toDate) queryParams.append('toDate', params.toDate)
    if (params.referenceNumber) queryParams.append('referenceNumber', params.referenceNumber)
    if (params.page) queryParams.append('page', params.page)
    if (params.limit) queryParams.append('limit', params.limit)

    return apiHelpers.get(`/transactions?${queryParams.toString()}`)
  },

  // Get single transaction
  async getTransaction(id) {
    return apiHelpers.get(`/transactions/${id}`)
  },

  // Get transaction by reference
  async getTransactionByReference(reference) {
    return apiHelpers.get(`/transactions/${reference}/status`)
  },

  // Get transaction statistics
  async getStats() {
    return apiHelpers.get('/transactions/stats')
  },

  // Get transactions needing TSQ
  async getTsqPending() {
    return apiHelpers.get('/transactions/tsq/pending')
  },

  // Trigger manual TSQ
  async triggerTsq(transactionId) {
    return apiHelpers.post(`/transactions/${transactionId}/tsq`)
  },

  // Get reversals pending
  async getReversalsPending() {
    return apiHelpers.get('/transactions/reversals/pending')
  },

  // Trigger manual reversal
  async triggerReversal(transactionId) {
    return apiHelpers.post(`/transactions/${transactionId}/reversal`)
  },

  // Get callbacks pending
  async getCallbacksPending() {
    return apiHelpers.get('/callbacks/pending')
  },

  // Retry callback
  async retryCallback(callbackId) {
    return apiHelpers.post(`/callbacks/${callbackId}/retry`)
  },
}
