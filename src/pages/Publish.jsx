import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { initAmap, getCurrentLocation, searchNearbyCafes, formatDistance } from '../lib/amap'

// 活动类型配置
const ACTIVITY_TYPES = [
  { id: 'quiet', label: '安静打工', desc: '各做各的，并排坐', emoji: '🎧' },
  { id: 'chat', label: '边聊边工作', desc: '可以聊聊各自的事', emoji: '💬' },
  { id: 'craft', label: '手工活动', desc: '钩针、拼豆等', emoji: '🧶' },
  { id: 'other', label: '其他', desc: '自己说', emoji: '✨' }
]

// 时段配置
const TIME_SLOTS = [
  { id: 'morning', label: '上午', emoji: '☀️', startHour: 8, endHour: 12 },
  { id: 'afternoon', label: '下午', emoji: '🌤', startHour: 12, endHour: 18 },
  { id: 'evening', label: '傍晚', emoji: '🌆', startHour: 18, endHour: 21 }
]

// 生成时间段选项（整点和半点）
const generateTimeOptions = (startHour, endHour) => {
  const options = []
  for (let h = startHour; h < endHour; h++) {
    options.push(`${String(h).padStart(2, '0')}:00`)
    options.push(`${String(h).padStart(2, '0')}:30`)
  }
  // 添加结束时间点
  options.push(`${String(endHour).padStart(2, '0')}:00`)
  return options
}

