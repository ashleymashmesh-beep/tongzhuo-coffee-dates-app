import { encountersApi, usersApi } from './api'

/**
 * 当约咖活动结束时，为参与的用户两两创建相遇记录
 * @param {string} eventId - 约咖活动ID
 * @param {Array} userIds - 参与用户ID数组
 * @param {string} date - 活动日期 YYYY-MM-DD
 */
export async function createEncounters(eventId, userIds, date) {
  if (!userIds || userIds.length < 2) return

  // 为每对用户创建相遇记录
  for (let i = 0; i < userIds.length; i++) {
    for (let j = i + 1; j < userIds.length; j++) {
      const user1Id = userIds[i]
      const user2Id = userIds[j]

      try {
        await encountersApi.create({
          user_id_1: user1Id,
          user_id_2: user2Id,
          event_id: eventId,
          date: date
        })
      } catch (err) {
        // 可能已存在，忽略错误
        console.error('创建相遇记录失败:', err)
      }
    }
  }
}

/**
 * 查询两个用户之间的相遇次数
 * @param {string} user1Id - 用户1的ID
 * @param {string} user2Id - 用户2的ID
 * @returns {Promise<number>} 相遇次数
 */
export async function getEncounterCount(user1Id, user2Id) {
  try {
    const result = await encountersApi.list(user1Id, user2Id)
    return result.data?.length || 0
  } catch (err) {
    console.error('获取相遇次数失败:', err)
    return 0
  }
}

/**
 * 获取两个用户之间的相遇记录
 * @param {string} user1Id - 用户1的ID
 * @param {string} user2Id - 用户2的ID
 * @returns {Promise<Array>} 相遇记录数组
 */
export async function getEncounters(user1Id, user2Id) {
  try {
    const result = await encountersApi.list(user1Id, user2Id)
    return result.data || []
  } catch (err) {
    console.error('获取相遇记录失败:', err)
    return []
  }
}

/**
 * 检查并处理相遇通知
 * 当两个用户相遇达到3次时，返回需要显示的通知
 * @param {string} userId - 当前用户ID
 * @returns {Promise<Array>} 需要显示的通知列表
 */
export async function checkEncounterNotifications(userId) {
  // 获取该用户参与的所有活动
  // 这里简化处理，实际可能需要从活动列表中筛选
  // 由于API限制，这里返回空数组，通知逻辑由后端处理
  return []
}

/**
 * 获取用户的所有同桌记录（相遇次数统计）
 * @param {string} userId - 用户ID
 * @returns {Promise<Array>} 同桌列表
 */
export async function getUserEncounters(userId) {
  // 由于API限制，需要分别查询每个可能的配对
  // 这里简化处理，返回从后端获取的统计数据
  // 实际实现可能需要后端提供专门的用户相遇统计接口

  try {
    // 调用后端API获取用户相遇统计（需要后端添加对应接口）
    // 临时方案：返回空数组
    return []
  } catch (err) {
    console.error('获取同桌记录失败:', err)
    return []
  }
}
