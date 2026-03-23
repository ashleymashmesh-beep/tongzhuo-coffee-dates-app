// Cloudflare Workers API 基础地址
const API_BASE = import.meta.env.VITE_WORKER_API || 'https://tongzhuo-sms.ashleymashmesh.workers.dev'

// 通用请求函数
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  }

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  }

  const response = await fetch(url, mergedOptions)
  const data = await response.json()

  if (!response.ok || !data.success) {
    throw new Error(data.message || '请求失败')
  }

  return data
}

// ==================== 验证码 API ====================
export const smsApi = {
  // 发送验证码
  send: (email) => apiRequest('/api/sms/send', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),

  // 验证验证码
  verify: (email, code) => apiRequest('/api/sms/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  }),
}

// ==================== 用户 API ====================
export const usersApi = {
  // 获取用户信息
  get: (id) => apiRequest(`/api/users/${id}`),

  // 更新用户信息
  update: (id, data) => apiRequest(`/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
}

// ==================== 活动 API ====================
export const eventsApi = {
  // 获取活动列表
  list: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return apiRequest(`/api/events${queryString ? `?${queryString}` : ''}`)
  },

  // 获取活动详情
  get: (id) => apiRequest(`/api/events/${id}`),

  // 创建活动
  create: (data) => apiRequest('/api/events', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 更新活动状态
  updateStatus: (id, status) => apiRequest(`/api/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  }),

  // 获取活动报名列表
  getSignups: (id) => apiRequest(`/api/events/${id}/signups`),
}

// ==================== 报名 API ====================
export const signupsApi = {
  // 报名参加活动
  create: (eventId, userId) => apiRequest('/api/signups', {
    method: 'POST',
    body: JSON.stringify({ event_id: eventId, user_id: userId }),
  }),

  // 取消报名
  delete: (id) => apiRequest(`/api/signups/${id}`, {
    method: 'DELETE',
  }),
}

// ==================== 打卡 API ====================
export const checkinsApi = {
  // 获取打卡列表
  list: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return apiRequest(`/api/checkins${queryString ? `?${queryString}` : ''}`)
  },

  // 获取打卡详情
  get: (id) => apiRequest(`/api/checkins/${id}`),

  // 创建打卡
  create: (data) => apiRequest('/api/checkins', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 删除打卡
  delete: (id) => apiRequest(`/api/checkins/${id}`, {
    method: 'DELETE',
  }),
}

// ==================== 相遇记录 API ====================
export const encountersApi = {
  // 查询相遇记录
  list: (userId1, userId2) => {
    const ids = [userId1, userId2].sort()
    return apiRequest(`/api/encounters?user_id_1=${ids[0]}&user_id_2=${ids[1]}`)
  },

  // 创建相遇记录
  create: (data) => apiRequest('/api/encounters', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
}

// ==================== 评价 API ====================
export const reviewsApi = {
  // 获取评价列表
  list: (toUserId) => apiRequest(`/api/reviews?to_user_id=${toUserId}`),

  // 创建评价
  create: (data) => apiRequest('/api/reviews', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
}
