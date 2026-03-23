import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { checkinsApi } from '../lib/api'

export default function Calendar() {
  const { user } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [checkins, setCheckins] = useState([])
  const [showCheckinModal, setShowCheckinModal] = useState(false)
  const [selectedCheckin, setSelectedCheckin] = useState(null)
  const [uploading, setUploading] = useState(false)

  // 打卡表单状态
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [moodScore, setMoodScore] = useState(3)
  const [cafeName, setCafeName] = useState('')
  const [note, setNote] = useState('')

  // 获取当前月份的日历数据
  const getCalendarData = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    // 获取当月第一天是星期几
    const firstDay = new Date(year, month, 1).getDay()
    // 获取当月有多少天
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    return { firstDay, daysInMonth, year, month }
  }

  // 格式化日期为 YYYY-MM-DD
  const formatDateKey = (year, month, day) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  // 获取打卡数据
  useEffect(() => {
    if (!user) return

    const fetchCheckins = async () => {
      try {
        const { year, month } = getCalendarData()
        const result = await checkinsApi.list({
          user_id: user.id,
          year: year.toString(),
          month: (month + 1).toString()
        })
        setCheckins(result.data || [])
      } catch (err) {
        console.error('获取打卡数据失败:', err)
      }
    }

    fetchCheckins()
  }, [user, currentDate])

  // 获取某日期的打卡记录
  const getCheckinForDate = (day) => {
    const { year, month } = getCalendarData()
    const dateKey = formatDateKey(year, month, day)
    return checkins.find(c => c.date === dateKey)
  }

  // 上一个/下一个月
  const changeMonth = (delta) => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() + delta)
    setCurrentDate(newDate)
  }

  // 选择照片并转换为base64
  const handlePhotoSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      return
    }

    // 验证文件大小（限制10MB）
    if (file.size > 10 * 1024 * 1024) {
      alert('图片大小不能超过10MB')
      return
    }

    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))

    // 转换为base64
    const reader = new FileReader()
    reader.onloadend = () => {
      setPhotoUrl(reader.result)
    }
    reader.readAsDataURL(file)
  }

  // 上传并保存打卡
  const handleSaveCheckin = async () => {
    if (!photoUrl) {
      alert('请选择照片')
      return
    }

    setUploading(true)

    try {
      const { year, month } = getCalendarData()
      const today = new Date()
      const dateKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate())

      // 保存打卡记录
      const result = await checkinsApi.create({
        user_id: user.id,
        photo_url: photoUrl,
        cafe_name: cafeName.trim() || null,
        mood_score: moodScore,
        note: note.trim() || null,
        date: dateKey
      })

      // 立即更新本地状态，让照片立刻显示
      const newCheckin = {
        id: result.data.id,
        user_id: user.id,
        photo_url: photoUrl,
        cafe_name: cafeName.trim() || null,
        mood_score: moodScore,
        note: note.trim() || null,
        date: dateKey,
        created_at: new Date().toISOString()
      }
      setCheckins(prev => [...prev, newCheckin])

      // 重置表单并关闭弹窗
      setPhoto(null)
      setPhotoPreview(null)
      setPhotoUrl('')
      setMoodScore(3)
      setCafeName('')
      setNote('')
      setShowCheckinModal(false)
    } catch (err) {
      console.error('打卡失败:', err)
      alert(`打卡失败: ${err.message || '未知错误'}`)
    } finally {
      setUploading(false)
    }
  }

  // 点击日期格子
  const handleDateClick = (day) => {
    const { year, month } = getCalendarData()
    const clickedDate = new Date(year, month, day)
    const today = new Date()

    // 只能今天打卡
    const isToday =
      clickedDate.getDate() === today.getDate() &&
      clickedDate.getMonth() === today.getMonth() &&
      clickedDate.getFullYear() === today.getFullYear()

    if (isToday) {
      setShowCheckinModal(true)
      return
    }

    // 查看其他日期的打卡详情
    const checkin = getCheckinForDate(day)
    if (checkin) {
      setSelectedCheckin(checkin)
    }
  }

  const { firstDay, daysInMonth, year, month } = getCalendarData()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const today = new Date()
  const isCurrentMonth =
    today.getMonth() === month &&
    today.getFullYear() === year

  return (
    <div className="min-h-screen bg-[#F7F2EB]">
      {/* 页面头部 */}
      <div className="bg-[#F7F2EB] px-4 py-3 border-b border-[#E8D5BC]">
        <h1 className="font-serif text-[#2C1A0E] text-xl tracking-widest text-center">咖啡日历</h1>
        <p className="text-xs text-[#A0714F] text-center mt-1">记录每一杯咖啡</p>
      </div>

      {/* 月历导航 */}
      <div className="flex justify-between items-center px-4 py-3">
        <button
          onClick={() => changeMonth(-1)}
          className="text-[#9A7A5C] text-lg px-2"
        >
          ‹
        </button>
        <h2 className="font-serif text-[#2C1A0E] text-lg">
          {year}年 {month + 1}月
        </h2>
        <button
          onClick={() => changeMonth(1)}
          className="text-[#9A7A5C] text-lg px-2"
        >
          ›
        </button>
      </div>

      {/* 星期标题 */}
      <div className="grid grid-cols-7 px-4 mb-2">
        {weekdays.map(wd => (
          <div key={wd} className="text-center text-xs text-[#9A7A5C] py-2">
            {wd}
          </div>
        ))}
      </div>

      {/* 日历格子 */}
      <div className="grid grid-cols-7 gap-1 px-4 pb-4">
        {/* 空白格子 */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {/* 日期格子 */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const checkin = getCheckinForDate(day)
          const isToday = isCurrentMonth && day === today.getDate()

          return (
            <div
              key={day}
              onClick={() => handleDateClick(day)}
              className="aspect-square rounded-xl overflow-hidden cursor-pointer active:scale-95 transition-transform relative"
            >
              {checkin ? (
                // 有打卡：显示照片
                <div className="w-full h-full relative">
                  <img
                    src={checkin.photo_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-white/90 flex items-center justify-center text-[10px] shadow">
                    {day}
                  </div>
                  {/* 今天标记 */}
                  {isToday && (
                    <div className="absolute inset-0 border-2 border-[#C17F4A] rounded-xl"></div>
                  )}
                </div>
              ) : (
                // 无打卡：空白格子
                <div className={`w-full h-full flex items-center justify-center text-sm ${
                  isToday ? 'bg-[#F0E6D6] text-[#C17F4A] font-semibold' : 'text-[#9A7A5C]'
                }`}>
                  {day}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 打卡按钮 */}
      <div className="px-4 pb-24">
        <button
          onClick={() => setShowCheckinModal(true)}
          className="w-full py-3 rounded-xl bg-[#2C1A0E] text-white text-sm font-medium flex items-center justify-center gap-2"
        >
          📷 今天打卡
        </button>
      </div>

      {/* 打卡弹窗 */}
      {showCheckinModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCheckinModal(false)}
        >
          <div
            className="bg-[#FDFAF6] w-full max-w-md rounded-3xl p-6 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题 */}
            <h2 className="font-serif text-[#2C1A0E] text-xl mb-4 text-center">今天打卡</h2>

            {/* 照片上传 */}
            <div className="mb-4">
              <label className="block text-xs text-[#9A7A5C] mb-2">📷 拍一张照片</label>
              <div className="relative">
                {photoPreview ? (
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="预览"
                      className="w-full h-48 object-cover rounded-xl"
                    />
                    <button
                      onClick={() => {
                        setPhoto(null)
                        setPhotoPreview(null)
                        setPhotoUrl('')
                      }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <label className="block w-full h-48 rounded-xl border-2 border-dashed border-[#E8D5BC] flex flex-col items-center justify-center cursor-pointer hover:border-[#2C1A0E] transition-colors">
                    <span className="text-4xl mb-2">📷</span>
                    <span className="text-xs text-[#9A7A5C]">点击拍照或选择照片</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* 咖啡馆名称（可选） */}
            <div className="mb-4">
              <label className="block text-xs text-[#9A7A5C] mb-2">☕ 咖啡馆（可选）</label>
              <input
                type="text"
                value={cafeName}
                onChange={(e) => setCafeName(e.target.value)}
                placeholder="在哪里喝咖啡？"
                className="w-full px-4 py-3 rounded-xl border-2 border-[#E8D5BC] bg-white text-[#2C1A0E] text-sm focus:outline-none focus:border-[#2C1A0E]"
              />
            </div>

            {/* 心情评分 */}
            <div className="mb-4">
              <label className="block text-xs text-[#9A7A5C] mb-2">☕ 今天的心情</label>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map(score => (
                  <button
                    key={score}
                    onClick={() => setMoodScore(score)}
                    className={`text-2xl transition-transform ${moodScore >= score ? 'scale-110' : 'opacity-30'}`}
                  >
                    ☕
                  </button>
                ))}
              </div>
            </div>

            {/* 小确幸文字 */}
            <div className="mb-6">
              <label className="block text-xs text-[#9A7A5C] mb-2">🌿 小确幸（可选）</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="记录今天的小美好..."
                rows={3}
                maxLength={150}
                className="w-full px-4 py-3 rounded-xl border-2 border-[#E8D5BC] bg-white text-[#2C1A0E] text-sm focus:outline-none focus:border-[#2C1A0E] resize-none"
              />
            </div>

            {/* 保存按钮 */}
            <button
              onClick={handleSaveCheckin}
              disabled={!photo || uploading}
              className="w-full py-4 rounded-xl bg-[#2C1A0E] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? '保存中…' : '保存打卡'}
            </button>
          </div>
        </div>
      )}

      {/* 打卡详情弹窗 */}
      {selectedCheckin && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedCheckin(null)}
        >
          <div
            className="bg-[#FDFAF6] w-full max-w-md rounded-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 照片 */}
            <div className="relative">
              <img
                src={selectedCheckin.photo_url}
                alt=""
                className="w-full h-64 object-cover"
              />
            </div>

            {/* 详情 */}
            <div className="p-6">
              {/* 日期 */}
              <div className="text-center text-xs text-[#9A7A5C] mb-4">
                {selectedCheckin.date}
              </div>

              {/* 心情评分 */}
              <div className="flex justify-center gap-1 mb-4">
                {Array.from({ length: selectedCheckin.mood_score || 3 }).map((_, i) => (
                  <span key={i} className="text-lg">☕</span>
                ))}
                {Array.from({ length: 5 - (selectedCheckin.mood_score || 3) }).map((_, i) => (
                  <span key={i} className="text-lg opacity-30">☕</span>
                ))}
              </div>

              {/* 咖啡馆 */}
              {selectedCheckin.cafe_name && (
                <div className="text-center text-sm text-[#2C1A0E] mb-4">
                  📍 {selectedCheckin.cafe_name}
                </div>
              )}

              {/* 小确幸文字 */}
              {selectedCheckin.note && (
                <div className="text-center text-sm text-[#9A7A5C] leading-relaxed">
                  「{selectedCheckin.note}」
                </div>
              )}
            </div>

            {/* 关闭按钮 */}
            <button
              onClick={() => setSelectedCheckin(null)}
              className="w-full py-4 border-t border-[#E8D5BC] text-sm text-[#9A7A5C]"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
