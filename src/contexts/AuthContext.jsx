import { createContext, useContext, useEffect, useState } from 'react'
import { usersApi } from '../lib/api'

const AuthContext = createContext(null)

const STORAGE_KEY = 'tongzhuo_user'

// 从localStorage获取用户信息
function getStoredUser() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) {
      return JSON.parse(data)
    }
  } catch (err) {
    console.error('读取localStorage失败:', err)
  }
  return null
}

// 保存用户信息到localStorage
function setStoredUser(user) {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch (err) {
    console.error('写入localStorage失败:', err)
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 从localStorage读取用户信息
    const storedUser = getStoredUser()
    console.log('=== 从localStorage读取用户 ===')
    console.log('storedUser:', storedUser)

    if (storedUser) {
      // 从Workers API获取完整用户信息
      loadUserFromAPI(storedUser.id, storedUser)
    } else {
      setLoading(false)
    }
  }, [])

  // 从Workers API加载用户数据
  const loadUserFromAPI = async (userId, storedUser) => {
    try {
      const result = await usersApi.get(userId)
      const apiUser = result.data

      if (apiUser) {
        console.log('用户数据:', apiUser)
        setUser({
          id: apiUser.id,
          uid: apiUser.id, // 兼容旧代码
          email: apiUser.email,
          nickname: apiUser.nickname,
          avatar: apiUser.avatar,
          bio: apiUser.bio,
          city: apiUser.city
        })
      } else {
        // 如果API中没有用户数据，使用localStorage的数据
        console.log('API中无用户数据，使用localStorage数据')
        setUser({
          id: storedUser.id,
          uid: storedUser.id, // 兼容旧代码
          email: storedUser.email
        })
      }
    } catch (err) {
      console.error('获取用户数据失败，使用localStorage数据:', err)
      // 使用localStorage的数据，确保id和uid都存在
      setUser({
        id: storedUser.id,
        uid: storedUser.id, // 兼容旧代码
        email: storedUser.email
      })
    } finally {
      setLoading(false)
    }
  }

  // 登录（由Login.jsx调用）
  const login = (userData) => {
    console.log('=== 登录 ===', userData)
    const userWithUid = {
      ...userData,
      uid: userData.id // 兼容旧代码
    }
    setUser(userWithUid)
    setStoredUser(userWithUid)
  }

  // 登出
  const logout = () => {
    console.log('=== 登出 ===')
    setUser(null)
    setStoredUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
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
