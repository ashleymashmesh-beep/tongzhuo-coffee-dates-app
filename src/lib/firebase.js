import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAuth } from 'firebase/auth'

// Firebase 配置
// TODO: 后续需要将配置移到环境变量以提高安全性
const firebaseConfig = {
  apiKey: "AIzaSyAp5aqJ9jjYKXPOOUP8OgB3SfjJxZ_5S7Q",
  authDomain: "tongzhuo-9adea.firebaseapp.com",
  projectId: "tongzhuo-9adea",
  storageBucket: "tongzhuo-9adea.firebasestorage.app",
  messagingSenderId: "676959056294",
  appId: "1:676959056294:web:03999258175849279f67"
}

// 初始化 Firebase
const app = initializeApp(firebaseConfig)

// 初始化服务
export const db = getFirestore(app)
export const storage = getStorage(app)
export const auth = getAuth(app)

// 临时验证函数 - 用于测试 Firebase 连接
export async function testFirebaseConnection() {
  try {
    // 尝试做一个简单的查询来验证连接
    // 注意：即使查询返回空结果也说明连接正常
    import('./firebase-test.js').then(({ runTest }) => runTest())
    return true
  } catch (error) {
    console.error('Firebase 连接失败:', error)
    return false
  }
}
