import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Home from './pages/Home'
import Publish from './pages/Publish'
import Calendar from './pages/Calendar'
import Profile from './pages/Profile'
import BottomNav from './components/BottomNav'

function AppContent() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  console.log('=== AppContent 渲染 ===')
  console.log('loading:', loading)
  console.log('user:', user)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F2EB] flex items-center justify-center">
        <div className="text-[#2C1A0E]">加载中...</div>
      </div>
    )
  }

  if (!user) {
    return <Login onLoginSuccess={() => {
      console.log('=== onLoginSuccess 被调用 ===')
      navigate('/')
      console.log('navigate("/") 已调用')
    }} />
  }

  // TODO: 新用户注册流程，后续完善
  // 暂时直接进入首页

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/publish" element={<Publish />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
      <BottomNav />
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
