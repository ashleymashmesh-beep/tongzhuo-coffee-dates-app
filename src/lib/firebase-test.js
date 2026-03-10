// Firebase 连接测试
// 在配置好 .env 后运行此测试

import { db } from './firebase.js'
import { collection, getDocs } from 'firebase/firestore'

export async function runTest() {
  console.log('开始测试 Firebase 连接...')

  // 检查环境变量是否配置
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID
  }

  if (!config.apiKey || !config.projectId) {
    console.error('❌ Firebase 环境变量未配置')
    console.log('请复制 .env.example 为 .env 并填入你的 Firebase 配置')
    return false
  }

  try {
    // 尝试查询 users 集合（即使不存在也能验证连接）
    const testSnapshot = await getDocs(collection(db, 'users'))
    console.log('✅ Firebase 连接成功！')
    console.log(`查询结果: ${testSnapshot.size} 条记录`)
    return true
  } catch (error) {
    if (error.code === 'permission-denied') {
      console.log('✅ Firebase 连接成功，但 Firestore 规则未配置')
      console.log('请在 Firebase Console 设置 Firestore 安全规则')
    } else {
      console.error('❌ Firebase 连接失败:', error.message)
    }
    return false
  }
}
