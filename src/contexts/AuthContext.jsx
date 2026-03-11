import { createContext, useContext, useEffect, useState } from 'react'
import { doc, getDoc, setDoc, query, where, getDocs, collection } from 'firebase/firestore'
import { db } from '../lib/firebase'

const AuthContext = createContext(null)

/**
 * 从 token 中解析手机号和过期时间
 * token 格式：base64(phone:timestamp)
 */
function parseToken(token) {
  if (!token) return null
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const [phone, timestamp] = decoded.split(':')
    return { phone, timestamp: parseInt(timestamp) }
  } catch {
    return null
  }
}

/**
 * 检查 token 是否过期（7天有效期）
 */
function isTokenExpired(timestamp) {
  if (!timestamp) return true
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  return Date.now() - timestamp > sevenDays
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 检查本地存储的 token
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('tongzhuo_token')
        const phone = localStorage.getItem('tongzhuo_phone')

        if (!token || !phone) {
          console.log('未找到登录凭证')
          setUser(null)
          setLoading(false)
          return
        }

        // 验证 token
        const tokenData = parseToken(token)
        if (!tokenData || tokenData.phone !== phone) {
          console.log('Token 无效')
          localStorage.removeItem('tongzhuo_token')
          localStorage.removeItem('tongzhuo_phone')
          setUser(null)
          setLoading(false)
          return
        }

        // 检查 token 是否过期
        if (isTokenExpired(tokenData.timestamp)) {
          console.log('Token 已过期')
          localStorage.removeItem('tongzhuo_token')
          localStorage.removeItem('tongzhuo_phone')
          setUser(null)
          setLoading(false)
          return
        }

        console.log('用户已登录，手机号:', phone)

        // 在 Firestore 中查找用户（使用手机号作为 ID）
        const userDoc = await getDoc(doc(db, 'users', phone))

        if (userDoc.exists()) {
          console.log('用户数据:', userDoc.data())
          setUser({
            uid: phone, // 使用手机号作为 uid
            phoneNumber: phone,
            ...userDoc.data()
          })
        } else {
          console.log('新用户，创建用户文档')
          // 新用户，创建基础用户记录
          await setDoc(doc(db, 'users', phone), {
            phoneNumber: phone,
            nickname: null,
            avatar: null,
            bio: null,
            city: null,
            createdAt: new Date().toISOString()
          })
          setUser({
            uid: phone,
            phoneNumber: phone,
            isNewUser: true
          })
        }
      } catch (err) {
        console.error('获取用户数据失败:', err)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  // 登出
  const logout = async () => {
    localStorage.removeItem('tongzhuo_token')
    localStorage.removeItem('tongzhuo_phone')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
