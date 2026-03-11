import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Firebase 配置 - 从环境变量读取
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
}

// 初始化 Firebase
const app = initializeApp(firebaseConfig)

// 初始化服务（Firestore + Storage，不再使用 Auth）
export const db = getFirestore(app)
export const storage = getStorage(app)
