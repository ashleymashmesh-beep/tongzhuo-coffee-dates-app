import { collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore'
import { db } from './firebase'

/**
 * 创建待评价任务
 * 当活动完成后，为每个参与者创建对其他参与者的评价任务
 * @param {string} meetupId - 约咖活动ID
 * @param {Array} attendeeIds - 参与者ID数组
 */
export async function createReviewTasks(meetupId, attendeeIds) {
  if (!attendeeIds || attendeeIds.length < 2) return

  const createdTasks = []

  // 每个参与者对其他每个参与者创建评价任务
  for (const reviewerId of attendeeIds) {
    for (const revieweeId of attendeeIds) {
      // 不评价自己
      if (reviewerId === revieweeId) continue

      // 检查是否已经创建过评价任务
      const existingQuery = query(
        collection(db, 'reviews'),
        where('meetupId', '==', meetupId),
        where('reviewerId', '==', reviewerId),
        where('revieweeId', '==', revieweeId)
      )
      const existingSnapshot = await getDocs(existingQuery)

      if (existingSnapshot.empty) {
        await addDoc(collection(db, 'reviews'), {
          meetupId,
          reviewerId,
          revieweeId,
          onTime: null, // null 表示未评价
          createdAt: serverTimestamp()
        })
        createdTasks.push({ reviewerId, revieweeId })
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
  const q = query(
    collection(db, 'reviews'),
    where('reviewerId', '==', userId),
    where('onTime', '==', null)
  )

  const snapshot = await getDocs(q)
  const reviews = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))

  // 按 meetupId 分组，避免同一活动显示多次
  const meetupMap = new Map()
  for (const review of reviews) {
    if (!meetupMap.has(review.meetupId)) {
      meetupMap.set(review.meetupId, [review])
    } else {
      meetupMap.get(review.meetupId).push(review)
    }
  }

  // 检查是否在24小时内
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const validMeetups = []

  for (const [meetupId, meetupReviews] of meetupMap) {
    // 检查创建时间
    const firstReview = meetupReviews[0]
    if (firstReview.createdAt && firstReview.createdAt.toDate() > twentyFourHoursAgo) {
      // 获取活动信息
      const meetupDoc = await getDoc(doc(db, 'meetups', meetupId))
      if (meetupDoc.exists() && meetupDoc.data().status === 'done') {
        validMeetups.push({
          meetupId,
          ...meetupDoc.data(),
          reviews: meetupReviews
        })
      }
    }
  }

  return validMeetups
}

/**
 * 提交评价
 * @param {string} reviewId - 评价记录ID
 * @param {boolean} onTime - 是否准时
 */
export async function submitReview(reviewId, onTime) {
  const reviewRef = doc(db, 'reviews', reviewId)

  await updateDoc(reviewRef, {
    onTime,
    reviewedAt: serverTimestamp()
  })
}

/**
 * 获取用户的守时率统计
 * @param {string} userId - 用户ID
 * @returns {Promise<Object>} { onTimeCount, totalCount, rate, hasEnoughData }
 */
export async function getPunctualityRate(userId) {
  // 获取最近10次被评价的记录
  const q = query(
    collection(db, 'reviews'),
    where('revieweeId', '==', userId),
    where('onTime', '!=', null)
  )

  const snapshot = await getDocs(q)
  const reviews = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis())
    .slice(0, 10)

  if (reviews.length < 3) {
    return { onTimeCount: 0, totalCount: 0, rate: null, hasEnoughData: false }
  }

  const onTimeCount = reviews.filter(r => r.onTime === true).length
  const totalCount = reviews.length

  return {
    onTimeCount,
    totalCount,
    rate: Math.round((onTimeCount / totalCount) * 100),
    hasEnoughData: true
  }
}
