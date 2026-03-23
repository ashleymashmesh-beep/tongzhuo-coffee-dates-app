import { reviewsApi } from './api'

/**
 * 创建待评价任务
 * 当活动完成后，为每个参与者创建对其他参与者的评价任务
 * @param {string} eventId - 约咖活动ID
 * @param {Array} attendeeIds - 参与者ID数组
 */
export async function createReviewTasks(eventId, attendeeIds) {
  if (!attendeeIds || attendeeIds.length < 2) return

  const createdTasks = []

  // 每个参与者对其他每个参与者创建评价任务
  for (const reviewerId of attendeeIds) {
    for (const revieweeId of attendeeIds) {
      // 不评价自己
      if (reviewerId === revieweeId) continue

      try {
        await reviewsApi.create({
          from_user_id: reviewerId,
          to_user_id: revieweeId,
          event_id: eventId,
          rating: null, // null 表示未评价
        })
        createdTasks.push({ reviewerId, revieweeId })
      } catch (err) {
        // 可能已存在，忽略错误
        console.error('创建评价任务失败:', err)
      }
    }
  }

  return createdTasks
}

/**
 * 获取用户的待评价任务
 * @param {string} userId - 用户ID
 * @returns {Promise<Array>} 待评价列表
 */
export async function getPendingReviews(userId) {
  // 由于API限制，这里需要后端提供专门的待评价接口
  // 临时返回空数组
  return []
}

/**
 * 提交评价
 * @param {string} reviewId - 评价记录ID
 * @param {boolean} onTime - 是否准时
 */
export async function submitReview(reviewId, onTime) {
  // 需要后端提供更新评价的接口
  // 临时实现
  try {
    // 调用后端API更新评价
    await fetch(`${import.meta.env.VITE_WORKER_API}/api/reviews/${reviewId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: onTime ? 5 : 1, reviewed: true })
    })
  } catch (err) {
    console.error('提交评价失败:', err)
    throw err
  }
}

/**
 * 获取用户的守时率统计
 * @param {string} userId - 用户ID
 * @returns {Promise<Object>} { onTimeCount, totalCount, rate, hasEnoughData }
 */
export async function getPunctualityRate(userId) {
  try {
    const result = await reviewsApi.list(userId)
    const reviews = result.data || []

    if (reviews.length < 3) {
      return { onTimeCount: 0, totalCount: 0, rate: null, hasEnoughData: false }
    }

    const onTimeCount = reviews.filter(r => r.rating >= 4).length
    const totalCount = reviews.length

    return {
      onTimeCount,
      totalCount,
      rate: Math.round((onTimeCount / totalCount) * 100),
      hasEnoughData: true
    }
  } catch (err) {
    console.error('获取守时率失败:', err)
    return { onTimeCount: 0, totalCount: 0, rate: null, hasEnoughData: false }
  }
}
