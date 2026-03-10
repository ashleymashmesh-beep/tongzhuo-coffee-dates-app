import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 监听登录状态变化
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('=== onAuthStateChanged 触发 ===')
      console.log('firebaseUser:', firebaseUser)

      if (firebaseUser) {
        console.log('用户已登录，uid:', firebaseUser.uid)
        console.log('手机号:', firebaseUser.phoneNumber)

        try {
          // 获取用户额外信息
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
          console.log('用户文档存在:', userDoc.exists())

          if (userDoc.exists()) {
            console.log('用户数据:', userDoc.data())
            setUser({
              uid: firebaseUser.uid,
              phoneNumber: firebaseUser.phoneNumber,
              ...userDoc.data()
            })
          } else {
            console.log('新用户，创建用户文档')
            // 新用户，自动创建基础用户记录
            await setDoc(doc(db, 'users', firebaseUser.uid), {
              nickname: null,
              avatar: null,
              bio: null,
              city: null,
              createdAt: new Date().toISOString()
            })
            setUser({
              uid: firebaseUser.uid,
              phoneNumber: firebaseUser.phoneNumber,
              isNewUser: true
            })
          }
        } catch (err) {
          console.error('获取用户数据失败，使用基础信息:', err)
          // 即使读取失败也用基础信息继续
          setUser({
            uid: firebaseUser.uid,
            phoneNumber: firebaseUser.phoneNumber
          })
        }
      } else {
        console.log('用户未登录')
        setUser(null)
      }
      console.log('设置 loading 为 false')
      setLoading(false)
    })

    return unsubscribe
  }, [])

  // 登出
  const logout = async () => {
    await auth.signOut()
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
