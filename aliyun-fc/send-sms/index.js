/**
 * 阿里云函数计算 - 发送短信验证码
 *
 * 依赖：需要在函数计算中安装以下依赖
 * npm install @alicloud/dysmsapi20170525 @alicloud/openapi-client
 *
 * 环境变量配置：
 * - ACCESS_KEY_ID: 阿里云 AccessKey ID
 * - ACCESS_KEY_SECRET: 阿里云 AccessKey Secret
 * - SIGN_NAME: 短信签名名称（如：同桌）
 * - TEMPLATE_CODE: 短信模板代码（如：SMS_xxxxx）
 * - REDIS_HOST: Redis 地址（可选，用于存储验证码）
 * - REDIS_PORT: Redis 端口（可选）
 * - REDIS_PASSWORD: Redis 密码（可选）
 */

const Dysmsapi = require('@alicloud/dysmsapi20170525')
const OpenApi = require('@alicloud/openapi-client')

// Redis 客户端（如果使用）
let redisClient = null

// 初始化 Redis（可选）
async function initRedis() {
  // 如果配置了 Redis，则连接
  if (process.env.REDIS_HOST) {
    const redis = require('redis')
    redisClient = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT || 6379
      },
      password: process.env.REDIS_PASSWORD
    })
    await redisClient.connect()
  }
}

// 生成随机验证码
function generateCode(length = 6) {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// 发送短信
async function sendSms(phone, code) {
  const config = new OpenApi.Config({
    accessKeyId: process.env.ACCESS_KEY_ID,
    accessKeySecret: process.env.ACCESS_KEY_SECRET,
    endpoint: 'dysmsapi.aliyuncs.com'
  })

  const client = new Dysmsapi.default(config)

  const request = new Dysmsapi.SendSmsRequest({
    phoneNumbers: phone,
    signName: process.env.SIGN_NAME,
    templateCode: process.env.TEMPLATE_CODE,
    templateParam: JSON.stringify({ code })
  })

  const response = await client.sendSms(request)
  return response.body
}

// 存储验证码（使用 Redis 或内存）
async function storeCode(phone, code) {
  const key = `sms_code:${phone}`
  const expireTime = 300 // 5分钟过期

  if (redisClient) {
    await redisClient.setEx(key, expireTime, code)
  } else {
    // 使用内存存储（单实例场景）
    if (!global.codeStore) {
      global.codeStore = new Map()
    }
    global.codeStore.set(key, { code, expireAt: Date.now() + expireTime * 1000 })

    // 清理过期数据
    for (const [k, v] of global.codeStore.entries()) {
      if (v.expireAt < Date.now()) {
        global.codeStore.delete(k)
      }
    }
  }
}

// 验证验证码
async function verifyCode(phone, code) {
  const key = `sms_code:${phone}`

  if (redisClient) {
    const storedCode = await redisClient.get(key)
    if (storedCode === code) {
      await redisClient.del(key)
      return true
    }
    return false
  } else {
    const data = global.codeStore?.get(key)
    if (data && data.code === code && data.expireAt > Date.now()) {
      global.codeStore.delete(key)
      return true
    }
    return false
  }
}

// 检查发送频率限制
async function checkRateLimit(phone) {
  const key = `sms_rate:${phone}`
  const limitTime = 60 // 60秒内只能发送一次

  if (redisClient) {
    const exists = await redisClient.exists(key)
    if (exists) {
      return false
    }
    await redisClient.setEx(key, limitTime, '1')
    return true
  } else {
    if (!global.rateLimitStore) {
      global.rateLimitStore = new Map()
    }
    const data = global.rateLimitStore.get(key)
    if (data && data.expireAt > Date.now()) {
      return false
    }
    global.rateLimitStore.set(key, { expireAt: Date.now() + limitTime * 1000 })
    return true
  }
}

// 函数计算入口
exports.handler = async (event, context) => {
  // 初始化 Redis（如果需要）
  if (redisClient === null && process.env.REDIS_HOST) {
    await initRedis()
  }

  try {
    // 解析请求
    let body
    if (typeof event === 'string') {
      body = JSON.parse(event)
    } else if (event.body) {
      body = JSON.parse(event.body)
    } else {
      body = event
    }

    const { phone, action } = body

    // 验证手机号格式
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: '手机号格式不正确' })
      }
    }

    // 发送验证码
    if (action === 'send') {
      // 检查频率限制
      const canSend = await checkRateLimit(phone)
      if (!canSend) {
        return {
          statusCode: 429,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: '发送太频繁，请稍后再试' })
        }
      }

      // 生成验证码
      const code = generateCode()

      // 发送短信
      const result = await sendSms(phone, code)

      // 存储验证码
      await storeCode(phone, code)

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: '验证码已发送',
          requestId: result.requestId
        })
      }
    }

    // 验证验证码
    if (action === 'verify') {
      const { code } = body

      if (!code) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: '请提供验证码' })
        }
      }

      const isValid = await verifyCode(phone, code)

      if (isValid) {
        // 生成自定义 token（简单实现，生产环境建议使用 JWT）
        const token = Buffer.from(`${phone}:${Date.now()}`).toString('base64')

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            token,
            phone
          })
        }
      } else {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: '验证码错误或已过期' })
        }
      }
    }

    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '无效的操作' })
    }

  } catch (error) {
    console.error('Error:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: '服务器错误',
        message: error.message
      })
    }
  }
}
