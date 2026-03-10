import { collection, query, where, getDocs, getDoc, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

/**
 * 当约咖活动结束时，为参与的用户两两创建相遇记录
 * @param {string} meetupId - 约咖活动ID
 * @param {Array} userIds - 参与用户ID数组
 * @param {string} date - 活动日期 YYYY-MM-DD
 */
export async function createEncounters(meetupId, userIds, date) {
  if (!userIds || userIds.length < 2) return

  // 为每对用户创建相遇记录
  for (let i = 0; i < userIds.length; i++) {
    for (let j = i + 1; j < userIds.length; j++) {
      const user1Id = userIds[i]
      const user2Id = userIds[j]

      // 将两个用户ID排序，确保存入的顺序一致（方便查询）
      const sortedUserIds = [user1Id, user2Id].sort()

      await addDoc(collection(db, 'encounters'), {
        userIds: sortedUserIds,
        meetupId,
        date,
        notified: false,
        createdAt: serverTimestamp()
      })
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
  const sortedUserIds = [user1Id, user2Id].sort()

  const q = query(
    collection(db, 'encounters'),
    where('userIds', '==', sortedUserIds)
  )

  const snapshot = await getDocs(q)
  return snapshot.size
}

/**
 * 获取两个用户之间的相遇记录（包括未通知的）
 * @param {string} user1Id - 用户1的ID
 * @param {string} user2Id - 用户2的ID
 * @returns {Promise<Array>} 相遇记录数组
 */
export async function getEncounters(user1Id, user2Id) {
  const sortedUserIds = [user1Id, user2Id].sort()

  const q = query(
    collection(db, 'encounters'),
    where('userIds', '==', sortedUserIds)
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

/**
 * 检查并处理相遇通知
 * 当两个用户相遇达到3次时，发送通知并标记为已通知
 * @param {string} userId - 当前用户ID
 * @returns {Promise<Array>} 需要显示的通知列表
 */
export async function checkEncounterNotifications(userId) {
  // 获取与该用户相关的所有相遇记录
  const q1 = query(
    collection(db, 'encounters'),
    where('userIds', 'array-contains', userId)
  )

  const snapshot = await getDocs(q1)
  const encounters = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))

  // 按另一个用户分组
  const encountersByUser = {}

  for (const encounter of encounters) {
    const otherUserId = encounter.userIds.find(id => id !== userId)
    if (!otherUserId) continue

    if (!encountersByUser[otherUserId]) {
      encountersByUser[otherUserId] = []
    }
    encountersByUser[otherUserId].push(encounter)
  }

  // 检查哪些用户达到3次且未通知
  const notifications = []

  for (const [otherUserId, userEncounters] of Object.entries(encountersByUser)) {
    if (userEncounters.length >= 3) {
      // 检查是否已通知过
      const hasNotified = userEncounters.every(e => e.notified)

      if (!hasNotified) {
        // 获取另一个用户的信息
        const otherUserDoc = await getDoc(doc(db, 'users', otherUserId))

        notifications.push({
          otherUserId,
          otherUserName: otherUserDoc.exists() ? otherUserDoc.data().nickname || '同桌' : '同桌',
          count: userEncounters.length
        })

        // 标记所有相关记录为已通知
        for (const encounter of userEncounters) {
          if (!encounter.notified) {
            await updateDoc(doc(db, 'encounters', encounter.id), {
              notified: true
            })
          }
        }
      }
    }
  }

  return notifications
}

/**
 * 获取用户的所有同桌记录（相遇次数统计）
 * @param {string} userId - 用户ID
 * @returns {Promise<Array>} 同桌列表
 */
export async function getUserEncounters(userId) {
  // 获取与该用户相关的所有相遇记录
  const q = query(
    collection(db, 'encounters'),
    where('userIds', 'array-contains', userId)
  )

  const snapshot = await getDocs(q)
  const encounters = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))

  // 按另一个用户分组统计
  const encountersByUser = {}

  for (const encounter of encounters) {
    const otherUserId = encounter.userIds.find(id => id !== userId)
    if (!otherUserId) continue

    if (!encountersByUser[otherUserId]) {
      encountersByUser[otherUserId] = {
        userId: otherUserId,
        count: 0,
        lastDate: encounter.date
      }
    }
    encountersByUser[otherUserId].count++
    if (encounter.date > encountersByUser[otherUserId].lastDate) {
      encountersByUser[otherUserId].lastDate = encounter.date
    }
  }

  // 转换为数组并获取用户信息
  const result = []

  for (const [otherUserId, data] of Object.entries(encountersByUser)) {
    const userDoc = await getDoc(doc(db, 'users', otherUserId))
    result.push({
      ...data,
      nickname: userDoc.exists() ? userDoc.data().nickname || null : null,
      bio: userDoc.exists() ? userDoc.data().bio || null : null
    })
  }

  // 按相遇次数降序排序
  result.sort((a, b) => b.count - a.count)

  return result
}
