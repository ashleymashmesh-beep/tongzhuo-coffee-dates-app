/**
 * 同桌 - Cloudflare Workers
 * 处理容联云短信验证码
 */

// 容联云配置（从环境变量获取）
const YUNTONGXUN_SERVER = 'app.cloopen.com'
const YUNTONGXUN_PORT = '8883'
const YUNTONGXUN_VERSION = '2013-12-26'

// 验证码有效期（秒）
const CODE_EXPIRY_SECONDS = 300

// CORS 响应头
function setCorsHeaders(request, response) {
  const origins = (env.ALLOWED_ORIGINS || '').split(',')
  const origin = request.headers.get('Origin')

  if (origin && origins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
  }
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  return response
}

// 处理 OPTIONS 预检请求
function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  })
}

// 生成6位随机验证码
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// 计算过期时间戳
function getExpiryTimestamp() {
  return Date.now() + CODE_EXPIRY_SECONDS * 1000
}

// Base64 编码
function base64Encode(str) {
  return btoa(str)
}

// MD5 计算签名
async function md5(str) {
  const msgBuffer = new TextEncoder().encode(str)
  const hashBuffer = await crypto.subtle.digest('MD5', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

/**
 * 发送容联云短信
 */
async function sendYuntongxunSms(phone, code, env) {
  const accountSid = env.YUNTONGXUN_ACCOUNT_SID
  const accountToken = env.YUNTONGXUN_ACCOUNT_TOKEN
  const appId = env.YUNTONGXUN_APP_ID

  if (!accountSid || !accountToken || !appId) {
    throw new Error('容联云配置未设置，请在 Workers 设置环境变量')
  }

  // 构建请求时间戳
  const timestamp = Date.now().toString()
  const now = new Date()
  const date = now.toISOString().split('T')[0].replace(/-/g, '')

  // 构建签名
  const sig = accountSid + accountToken + timestamp
  const sigEncoded = await md5(sig)

  // 构建授权头
  const auth = base64Encode(accountSid + ':' + timestamp)

  // 构建请求URL
  const url = `https://${YUNTONGXUN_SERVER}:${YUNTONGXUN_PORT}/${YUNTONGXUN_VERSION}/Accounts/${accountSid}/SMS/TemplateSMS?sig=${sigEncoded}`

  // 构建请求体
  const body = {
    to: phone,
    appId: appId,
    templateId: '1', // 请在容联云后台创建短信模板并使用对应的模板ID
    datas: [code, '5'] // 模板参数：验证码，有效期（分钟）
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json;charset=utf-8',
      'Authorization': auth
    },
    body: JSON.stringify(body)
  })

  const result = await response.json()

  if (result.statusCode === '000000') {
    console.log('短信发送成功:', { phone, code })
    return true
  } else {
    console.error('短信发送失败:', result)
    throw new Error(`短信发送失败: ${result.statusMsg}`)
  }
}

/**
 * 处理发送验证码请求
 */
async function handleSendCode(request, env) {
  try {
    const { phone } = await request.json()

    // 验证手机号
    if (!phone || typeof phone !== 'string') {
      return Response.json({ success: false, message: '手机号不能为空' }, { status: 400 })
    }

    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(phone)) {
      return Response.json({ success: false, message: '手机号格式不正确' }, { status: 400 })
    }

    // 检查是否频繁发送（60秒内不能重复发送）
    const lastCodeKey = `sms:${phone}:last`
    const lastSent = await env.SMS_CODES.get(lastCodeKey)

    if (lastSent) {
      const lastSentTime = parseInt(lastSent)
      if (Date.now() - lastSentTime < 60000) {
        return Response.json({ success: false, message: '发送太频繁，请稍后再试' }, { status: 429 })
      }
    }

    // 生成验证码
    const code = generateCode()
    const expiryTime = getExpiryTimestamp()

    // 发送短信
    await sendYuntongxunSms(phone, code, env)

    // 存储验证码到 KV
    const codeKey = `sms:${phone}:code`
    await env.SMS_CODES.put(codeKey, JSON.stringify({
      code,
      expiryTime,
      createdAt: Date.now()
    }), {
      expirationTtl: CODE_EXPIRY_SECONDS
    })

    // 记录最后发送时间
    await env.SMS_CODES.put(lastCodeKey, Date.now().toString(), {
      expirationTtl: 60
    })

    let response = Response.json({
      success: true,
      message: '验证码已发送',
      expiryMinutes: 5
    })
    return setCorsHeaders(request, response)

  } catch (error) {
    console.error('发送验证码失败:', error)
    let response = Response.json({
      success: false,
      message: error.message || '发送失败，请稍后重试'
    }, { status: 500 })
    return setCorsHeaders(request, response)
  }
}

/**
 * 处理验证码验证请求
 */
async function handleVerifyCode(request, env) {
  try {
    const { phone, code } = await request.json()

    // 验证参数
    if (!phone || typeof phone !== 'string') {
      return Response.json({ success: false, message: '手机号不能为空' }, { status: 400 })
    }

    if (!code || typeof code !== 'string') {
      return Response.json({ success: false, message: '验证码不能为空' }, { status: 400 })
    }

    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(phone)) {
      return Response.json({ success: false, message: '手机号格式不正确' }, { status: 400 })
    }

    // 从 KV 获取验证码
    const codeKey = `sms:${phone}:code`
    const storedData = await env.SMS_CODES.get(codeKey)

    if (!storedData) {
      return Response.json({ success: false, message: '验证码错误或已过期' }, { status: 400 })
    }

    const { code: storedCode, expiryTime } = JSON.parse(storedData)

    // 检查是否过期
    if (Date.now() > expiryTime) {
      await env.SMS_CODES.delete(codeKey)
      return Response.json({ success: false, message: '验证码已过期' }, { status: 400 })
    }

    // 验证码是否正确
    if (code !== storedCode) {
      return Response.json({ success: false, message: '验证码错误' }, { status: 400 })
    }

    // 验证成功，删除验证码
    await env.SMS_CODES.delete(codeKey)

    // 返回成功
    let response = Response.json({
      success: true,
      message: '验证成功',
      phone: phone
    })
    return setCorsHeaders(request, response)

  } catch (error) {
    console.error('验证验证码失败:', error)
    let response = Response.json({
      success: false,
      message: error.message || '验证失败，请重试'
    }, { status: 500 })
    return setCorsHeaders(request, response)
  }
}

/**
 * 主处理函数
 */
export default {
  async fetch(request, env, ctx) {
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return handleOptions(request)
    }

    const url = new URL(request.url)

    // 路由: /api/sms/send - 发送验证码
    if (url.pathname === '/api/sms/send' && request.method === 'POST') {
      return handleSendCode(request, env)
    }

    // 路由: /api/sms/verify - 验证验证码
    if (url.pathname === '/api/sms/verify' && request.method === 'POST') {
      return handleVerifyCode(request, env)
    }

    // 404
    let response = Response.json({ error: 'Not found' }, { status: 404 })
    return setCorsHeaders(request, response)
  }
}
