import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getUserEncounters } from '../lib/encounters'
import { getPendingReviews, submitReview, getPunctualityRate } from '../lib/reviews'
import { checkinsApi, eventsApi } from '../lib/api'

export default function Profile() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [stats, setStats] = useState({
    checkinCount: 0,
    meetupCount: 0
  })
  const [encounters, setEncounters] = useState([])
  const [punctuality, setPunctuality] = useState(null)
  const [pendingReviews, setPendingReviews] = useState([])
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [currentReviewMeetup, setCurrentReviewMeetup] = useState(null)
  const [reviewingState, setReviewingState] = useState({})
  const [loading, setLoading] = useState(true)

  // 获取用户统计数据
  useEffect(() => {
    if (!user) return

    const fetchStats = async () => {
      try {
        // 获取打卡次数
        const checkinsResult = await checkinsApi.list({ user_id: user.id })
        const checkinCount = checkinsResult.data?.length || 0

        // 获取约咖次数（作为创建者）
        const eventsResult = await eventsApi.list({ status: 'done' })
        const meetupCount = (eventsResult.data || []).filter(e => e.creator_id === user.id).length

        setStats({ checkinCount, meetupCount })
      } catch (err) {
        console.error('获取统计数据失败:', err)
      }
    }

    fetchStats()
  }, [user])

  // 获取守时率
  useEffect(() => {
    if (!user) return

    const fetchPunctuality = async () => {
      try {
        const rate = await getPunctualityRate(user.id)
        setPunctuality(rate)
      } catch (err) {
        console.error('获取守时率失败:', err)
      }
    }

    fetchPunctuality()
  }, [user])

  // 获取同桌记录
  useEffect(() => {
    if (!user) return

    const fetchEncounters = async () => {
      try {
        const encountersData = await getUserEncounters(user.id)
        setEncounters(encountersData)
      } catch (err) {
        console.error('获取同桌记录失败:', err)
      }
    }

    fetchEncounters()
  }, [user])

  // 获取待评价任务
  useEffect(() => {
    if (!user) return

    const fetchPendingReviews = async () => {
      try {
        const reviews = await getPendingReviews(user.id)
        setPendingReviews(reviews)
      } catch (err) {
        console.error('获取待评价失败:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchPendingReviews()
  }, [user])

  // 退出登录
  const handleLogout = async () => {
    if (confirm('确认退出登录？')) {
      logout()
      navigate('/login')
    }
  }

  // 打开评价弹窗
  const openReviewModal = (meetup) => {
    setCurrentReviewMeetup(meetup)
    // 初始化评价状态
    const initialState = {}
    meetup.reviews.forEach(review => {
      initialState[review.id] = null
    })
    setReviewingState(initialState)
    setShowReviewModal(true)
  }

  // 提交单个评价
  const handleSubmitReview = async (reviewId, onTime) => {
    try {
      await submitReview(reviewId, onTime)
      setReviewingState(prev => ({ ...prev, [reviewId]: onTime }))
    } catch (err) {
      console.error('提交评价失败:', err)
      alert('提交失败，请重试')
    }
  }

  // 提交所有评价并关闭弹窗
  const handleFinishReview = async () => {
    // 检查是否所有评价都已提交
    const allReviewed = currentReviewMeetup.reviews.every(
      review => reviewingState[review.id] !== null
    )

    if (!allReviewed) {
      alert('请完成所有评价后再关闭')
      return
    }

    setShowReviewModal(false)
    setCurrentReviewMeetup(null)
    setReviewingState({})

    // 刷新待评价列表
    const reviews = await getPendingReviews(user.id)
    setPendingReviews(reviews)
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F7F2EB] flex items-center justify-center">
        <div className="text-center text-[#9A7A5C]">
          <p>请先登录</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 px-6 py-2 rounded-xl bg-[#2C1A0E] text-white text-sm"
          >
            去登录
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F2EB]">
      {/* 页面头部 */}
      <div className="bg-[#2C1A0E] px-4 py-6 text-center">
        {/* 头像 */}
        <div className="w-16 h-16 rounded-full bg-[#E8D5BC] mx-auto mb-3 flex items-center justify-center text-3xl">
          {user.nickname?.[0] || '👤'}
        </div>
        {/* 昵称 */}
        <h1 className="font-serif text-white text-xl mb-1">
          {user.nickname || '同桌'}
        </h1>
        {/* 简介 */}
        {user.bio && (
          <p className="text-xs text-white/70">{user.bio}</p>
        )}
      </div>

      {/* 统计数据 */}
      <div className="flex bg-white border-b border-[#E8D5BC]">
        <div className="flex-1 text-center py-4 border-r border-[#E8D5BC]">
          <div className="font-serif text-2xl font-bold text-[#2C1A0E]">{stats.checkinCount}</div>
          <div className="text-xs text-[#9A7A5C] mt-1">次打卡</div>
        </div>
        <div className="flex-1 text-center py-4">
          <div className="font-serif text-2xl font-bold text-[#2C1A0E]">{stats.meetupCount}</div>
          <div className="text-xs text-[#9A7A5C] mt-1">次约咖</div>
        </div>
        <div className="flex-1 text-center py-4 border-l border-[#E8D5BC]">
          <div className="font-serif text-2xl font-bold text-[#2C1A0E]">{encounters.length}</div>
          <div className="text-xs text-[#9A7A5C] mt-1">位同桌</div>
        </div>
      </div>

      {/* 守时率 */}
      {punctuality && punctuality.hasEnoughData && (
        <div className="mx-4 mt-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8D5BC]">
            <div className="text-xs text-[#9A7A5C] mb-2">最近10次约咖</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-[#E8D5BC] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#2C1A0E] rounded-full transition-all"
                  style={{ width: `${punctuality.rate}%` }}
                />
              </div>
              <span className="text-sm font-medium text-[#2C1A0E]">
                准时 {punctuality.onTimeCount}/{punctuality.totalCount} 次
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 待评价提示 */}
      {pendingReviews.length > 0 && (
        <div className="mx-4 mt-4">
          <div className="bg-gradient-to-r from-[#FFF8F0] to-[#FFF3E0] border-2 border-[#F0C080] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📝</span>
                <div>
                  <p className="text-sm font-medium text-[#5C3D1E]">
                    有 {pendingReviews.length} 个约咖需要评价
                  </p>
                  <p className="text-xs text-[#A0714F] mt-0.5">评价24小时内有效</p>
                </div>
              </div>
              <button
                onClick={() => openReviewModal(pendingReviews[0])}
                className="px-4 py-2 rounded-xl bg-[#2C1A0E] text-white text-sm font-medium"
              >
                去评价
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 相遇通知 */}
      {encounters.filter(e => e.count >= 3).length > 0 && (
        <div className="mx-4 mt-4">
          <div className="bg-gradient-to-r from-[#FFF8F0] to-[#FFF3E0] border-2 border-[#F0C080] rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">☕</span>
              <div className="text-sm text-[#5C3D1E] leading-relaxed">
                你已经有 {encounters.filter(e => e.count >= 3).length} 位常驻同桌了
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 同桌记录列表 */}
      <div className="px-4 py-4 pb-32">
        {loading ? (
          <div className="text-center text-[#9A7A5C] py-8">加载中…</div>
        ) : encounters.length === 0 ? (
          <div className="text-center text-[#9A7A5C] py-12">
            <p className="text-sm">还没有同桌记录</p>
            <p className="text-xs mt-2">多参加约咖活动，认识新朋友吧</p>
          </div>
        ) : (
          <>
            <div className="text-xs text-[#9A7A5C] mb-3 tracking-wide">同桌记录</div>
            <div className="flex flex-col gap-3">
              {encounters.map((encounter, index) => {
                const isHighlight = encounter.count >= 3
                return (
                  <div
                    key={index}
                    className={`bg-white rounded-2xl p-4 shadow-sm border ${
                      isHighlight ? 'border-[#F0C080]' : 'border-[#E8D5BC]'
                    } flex items-center gap-3`}
                  >
                    {/* 头像 */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
                      isHighlight ? 'bg-[#FFF3E0]' : 'bg-[#E8D5BC]'
                    }`}>
                      {encounter.nickname?.[0] || '👤'}
                    </div>

                    {/* 信息 */}
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#2C1A0E]">
                        {encounter.nickname || '同桌'}
                      </div>
                      {encounter.bio && (
                        <div className="text-xs text-[#9A7A5C] mt-0.5 line-clamp-1">
                          {encounter.bio}
                        </div>
                      )}
                      <div className="text-xs text-[#9A7A5C] mt-1">
                        {encounter.lastDate} 最后见面
                      </div>
                    </div>

                    {/* 相遇次数 */}
                    <div className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                      isHighlight
                        ? 'bg-[#FFF3E0] text-[#E67E22]'
                        : 'bg-[#F0E6D6] text-[#5C3D1E]'
                    }`}>
                      ☕×{encounter.count}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* 退出登录按钮 */}
      <div className="fixed bottom-16 left-0 right-0 px-4">
        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-xl bg-white border border-[#E8D5BC] text-sm text-[#9A7A5C] hover:bg-[#F7F2EB] transition-colors"
        >
          退出登录
        </button>
      </div>

      {/* 评价弹窗 */}
      {showReviewModal && currentReviewMeetup && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowReviewModal(false)}
        >
          <div
            className="bg-[#FDFAF6] w-full max-w-md rounded-3xl p-6 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题 */}
            <h2 className="font-serif text-[#2C1A0E] text-xl mb-2 text-center">约后评价</h2>
            <p className="text-xs text-[#9A7A5C] text-center mb-4">
              「{currentReviewMeetup.cafeName}」{currentReviewMeetup.specificTime ? ` ${currentReviewMeetup.specificTime}` : ''}
            </p>

            {/* 评价问题 */}
            <div className="mb-4 text-center">
              <p className="text-sm text-[#2C1A0E] mb-4">Ta 准时到了吗？</p>
            </div>

            {/* 评价列表 */}
            <div className="flex flex-col gap-3 mb-6">
              {currentReviewMeetup.reviews.map(review => {
                const hasReviewed = reviewingState[review.id] !== null
                const isOnTime = reviewingState[review.id]

                return (
                  <div
                    key={review.id}
                    className="bg-white rounded-xl p-4 border border-[#E8D5BC]"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-[#E8D5BC] flex items-center justify-center">
                        👤
                      </div>
                      <div className="text-sm text-[#2C1A0E]">
                        {review.reviewerId === user.id
                          ? '你自己'
                          : '其他参与者'}
                      </div>
                    </div>

                    {!hasReviewed ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSubmitReview(review.id, true)}
                          className="flex-1 py-3 rounded-xl border-2 border-[#E8D5BC] text-sm text-[#9A7A5C] hover:border-[#2C1A0E] hover:bg-[#F7F2EB] transition-colors"
                        >
                          ✓ 准时
                        </button>
                        <button
                          onClick={() => handleSubmitReview(review.id, false)}
                          className="flex-1 py-3 rounded-xl border-2 border-[#E8D5BC] text-sm text-[#9A7A5C] hover:border-[#A05050] hover:bg-[#F5E6E6] transition-colors"
                        >
                          迟到30分钟+
                        </button>
                      </div>
                    ) : (
                      <div className={`text-sm text-center py-2 rounded-lg ${
                        isOnTime ? 'bg-[#F0F9F0] text-[#2E7D32]' : 'bg-[#FFF3F0] text-[#C62828]'
                      }`}>
                        {isOnTime ? '✓ 已评价：准时' : '已评价：迟到'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 完成按钮 */}
            <button
              onClick={handleFinishReview}
              className="w-full py-4 rounded-xl bg-[#2C1A0E] text-white text-sm font-medium"
            >
              完成
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
