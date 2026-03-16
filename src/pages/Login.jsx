import { useState } from 'react'
import { signInAnonymously, updateProfile } from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import emailjs from '@emailjs/browser'

const EMAILJS_SERVICE_ID = 'service_vfamyld'
const EMAILJS_TEMPLATE_ID = 'template_5pxfw6n'
const EMAILJS_PUBLIC_KEY = 'Y8jcjpZJTGc3cRO_C'

// 生成6位验证码
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [savedCode, setSavedCode] = useState('')
  const [codeExpiry, setCodeExpiry] = useState(null)

  const handleSendCode = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('请输入正确的邮箱地址')
      setLoading(false)
      return
    }

    try {
      const newCode = generateCode()
      const expiry = Date.now() + 5 * 60 * 1000 // 5分钟后过期

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        { code: newCode, to_email: email },
        EMAILJS_PUBLIC_KEY
      )

      setSavedCode(newCode)
      setCodeExpiry(expiry)
      setStep('code')
    } catch (err) {
      console.error('发送失败:', err)
      setError('发送失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!code || code.length !== 6) {
      setError('请输入6位验证码')
      setLoading(false)
      return
    }

    if (Date.now() > codeExpiry) {
      setError('验证码已过期，请重新获取')
      setLoading(false)
      return
    }

    if (code !== savedCode) {
      setError('验证码错误')
      setLoading(false)
      return
    }

    try {
      const result = await signInAnonymously(auth)
      const user = result.user

      // 检查是否已有用户资料
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          email: email,
          createdAt: new Date(),
          uid: user.uid
        })
      }

      onLoginSuccess()
    } catch (err) {
      console.error('登录失败:', err)
      setError('登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleBackToEmail = () => {
    setStep('email')
    setCode('')
    setError('')
  }

  return (
    <div className="min-h-screen bg-[#E8DDD0] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-serif text-[#2C1A0E] tracking-widest mb-2">同桌</h1>
          <p className="text-sm text-[#A0714F]">两三个人，慢慢成为真朋友</p>
        </div>

        <div className="bg-[#FDFAF6] rounded-3xl shadow-lg p-8 border-8 border-[#2C1A0E]">
          {step === 'email' ? (
            <>
              <div className="mb-6">
                <label className="block text-xs text-[#9A7A5C] mb-2 tracking-wide">邮箱</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 rounded-xl border-2 border-[#E8D5BC] bg-white text-[#2C1A0E] text-sm focus:outline-none focus:border-[#2C1A0E] transition-colors placeholder:text-[#E8D5BC]"
                />
              </div>

              {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

              <button
                onClick={handleSendCode}
                disabled={loading || !email}
                className="w-full py-3 rounded-xl bg-[#2C1A0E] text-white text-sm font-medium tracking-wide disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {loading ? '发送中...' : '获取验证码'}
              </button>
            </>
          ) : (
            <>
              <div className="mb-6">
                <label className="block text-xs text-[#9A7A5C] mb-2 tracking-wide">
                  验证码已发送至 {email}
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

              {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

              <button
                onClick={handleVerifyCode}
                disabled={loading || code.length !== 6}
                className="w-full py-3 rounded-xl bg-[#2C1A0E] text-white text-sm font-medium tracking-wide disabled:opacity-50 disabled:cursor-not-allowed transition-opacity mb-3"
              >
                {loading ? '验证中...' : '登录'}
              </button>

              <button
                onClick={handleBackToEmail}
                className="w-full py-3 rounded-xl bg-white text-[#9A7A5C] text-sm border border-[#E8D5BC] transition-colors"
              >
                返回修改邮箱
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-[#9A7A5C] mt-6 leading-relaxed">
          登录即表示同意《同桌使用协议》<br/>
          我们不会发送推销邮件
        </p>
      </div>
    </div>
  )
}
