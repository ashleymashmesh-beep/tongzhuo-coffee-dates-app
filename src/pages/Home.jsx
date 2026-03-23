import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { createEncounters, checkEncounterNotifications } from '../lib/encounters'
import { createReviewTasks } from '../lib/reviews'
import { eventsApi, signupsApi } from '../lib/api'

// 时段配置
const TIME_SLOT_CONFIG = {
  morning: { label: '上午', emoji: '☀️' },
  afternoon: { label: '下午', emoji: '🌤' },
  evening: { label: '傍晚', emoji: '🌆' }
}

// 活动类型配置
const ACTIVITY_CONFIG = {
  quiet: { label: '安静打工', desc: '各做各的，并排坐', emoji: '🎧' },
  chat: { label: '边聊边工作', desc: '可以聊聊各自的事', emoji: '🤝' },
  craft: { label: '手工活动', desc: '钩针、拼豆等', emoji: '🧶' },
  other: { label: '其他', desc: '自己说', emoji: '✨' }
}

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [meetups, setMeetups] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [joiningId, setJoiningId] = useState(null)
  const [completingId, setCompletingId] = useState(null)
  const [selectedMeetup, setSelectedMeetup] = useState(null)
  const [notifications, setNotifications] = useState([])

  // 生成日期筛选选项
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() + i)
    return {
      value: date.toISOString().split('T')[0],
      label: i === 0 ? '今天' : i === 1 ? '明天' : date.toLocaleDateString('zh-CN', { weekday: 'short' }).replace('星期', '周')
    }
  })

  // 格式化日期时间显示
  const formatDateTimeLabel = (meetup) => {
    const date = new Date(meetup.date)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)

    let dateLabel = ''
    if (date.toDateString() === today.toDateString()) {
      dateLabel = '今天'
    } else if (date.toDateString() === tomorrow.toDateString()) {
      dateLabel = '明天'
    } else {
      dateLabel = date.toLocaleDateString('zh-CN', { weekday: 'short', month: 'short', day: 'numeric' })
    }

    const slot = TIME_SLOT_CONFIG[meetup.time_slot]
    const specificTime = meetup.specific_time || ''

    return specificTime
      ? `${dateLabel} ${specificTime}`
      : `${dateLabel}${slot?.label || ''}`
  }

  // 获取约咖列表
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true)
      try {
        // 计算日期范围（未来 7 天）
        const today = new Date()
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + 7)

        const result = await eventsApi.list({
          status: 'open',
          date_from: today.toISOString().split('T')[0]
        })

        // 转换数据格式，匹配前端期望的字段名
        const events = (result.data || []).map(event => ({
          id: event.id,
          creatorId: event.creator_id,
          cafeName: event.cafe_name,
          cafeAddress: event.cafe_address,
          cafeId: event.cafe_id,
          date: event.date,
          timeSlot: event.time_slot,
          specificTime: event.specific_time,
          activityType: event.activity_type,
          intro: event.intro,
          maxPeople: event.max_people,
          status: event.status,
          createdAt: event.created_at,
          // 报名信息需要单独获取
          attendees: [],
          signupCount: event.signup_count || 0
        }))

        // 获取每个活动的报名列表
        for (const event of events) {
          try {
            const signupsResult = await eventsApi.getSignups(event.id)
            event.attendees = signupsResult.data?.map(s => s.user_id) || []
            event.signupCount = event.attendees.length
          } catch (err) {
            event.attendees = []
            event.signupCount = 0
          }
        }

        setMeetups(events)
      } catch (err) {
        console.error('获取约咖列表失败:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  // 检查相遇通知
  useEffect(() => {
    if (!user) return

    const checkNotifications = async () => {
      try {
        const notifs = await checkEncounterNotifications(user.id)
        if (notifs.length > 0) {
          setNotifications(notifs)
        }
      } catch (err) {
        console.error('检查相遇通知失败:', err)
      }
    }

    checkNotifications()
  }, [user])

  // 报名
  const handleJoin = async (meetup) => {
    if (!user) {
      navigate('/login')
      return
    }

    if (meetup.creatorId === user.id) {
      alert('不能报名自己发布的活动')
      return
    }

    if (meetup.attendees?.includes(user.id)) {
      alert('你已经报名了这个活动')
      return
    }

    if (meetup.attendees?.length >= meetup.maxPeople) {
      alert('活动已满员')
      return
    }

    setJoiningId(meetup.id)

    try {
      await signupsApi.create(meetup.id, user.id)

      // 更新本地状态
      setMeetups(prev => prev.map(m => {
        if (m.id === meetup.id) {
          const newAttendees = [...(m.attendees || []), user.id]
          const isFull = newAttendees.length >= m.maxPeople
          return {
            ...m,
            attendees: newAttendees,
            status: isFull ? 'full' : m.status
          }
        }
        return m
      }))
    } catch (err) {
      console.error('报名失败:', err)
      alert(err.message || '报名失败，请重试')
    } finally {
      setJoiningId(null)
    }
  }

  // 完成活动
  const handleCompleteMeetup = async (meetup) => {
    if (!confirm('确认完成此次活动？完成后将为参与的用户记录相遇次数。')) {
      return
    }

    setCompletingId(meetup.id)

    try {
      // 更新活动状态为 done
      await eventsApi.updateStatus(meetup.id, 'done')

      // 创建相遇记录和评价任务
      if (meetup.attendees && meetup.attendees.length >= 2) {
        await createEncounters(meetup.id, meetup.attendees, meetup.date)
        await createReviewTasks(meetup.id, meetup.attendees)

        // 提示创建者
        alert('活动已完成！已为参与者记录相遇次数，并发送评价邀请。')
      }

      // 更新本地状态
      setMeetups(prev => prev.map(m => {
        if (m.id === meetup.id) {
          return { ...m, status: 'done' }
        }
        return m
      }))

      setSelectedMeetup(null)
    } catch (err) {
      console.error('完成活动失败:', err)
      alert('操作失败，请重试')
    } finally {
      setCompletingId(null)
    }
  }

  // 筛选当前选中日期的活动
  const filteredMeetups = meetups.filter(m => m.date === selectedDate)

  return (
    <div className="min-h-screen bg-[#F7F2EB]">
      {/* 页面头部 */}
      <div className="bg-[#F7F2EB] px-4 py-3 border-b border-[#E8D5BC]">
        <h1 className="font-serif text-[#2C1A0E] text-xl tracking-widest text-center">同桌</h1>
        <p className="text-xs text-[#A0714F] text-center mt-1">找到今天一起工作的人</p>
      </div>

      {/* 相遇通知 */}
      {notifications.length > 0 && (
        <div className="mx-4 mt-3">
          {notifications.map((notif, index) => (
            <div
              key={index}
              className="bg-gradient-to-r from-[#FFF8F0] to-[#FFF3E0] border-2 border-[#F0C080] rounded-xl p-4 mb-2"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0 mt-0.5">☕</span>
                <div>
                  <p className="text-sm text-[#5C3D1E] leading-relaxed">
                    你和 <strong>{notif.otherUserName}</strong> 已经见面 <strong>{notif.count}</strong> 次了
                  </p>
                  <p className="text-xs text-[#A0714F] mt-1">你们是彼此的常驻同桌了</p>
                </div>
                <button
                  onClick={() => setNotifications(notifications.filter((_, i) => i !== index))}
                  className="text-[#A0714F] text-lg flex-shrink-0"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 日期筛选 */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto">
        {dateOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setSelectedDate(opt.value)}
            className={`px-4 py-2 rounded-full text-xs whitespace-nowrap transition-colors ${
              selectedDate === opt.value
                ? 'bg-[#2C1A0E] text-white'
                : 'bg-white border border-[#E8D5BC] text-[#9A7A5C]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 约咖列表 */}
      <div className="px-4 py-2 pb-24 flex flex-col gap-3">
        {loading ? (
          <div className="text-center text-[#9A7A5C] py-8">加载中…</div>
        ) : filteredMeetups.length === 0 ? (
          <div className="text-center text-[#9A7A5C] py-12">
            <p className="text-sm">今天还没有约咖活动</p>
            <p className="text-xs mt-2">点击右下角 + 发布一个吧</p>
          </div>
        ) : (
          filteredMeetups.map(meetup => {
            const slot = TIME_SLOT_CONFIG[meetup.timeSlot]
            const activity = ACTIVITY_CONFIG[meetup.activityType]
            const isJoined = meetup.attendees?.includes(user?.id)
            const isFull = meetup.attendees?.length >= meetup.maxPeople
            const spotsLeft = meetup.maxPeople - (meetup.attendees?.length || 0)

            return (
              <div
                key={meetup.id}
                onClick={() => setSelectedMeetup(meetup)}
                className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8D5BC] active:scale-[0.98] transition-transform cursor-pointer"
              >
                {/* 卡片顶部 */}
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-xs text-[#9A7A5C] mb-1">
                      {formatDateTimeLabel(meetup)} · {meetup.cafeAddress?.substring(0, 10) || '附近'}
                    </div>
                    <div className="text-base font-semibold text-[#2C1A0E] font-serif">
                      {meetup.cafeName}
                    </div>
                  </div>
                  <div className={`text-xs px-3 py-1 rounded-full ${
                    meetup.status === 'done'
                      ? 'bg-[#E8E8E8] text-[#888888]'
                      : isFull
                        ? 'bg-[#F5E6E6] text-[#A05050]'
                        : 'bg-[#F0E6D6] text-[#5C3D1E]'
                  }`}>
                    {meetup.status === 'done'
                      ? '已结束'
                      : isFull
                        ? '已满员'
                        : `还差${spotsLeft}人`}
                  </div>
                </div>

                {/* 标签 */}
                <div className="flex gap-2 flex-wrap mb-2">
                  <span className="text-xs px-2 py-1 rounded-lg bg-[#F0E6D6] text-[#A0714F]">
                    {activity?.emoji} {activity?.label}
                  </span>
                  {meetup.specificTime && (
                    <span className="text-xs px-2 py-1 rounded-lg bg-[#F0E6D6] text-[#A0714F]">
                      ⏰ {meetup.specificTime}
                    </span>
                  )}
                </div>

                {/* 介绍 */}
                {meetup.intro && (
                  <div className="text-xs text-[#9A7A5C] mb-3 leading-relaxed line-clamp-2">
                    「{meetup.intro}」
                  </div>
                )}

                {/* 底部 */}
                <div className="flex justify-between items-center">
                  <div className="text-xs text-[#9A7A5C] flex items-center gap-1">
                    <span className="w-5 h-5 rounded-full bg-[#E8D5BC] flex items-center justify-center text-[9px]">
                      {meetup.creatorId === user?.id ? '我' : '👤'}
                    </span>
                    {meetup.creatorId === user?.id ? '我发布的' : '等你加入'}
                  </div>
                  <div className={`text-xs px-3 py-1 rounded-full ${
                    isJoined ? 'bg-[#F0E6D6] text-[#A0714F]' : 'bg-[#2C1A0E] text-white'
                  }`}>
                    {isJoined ? '已报名' : '查看详情'}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 浮动发布按钮 */}
      <button
        onClick={() => navigate('/publish')}
        className="fixed bottom-24 right-4 w-12 h-12 rounded-full bg-[#2C1A0E] text-white text-2xl shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      >
        +
      </button>

      {/* 详情弹窗 */}
      {selectedMeetup && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
          onClick={() => setSelectedMeetup(null)}
        >
          <div
            className="bg-[#FDFAF6] w-full max-w-lg rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 关闭按钮 */}
            <button
              onClick={() => setSelectedMeetup(null)}
              className="absolute top-4 right-4 text-[#9A7A5C] text-xl"
            >
              ×
            </button>

            {/* 标题 */}
            <h2 className="font-serif text-[#2C1A0E] text-xl mb-4 pr-8">{selectedMeetup.cafeName}</h2>

            {/* 时间和地址 */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-[#9A7A5C]">
                <span>📅</span>
                <span>{formatDateTimeLabel(selectedMeetup)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#9A7A5C]">
                <span>📍</span>
                <span>{selectedMeetup.cafeAddress}</span>
              </div>
            </div>

            {/* 活动类型 */}
            <div className="mb-4">
              <div className="text-xs text-[#9A7A5C] mb-2">活动类型</div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F0E6D6]">
                <span>{ACTIVITY_CONFIG[selectedMeetup.activityType]?.emoji}</span>
                <span className="text-sm text-[#2C1A0E]">{ACTIVITY_CONFIG[selectedMeetup.activityType]?.label}</span>
              </div>
            </div>

            {/* 人数限制 */}
            <div className="mb-4">
              <div className="text-xs text-[#9A7A5C] mb-2">
                人数上限 · {selectedMeetup.attendees?.length || 0}/{selectedMeetup.maxPeople}人
              </div>
              <div className="flex gap-2">
                {Array.from({ length: selectedMeetup.maxPeople }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                      i < (selectedMeetup.attendees?.length || 0)
                        ? 'bg-[#2C1A0E] text-white'
                        : 'bg-[#E8D5BC] text-[#9A7A5C]'
                    }`}
                  >
                    {i < (selectedMeetup.attendees?.length || 0) ? '☕' : i + 1}
                  </div>
                ))}
              </div>
            </div>

            {/* 介绍 */}
            {selectedMeetup.intro && (
              <div className="mb-4">
                <div className="text-xs text-[#9A7A5C] mb-2">介绍</div>
                <div className="bg-white rounded-xl p-4 text-sm text-[#2C1A0E] leading-relaxed border border-[#E8D5BC]">
                  「{selectedMeetup.intro}」
                </div>
              </div>
            )}

            {/* 发起人信息 */}
            <div className="mb-6">
              <div className="text-xs text-[#9A7A5C] mb-2">发起人</div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#E8D5BC] flex items-center justify-center">
                  {selectedMeetup.creatorId === user?.id ? '我' : '👤'}
                </div>
                <div className="text-sm text-[#2C1A0E]">
                  {selectedMeetup.creatorId === user?.id ? '我发起的' : '等你加入'}
                </div>
              </div>
            </div>

            {/* 已结束状态 */}
            {selectedMeetup.status === 'done' && (
              <div className="mb-4 p-4 bg-[#F0F0F0] rounded-xl text-center">
                <p className="text-sm text-[#888888]">此活动已结束</p>
              </div>
            )}

            {/* 创建者操作按钮 */}
            {selectedMeetup.creatorId === user?.id && selectedMeetup.status !== 'done' && (
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => handleCompleteMeetup(selectedMeetup)}
                  disabled={completingId === selectedMeetup.id}
                  className="flex-1 py-3 rounded-xl bg-[#5C3D1E] text-white text-sm font-medium disabled:opacity-50"
                >
                  {completingId === selectedMeetup.id ? '处理中…' : '✓ 完成活动'}
                </button>
              </div>
            )}

            {/* 报名按钮 */}
            <button
              onClick={() => handleJoin(selectedMeetup)}
              disabled={
                completingId === selectedMeetup.id ||
                joiningId === selectedMeetup.id ||
                selectedMeetup.status === 'done' ||
                selectedMeetup.attendees?.length >= selectedMeetup.maxPeople ||
                selectedMeetup.attendees?.includes(user?.id) ||
                selectedMeetup.creatorId === user?.id
              }
              className={`w-full py-4 rounded-xl text-sm font-medium transition-colors ${
                selectedMeetup.status === 'done'
                  ? 'bg-[#F0F0F0] text-[#888888] cursor-default'
                  : selectedMeetup.attendees?.includes(user?.id)
                    ? 'bg-[#F0E6D6] text-[#A0714F]'
                    : selectedMeetup.creatorId === user?.id
                      ? 'bg-[#F0E6D6] text-[#A0714F] cursor-default'
                      : selectedMeetup.attendees?.length >= selectedMeetup.maxPeople
                        ? 'bg-[#F5E6E6] text-[#A05050] cursor-default'
                        : 'bg-[#2C1A0E] text-white active:bg-[#3C2A1E]'
              }`}
            >
              {selectedMeetup.status === 'done'
                ? '活动已结束'
                : completingId === selectedMeetup.id
                  ? '处理中…'
                  : joiningId === selectedMeetup.id
                    ? '报名中…'
                    : selectedMeetup.attendees?.includes(user?.id)
                      ? '已报名 ✓'
                      : selectedMeetup.creatorId === user?.id
                        ? '我发起的活动'
                        : selectedMeetup.attendees?.length >= selectedMeetup.maxPeople
                          ? '已满员'
                          : '我也要去'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