export default function Publish() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  // 表单状态
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('afternoon')
  const [selectedSpecificTime, setSelectedSpecificTime] = useState('14:00')
  const [selectedCafe, setSelectedCafe] = useState(null)
  const [selectedActivity, setSelectedActivity] = useState('quiet')
  const [maxPeople, setMaxPeople] = useState(3)
  const [intro, setIntro] = useState('')

  // 搜索相关状态
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [userLocation, setUserLocation] = useState(null)

  // 手动输入咖啡馆状态
  const [isManualInput, setIsManualInput] = useState(false)
  const [manualCafeName, setManualCafeName] = useState('')
  const [manualCafeAddress, setManualCafeAddress] = useState('')

  // 根据选中的时段生成时间选项
  const timeOptions = useMemo(() => {
    const slot = TIME_SLOTS.find(s => s.id === selectedTimeSlot)
    if (!slot) return []
    return generateTimeOptions(slot.startHour, slot.endHour)
  }, [selectedTimeSlot])

  // 时段切换时重置具体时间
  useEffect(() => {
    const slot = TIME_SLOTS.find(s => s.id === selectedTimeSlot)
    if (slot) {
      setSelectedSpecificTime(`${String(slot.startHour).padStart(2, '0')}:00`)
    }
  }, [selectedTimeSlot])

  // 生成未来 7 天的日期选项
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() + i)
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    return {
      value: date.toISOString().split('T')[0],
      label: i === 0 ? '今天' : i === 1 ? '明天' : `周${weekdays[date.getDay()]}`,
      fullDate: `${date.getMonth() + 1}月${date.getDate()}日`
    }
  })

  // 格式化完整日期时间显示
  const formatDateTimeDisplay = () => {
    if (!selectedDate) return '选择日期'

    const dateOption = dateOptions.find(d => d.value === selectedDate)
    const dateLabel = dateOption ? `${dateOption.label}・${dateOption.fullDate}` : selectedDate
    const slotLabel = TIME_SLOTS.find(s => s.id === selectedTimeSlot)?.label || ''

    return `${dateLabel}・${selectedSpecificTime}`
  }

  // 初始化定位（静默失败）
  useEffect(() => {
    const init = async () => {
      try {
        await initAmap()
        const location = await getCurrentLocation()
        setUserLocation(location)

        // 自动搜索附近咖啡馆
        if (location) {
          handleSearchCafes(location)
        }
      } catch (err) {
        console.log('定位不可用，使用手动输入模式')
        // 定位失败时不显示错误，默认使用手动输入
        setIsManualInput(true)
      }
    }
    init()
  }, [])

  // 搜索咖啡馆
  const handleSearchCafes = async (location = userLocation) => {
    if (!location) {
      setIsManualInput(true)
      return
    }

    setSearching(true)

    try {
      const cafes = await searchNearbyCafes(
        location,
        searchKeyword || '咖啡',
        3000 // 搜索半径 3km
      )
      setSearchResults(cafes)
      setIsManualInput(false)
    } catch (err) {
      console.error('搜索失败，切换到手动输入:', err)
      setIsManualInput(true)
    } finally {
      setSearching(false)
    }
  }

  // 手动选择咖啡馆
  const handleManualSelectCafe = () => {
    if (!manualCafeName.trim() || !manualCafeAddress.trim()) {
      alert('请填写咖啡馆名称和地址')
      return
    }

    setSelectedCafe({
      id: 'manual-' + Date.now(),
      name: manualCafeName.trim(),
      address: manualCafeAddress.trim()
    })
  }

  // 提交发布
  const handlePublish = async () => {
    if (!selectedDate) {
      alert('请选择日期')
      return
    }

    // 确定要使用的咖啡馆
    let cafeToUse = selectedCafe

    // 检查是否已选择咖啡馆
    if (isManualInput && !cafeToUse) {
      if (!manualCafeName.trim() || !manualCafeAddress.trim()) {
        alert('请填写咖啡馆名称和地址')
        return
      }
      cafeToUse = {
        id: 'manual-' + Date.now(),
        name: manualCafeName.trim(),
        address: manualCafeAddress.trim()
      }
      setSelectedCafe(cafeToUse)
    }

    if (!cafeToUse) {
      alert('请选择咖啡馆')
      return
    }

    setLoading(true)

    try {
      // 硬性约束：maxPeople 只能是 2 或 3
      if (maxPeople !== 2 && maxPeople !== 3) {
        throw new Error('人数上限只能是 2 或 3')
      }

      await addDoc(collection(db, 'meetups'), {
        creatorId: user.uid,
        cafeName: cafeToUse.name,
        cafeAddress: cafeToUse.address,
        cafeId: cafeToUse.id,
        date: selectedDate,
        timeSlot: selectedTimeSlot,
        specificTime: selectedSpecificTime,
        activityType: selectedActivity,
        intro: intro.trim(),
        maxPeople: maxPeople,
        attendees: [user.uid], // 创建者自动加入
        status: 'open',
        createdAt: serverTimestamp()
      })

      navigate('/')
    } catch (err) {
      console.error('发布失败:', err)
      alert(err.message || '发布失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F2EB]" style={{ paddingBottom: '80px' }}>
      {/* 页面头部 */}
      <div className="bg-[#F7F2EB] px-4 py-3 flex items-center gap-3 border-b border-[#E8D5BC]">
        <button
          onClick={() => navigate(-1)}
          className="text-[#9A7A5C] text-lg"
        >
          ←
        </button>
        <div>
          <h1 className="font-serif text-[#2C1A0E] text-lg tracking-wider">发布约咖</h1>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">

        {/* 日期选择 */}
        <div>
          <label className="text-xs text-[#9A7A5C] mb-2 tracking-wide">📅 什么时候</label>
          <div className="relative">
            <select
              value={selectedDate || ''}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-[#2C1A0E] bg-white text-[#2C1A0E] text-sm appearance-none focus:outline-none focus:border-[#2C1A0E]"
            >
              <option value="">{formatDateTimeDisplay()}</option>
              {dateOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} · {opt.fullDate}
                </option>
              ))}
            </select>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9A7A5C]">▾</span>
          </div>

          {/* 时段选择 */}
          <div className="flex gap-2 mt-3">
            {TIME_SLOTS.map(slot => (
              <button
                key={slot.id}
                onClick={() => setSelectedTimeSlot(slot.id)}
                className={`flex-1 py-2 rounded-lg border-2 text-xs transition-colors ${
                  selectedTimeSlot === slot.id
                    ? 'border-[#2C1A0E] bg-[#2C1A0E] text-white'
                    : 'border-[#E8D5BC] bg-white text-[#9A7A5C]'
                }`}
              >
                {slot.emoji} {slot.label}
              </button>
            ))}
          </div>

          {/* 具体时间选择（横向滑动） */}
          <div className="mt-3">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {timeOptions.map(time => (
                <button
                  key={time}
                  onClick={() => setSelectedSpecificTime(time)}
                  className={`px-4 py-2 rounded-lg border-2 text-xs whitespace-nowrap transition-colors flex-shrink-0 ${
                    selectedSpecificTime === time
                      ? 'border-[#2C1A0E] bg-[#2C1A0E] text-white'
                      : 'border-[#E8D5BC] bg-white text-[#9A7A5C]'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 咖啡馆选择 */}
        <div>
          <label className="text-xs text-[#9A7A5C] mb-2 tracking-wide">☕ 去哪家咖啡馆</label>

          {/* 已选择的咖啡馆 */}
          {selectedCafe && (
            <div className="bg-white rounded-xl px-4 py-3 border-2 border-[#C17F4A] bg-[#FFF8F0] mb-3">
              <div className="text-sm text-[#2C1A0E] font-medium">{selectedCafe.name}</div>
              <div className="text-xs text-[#9A7A5C] mt-1">
                📍 {selectedCafe.address}
              </div>
              <button
                onClick={() => setSelectedCafe(null)}
                className="text-xs text-[#A0714F] mt-2 underline"
              >
                重新选择
              </button>
            </div>
          )}

          {!selectedCafe && (
            <>
              {/* 模式切换 */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setIsManualInput(false)}
                  className={`flex-1 py-2 rounded-lg text-xs border-2 transition-colors ${
                    !isManualInput
                      ? 'border-[#2C1A0E] bg-[#2C1A0E] text-white'
                      : 'border-[#E8D5BC] bg-white text-[#9A7A5C]'
                  }`}
                >
                  📍 定位搜索
                </button>
                <button
                  onClick={() => setIsManualInput(true)}
                  className={`flex-1 py-2 rounded-lg text-xs border-2 transition-colors ${
                    isManualInput
                      ? 'border-[#2C1A0E] bg-[#2C1A0E] text-white'
                      : 'border-[#E8D5BC] bg-white text-[#9A7A5C]'
                  }`}
                >
                  ✏️ 手动输入
                </button>
              </div>

              {/* 定位搜索模式 */}
              {!isManualInput && (
                <>
                  {/* 搜索框 */}
                  <div
                    onClick={() => handleSearchCafes()}
                    className="bg-white rounded-xl px-4 py-3 flex items-center gap-2 border-2 border-[#E8D5BC] text-[#9A7A5C] text-sm cursor-pointer active:border-[#2C1A0E] transition-colors"
                  >
                    <span>📍</span>
                    <input
                      type="text"
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearchCafes()}
                      placeholder="搜索附近咖啡馆…"
                      className="flex-1 bg-transparent outline-none placeholder:text-[#E8D5BC]"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSearchCafes()
                      }}
                      className="text-xs text-[#2C1A0E] font-medium"
                    >
                      {searching ? '搜索中…' : '搜索'}
                    </button>
                  </div>

                  {/* 搜索结果 */}
                  {searchResults.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2">
                      {searchResults.map(cafe => (
                        <div
                          key={cafe.id}
                          onClick={() => setSelectedCafe(cafe)}
                          className="bg-white rounded-xl px-4 py-3 border-2 cursor-pointer border-[#E8D5BC] active:border-[#2C1A0E] transition-colors"
                        >
                          <div className="text-sm text-[#2C1A0E] font-medium">{cafe.name}</div>
                          <div className="text-xs text-[#9A7A5C] mt-1">
                            📍 {cafe.address}
                            {cafe.distance && ` · ${formatDistance(cafe.distance)}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchResults.length === 0 && !searching && (
                    <p className="text-xs text-[#9A7A5C] mt-2 text-center">
                      点击搜索按钮查找附近咖啡馆
                    </p>
                  )}
                </>
              )}

              {/* 手动输入模式 */}
              {isManualInput && (
                <div className="flex flex-col gap-3">
                  <div>
                    <input
                      type="text"
                      value={manualCafeName}
                      onChange={(e) => setManualCafeName(e.target.value)}
                      placeholder="咖啡馆名称（如：星巴克）"
                      className="w-full px-4 py-3 rounded-xl border-2 border-[#E8D5BC] bg-white text-[#2C1A0E] text-sm focus:outline-none focus:border-[#2C1A0E]"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={manualCafeAddress}
                      onChange={(e) => setManualCafeAddress(e.target.value)}
                      placeholder="咖啡馆地址（如：三里屯路19号）"
                      className="w-full px-4 py-3 rounded-xl border-2 border-[#E8D5BC] bg-white text-[#2C1A0E] text-sm focus:outline-none focus:border-[#2C1A0E]"
                    />
                  </div>
                  <button
                    onClick={handleManualSelectCafe}
                    disabled={!manualCafeName.trim() || !manualCafeAddress.trim()}
                    className="w-full py-3 rounded-xl bg-[#2C1A0E] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    确认
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 活动类型 */}
        <div>
          <label className="text-xs text-[#9A7A5C] mb-2 tracking-wide">🎯 一起做什么</label>
          <div className="grid grid-cols-2 gap-2">
            {ACTIVITY_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => setSelectedActivity(type.id)}
                className={`py-3 px-2 rounded-xl border-2 text-xs transition-colors leading-relaxed ${
                  selectedActivity === type.id
                    ? 'border-[#2C1A0E] bg-[#F5EDE3] text-[#2C1A0E] font-medium'
                    : 'border-[#E8D5BC] bg-white text-[#9A7A5C]'
                }`}
              >
                {type.emoji} {type.label}
                <span className="block text-[9px] opacity-70 mt-0.5">{type.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 人数选择 */}
        <div>
          <label className="text-xs text-[#9A7A5C] mb-2 tracking-wide">👥 最多几个人（含你）</label>
          <div className="flex gap-3">
            {[2, 3].map(num => (
              <button
                key={num}
                onClick={() => setMaxPeople(num)}
                className={`flex-1 py-3 rounded-xl border-2 transition-colors ${
                  maxPeople === num
                    ? 'border-[#2C1A0E] bg-[#F5EDE3]'
                    : 'border-[#E8D5BC] bg-white'
                }`}
              >
                <div className="font-serif text-2xl font-bold text-[#2C1A0E]">{num}</div>
                <div className="text-xs text-[#9A7A5C] mt-1">{num === 2 ? '就我们俩' : '小圈子'}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-[#9A7A5C] mt-2 text-center opacity-70">最多3人，不做大型聚会</p>
        </div>

        {/* 一句话介绍 */}
        <div>
          <label className="text-xs text-[#9A7A5C] mb-2 tracking-wide">🌿 说一句话（可选）</label>
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="简单介绍一下今天的计划…"
            rows={3}
            maxLength={150}
            className="w-full px-4 py-3 rounded-xl border-2 border-[#E8D5BC] bg-white text-[#2C1A0E] text-sm focus:outline-none focus:border-[#2C1A0E] resize-none"
          />
        </div>

      </div>

      {/* 发布按钮 */}
      <button
        onClick={handlePublish}
        disabled={loading || !selectedDate || !selectedCafe}
        className="fixed bottom-16 left-0 right-0 py-4 bg-[#2C1A0E] text-white text-sm font-medium tracking-wider disabled:opacity-50 disabled:cursor-not-allowed z-20"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        {loading ? '发布中…' : '发布约咖'}
      </button>
    </div>
  )
}
