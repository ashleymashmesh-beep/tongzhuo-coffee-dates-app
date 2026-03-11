import { useState } from 'react'

// 阿里云函数计算 API 地址（需要在环境变量中配置）
const FC_API_URL = import.meta.env.VITE_FC_API_URL || ''

export default function Login({ onLoginSuccess }) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('phone') // 'phone' | 'code'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // 发送验证码
  const handleSendCode = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(phoneNumber)) {
      setError('请输入正确的手机号')
      setLoading(false)
      return
    }

    try {
      if (!FC_API_URL) {
        throw new Error('API 地址未配置，请联系管理员')
      }

      console.log('发送验证码到:', phoneNumber)

      const response = await fetch(FC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'send',
          phone: phoneNumber
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.message || '发送失败')
      }

      console.log('验证码发送成功:', result)
      setStep('code')

      // 开始倒计时
      startCountdown()
    } catch (err) {
      console.error('发送验证码失败:', err)
      setError(err.message || '发送失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // 倒计时
  const startCountdown = () => {
    setCountdown(60)
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // 验证码登录
  const handleVerifyCode = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!code || code.length !== 6) {
      setError('请输入6位验证码')
      setLoading(false)
      return
    }

    try {
      if (!FC_API_URL) {
        throw new Error('API 地址未配置')
      }

      console.log('验证验证码:', code)

      const response = await fetch(FC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'verify',
          phone: phoneNumber,
          code: code
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.message || '验证失败')
      }

      if (!result.success) {
        throw new Error('验证失败，请重试')
      }

      console.log('登录成功:', result)

      // 保存 token 到 localStorage
      if (result.token) {
        localStorage.setItem('tongzhuo_token', result.token)
        localStorage.setItem('tongzhuo_phone', result.phone)
      }

      onLoginSuccess()
    } catch (err) {
      console.error('验证失败:', err)
      setError(err.message || '验证失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 重新输入手机号
  const handleBackToPhone = () => {
    setStep('phone')
    setCode('')
    setError('')
  }

  return (
    <div className="min-h-screen bg-[#E8DDD0] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-serif text-[#2C1A0E] tracking-widest mb-2">同桌</h1>
          <p className="text-sm text-[#A0714F]">两三个人，慢慢成为真朋友</p>
        </div>

        {/* 登录卡片 */}
        <div className="bg-[#FDFAF6] rounded-3xl shadow-lg p-8 border-8 border-[#2C1A0E]">
          {step === 'phone' ? (
            <>
              <div className="mb-6">
                <label className="block text-xs text-[#9A7A5C] mb-2 tracking-wide">手机号</label>
                <div className="flex rounded-xl border-2 border-[#E8D5BC] bg-white overflow-hidden focus-within:border-[#2C1A0E] transition-colors">
                  <span className="px-4 py-3 text-[#2C1A0E] text-sm font-medium bg-[#F7F2EB] border-r border-[#E8D5BC] flex items-center">
                    +86
                  </span>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="176 1081 5919"
                    className="flex-1 px-4 py-3 bg-white text-[#2C1A0E] text-sm focus:outline-none placeholder:text-[#E8D5BC]"
                    maxLength={11}
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-500 mb-2">{error}</p>
              )}

              <button
                onClick={handleSendCode}
                disabled={loading || phoneNumber.length !== 11}
                className="w-full py-3 rounded-xl bg-[#2C1A0E] text-white text-sm font-medium tracking-wide disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {loading ? '发送中...' : '获取验证码'}
              </button>
            </>
          ) : (
            <>
              <div className="mb-6">
                <label className="block text-xs text-[#9A7A5C] mb-2 tracking-wide">
                  验证码已发送至 +86 {phoneNumber}
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="请输入6位验证码"
                  className="w-full px-4 py-3 rounded-xl border-2 border-[#E8D5BC] bg-white text-[#2C1A0E] text-center text-xl tracking-widest focus:outline-none focus:border-[#2C1A0E] transition-colors"
                  maxLength={6}
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-xs text-red-500 mb-2">{error}</p>
              )}

              <button
                onClick={handleVerifyCode}
                disabled={loading || code.length !== 6}
                className="w-full py-3 rounded-xl bg-[#2C1A0E] text-white text-sm font-medium tracking-wide disabled:opacity-50 disabled:cursor-not-allowed transition-opacity mb-3"
              >
                {loading ? '验证中...' : '登录'}
              </button>

              <div className="flex gap-2">
                <button
                  onClick={handleBackToPhone}
                  className="flex-1 py-3 rounded-xl bg-white text-[#9A7A5C] text-sm border border-[#E8D5BC] transition-colors"
                >
                  返回
                </button>
                {countdown > 0 ? (
                  <button
                    disabled
                    className="flex-1 py-3 rounded-xl bg-[#F7F2EB] text-[#9A7A5C] text-sm border border-[#E8D5BC]"
                  >
                    {countdown}秒后重试
                  </button>
                ) : (
                  <button
                    onClick={handleSendCode}
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl bg-white text-[#2C1A0E] text-sm border border-[#E8D5BC] transition-colors"
                  >
                    重新发送
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* 提示文字 */}
        <p className="text-center text-xs text-[#9A7A5C] mt-6 leading-relaxed">
          登录即表示同意《同桌使用协议》<br/>
          我们不会发送推销短信
        </p>
      </div>
    </div>
  )
}
