import { useState } from 'react'
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'
import { auth } from '../lib/firebase'

export default function Login({ onLoginSuccess }) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('phone') // 'phone' | 'code'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmationResult, setConfirmationResult] = useState(null)

  // 发送验证码
  const handleSendCode = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // 简单验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(phoneNumber)) {
      setError('请输入正确的手机号')
      setLoading(false)
      return
    }

    try {
      // 清除旧的 reCAPTCHA 实例（如果存在）
      if (window.recaptchaVerifier) {
        try {
          await window.recaptchaVerifier.clear()
        } catch (e) {
          console.log('清除旧 reCAPTCHA 失败:', e)
        }
        window.recaptchaVerifier = null
      }

      // 初始化 reCAPTCHA（Firebase Phone Auth 必需）
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: (response) => {
          console.log('reCAPTCHA solved:', response)
        },
        'expired-callback': () => {
          setError('验证过期，请重试')
        }
      })

      // 渲染 reCAPTCHA
      await window.recaptchaVerifier.render()
      console.log('reCAPTCHA 已渲染')

      // 发送验证码
      const fullPhoneNumber = `+86${phoneNumber}`
      console.log('发送验证码到:', fullPhoneNumber)

      const result = await signInWithPhoneNumber(
        auth,
        fullPhoneNumber,
        window.recaptchaVerifier
      )

      console.log('验证码发送成功')
      setConfirmationResult(result)
      setStep('code')
    } catch (err) {
      console.error('发送验证码失败:', err)

      // 显示错误信息
      let errorMsg = ''

      switch (err.code) {
        case 'auth/too-many-requests':
          errorMsg = '发送太频繁，请稍后再试'
          break
        case 'auth/invalid-phone-number':
          errorMsg = '手机号格式不正确'
          break
        case 'auth/quota-exceeded':
          errorMsg = '发送次数超限，请稍后再试'
          break
        case 'auth/captcha-check-failed':
          errorMsg = '人机验证失败，请重试'
          break
        case 'auth/unauthorized-domain':
          errorMsg = '当前域名未授权'
          break
        default:
          errorMsg = '发送失败，请稍后重试'
      }

      setError(errorMsg)
    } finally {
      setLoading(false)
    }
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
      const result = await confirmationResult.confirm(code)
      console.log('登录成功:', result)
      onLoginSuccess()
    } catch (err) {
      console.error('验证失败:', err)

      if (err.code === 'auth/invalid-verification-code') {
        setError('验证码错误')
      } else if (err.code === 'auth/code-expired') {
        setError('验证码已过期，请重新获取')
      } else {
        setError('验证失败，请重试')
      }
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

              <button
                onClick={handleBackToPhone}
                className="w-full py-3 rounded-xl bg-white text-[#9A7A5C] text-sm border border-[#E8D5BC] transition-colors"
              >
                返回修改手机号
              </button>
            </>
          )}
        </div>

        {/* 提示文字 */}
        <p className="text-center text-xs text-[#9A7A5C] mt-6 leading-relaxed">
          登录即表示同意《同桌使用协议》<br/>
          我们不会发送推销短信
        </p>
      </div>

      {/* reCAPTCHA 容器（隐藏） */}
      <div id="recaptcha-container" className="hidden"></div>
    </div>
  )
}
