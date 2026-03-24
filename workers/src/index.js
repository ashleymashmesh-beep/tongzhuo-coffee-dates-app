/**
 * 同桌 - Cloudflare Workers API
 * 使用 D1 数据库
 */

// 生成ID
function generateId() {
  return crypto.randomUUID()
}

// 生成6位随机验证码
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// CORS 响应头 - 允许所有来源
function addCorsHeaders(response) {
  const newResponse = new Response(response.body, response)
  newResponse.headers.set('Access-Control-Allow-Origin', '*')
  newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return newResponse
}

// 生成响应
function jsonResponse(data, status = 200) {
  return Response.json(data, { status })
}

// 错误响应
function errorResponse(message, status = 400) {
  return Response.json({ success: false, message }, { status })
}

// ==================== 验证码 API ====================

/**
 * 发送邮箱验证码
 * POST /api/sms/send
 * Body: { email: string }
 */
async function sendSmsCode(request, env) {
  try {
    const { email } = await request.json()

    console.log('[DEBUG] /api/sms/send 收到请求:', { email })

    if (!email || typeof email !== 'string') {
      return addCorsHeaders(errorResponse('邮箱不能为空'))
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return addCorsHeaders(errorResponse('邮箱格式不正确'))
    }

    // 检查是否频繁发送（60秒内）
    const oneMinuteAgo = Date.now() - 60000
    const recentCode = await env.DB.prepare(
      'SELECT created_at FROM sms_codes WHERE email = ? AND created_at > ? AND verified = 0 ORDER BY created_at DESC LIMIT 1'
    ).bind(email.toLowerCase(), oneMinuteAgo).first()

    if (recentCode) {
      return addCorsHeaders(errorResponse('发送太频繁，请稍后再试', 429))
    }

    // 生成验证码
    const verificationCode = generateCode()
    const expiry = Date.now() + 5 * 60 * 1000 // 5分钟

    console.log('[DEBUG] 验证码:', verificationCode, '邮箱:', email.toLowerCase(), '过期时间:', new Date(expiry).toISOString())

    // 调用 EmailJS API 发送邮件
    try {
      const emailjsBody = {
        service_id: 'service_vfamyld',
        template_id: 'template_5pxfw6n',
        user_id: 'Y8jcjpZJTGc3cRO_C',
        accessToken: env.EMAILJS_PRIVATE_KEY,
        template_params: {
          code: verificationCode,
          to_email: email
        }
      }

      console.log('[EmailJS] 发送请求体:', JSON.stringify({ ...emailjsBody, accessToken: '***' }))

      const emailjsResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailjsBody)
      })

      console.log('[EmailJS] 响应状态:', emailjsResponse.status, emailjsResponse.statusText)

      const responseText = await emailjsResponse.text()
      console.log('[EmailJS] 响应内容:', responseText)

      if (!emailjsResponse.ok) {
        console.error('[EmailJS] 发送失败:', emailjsResponse.status, responseText)
        // 返回详细的错误信息
        return addCorsHeaders(jsonResponse({
          success: false,
          message: `邮件发送失败: ${emailjsResponse.status}`,
          error: {
            status: emailjsResponse.status,
            statusText: emailjsResponse.statusText,
            body: responseText
          }
        }, 500))
      }

      console.log('[EmailJS] 邮件发送成功')
    } catch (emailjsError) {
      console.error('[EmailJS] 发送邮件出错:', emailjsError)
      // 返回详细的错误信息
      return addCorsHeaders(jsonResponse({
        success: false,
        message: '邮件发送失败，请稍后重试',
        error: {
          name: emailjsError.name,
          message: emailjsError.message
        }
      }, 500))
    }

    // 存储验证码
    const id = generateId()
    await env.DB.prepare(
      'INSERT INTO sms_codes (id, email, code, expiry, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, email.toLowerCase(), verificationCode, expiry, Date.now()).run()

    console.log('[DEBUG] 验证码已存入数据库, id:', id)

    return addCorsHeaders(jsonResponse({
      success: true,
      message: '验证码已发送',
      expiryMinutes: 5
    }))

  } catch (error) {
    console.error('发送验证码失败:', error)
    return addCorsHeaders(errorResponse('发送失败，请稍后重试', 500))
  }
}

/**
 * 验证邮箱验证码
 * POST /api/sms/verify
 * Body: { email: string, code: string }
 */
async function verifySmsCode(request, env) {
  try {
    const { email, code } = await request.json()

    console.log('[DEBUG] /api/sms/verify 收到请求:', { email, code })

    if (!email || !code) {
      return addCorsHeaders(errorResponse('邮箱和验证码不能为空'))
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return addCorsHeaders(errorResponse('邮箱格式不正确'))
    }

    const currentTime = Date.now()
    console.log('[DEBUG] 当前时间:', new Date(currentTime).toISOString())

    // 先查询所有该邮箱的验证码用于调试
    const allCodes = await env.DB.prepare(
      'SELECT * FROM sms_codes WHERE email = ? ORDER BY created_at DESC LIMIT 5'
    ).bind(email.toLowerCase()).all()

    console.log('[DEBUG] 数据库中该邮箱的验证码记录:', allCodes.results?.map(r => ({
      id: r.id,
      code: r.code,
      verified: r.verified,
      expiry: new Date(r.expiry).toISOString(),
      is_expired: r.expiry < currentTime
    })) || '无记录')

    // 查找验证码
    const record = await env.DB.prepare(
      'SELECT * FROM sms_codes WHERE email = ? AND code = ? AND verified = 0 AND expiry > ? ORDER BY created_at DESC LIMIT 1'
    ).bind(email.toLowerCase(), code, currentTime).first()

    console.log('[DEBUG] 匹配的验证码记录:', record || '无匹配记录')

    if (!record) {
      return addCorsHeaders(errorResponse('验证码错误或已过期'))
    }

    // 标记为已验证
    await env.DB.prepare(
      'UPDATE sms_codes SET verified = 1 WHERE id = ?'
    ).bind(record.id).run()

    console.log('[DEBUG] 验证码已标记为已验证')

    // 查找或创建用户
    const userResult = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first()

    let userData

    if (!userResult) {
      // 创建新用户
      const userId = generateId()
      const now = new Date().toISOString()
      await env.DB.prepare(
        'INSERT INTO users (id, email, created_at, last_login_at) VALUES (?, ?, ?, ?)'
      ).bind(userId, email.toLowerCase(), now, now).run()

      console.log('[DEBUG] 创建新用户:', userId)
      userData = { id: userId, email: email.toLowerCase() }
    } else {
      // 更新最后登录时间
      const now = new Date().toISOString()
      await env.DB.prepare(
        'UPDATE users SET last_login_at = ? WHERE id = ?'
      ).bind(now, userResult.id).run()

      console.log('[DEBUG] 更新用户登录时间:', userResult.id)
      userData = { id: userResult.id, email: userResult.email }
    }

    return addCorsHeaders(jsonResponse({
      success: true,
      message: '验证成功',
      data: { user: userData }
    }))

  } catch (error) {
    console.error('验证失败:', error)
    return addCorsHeaders(errorResponse('验证失败，请重试', 500))
  }
}

// ==================== 地点搜索 API ====================

/**
 * 搜索地点（咖啡馆）
 * GET /api/places/search?keyword=xxx
 */
async function searchPlaces(request, env) {
  try {
    const url = new URL(request.url)
    const keyword = url.searchParams.get('keyword') || '咖啡'

    if (!env.AMAP_KEY) {
      console.error('[AMAP] API Key 未配置')
      return addCorsHeaders(errorResponse('高德地图 API Key 未配置', 500))
    }

    console.log('[AMAP] 搜索地点:', { keyword })

    // 调用高德 POI 搜索 API - 不指定城市，搜索全国，types=050000 表示餐饮服务大类
    const amapUrl = `https://restapi.amap.com/v3/place/text?key=${env.AMAP_KEY}&keywords=${encodeURIComponent(keyword)}&types=050000&pageSize=20&page=1&extensions=all`

    console.log('[AMAP] 请求 URL:', amapUrl.replace(env.AMAP_KEY, '***'))

    const amapResponse = await fetch(amapUrl)
    const responseText = await amapResponse.text()

    console.log('[AMAP] 响应状态:', amapResponse.status)

    if (!amapResponse.ok) {
      console.error('[AMAP] HTTP 错误:', responseText)
      return addCorsHeaders(errorResponse('HTTP 请求失败', 500))
    }

    let amapData
    try {
      amapData = JSON.parse(responseText)
    } catch (e) {
      console.error('[AMAP] JSON 解析失败:', responseText)
      return addCorsHeaders(errorResponse('API 响应解析失败', 500))
    }

    console.log('[AMAP] 响应数据:', JSON.stringify(amapData))

    // 从 response.pois 读取结果
    if (amapData.status !== '1') {
      console.error('[AMAP] API 返回错误:', amapData.info, amapData.infocode)
      return addCorsHeaders(errorResponse('搜索失败: ' + (amapData.info || '未知错误'), 500))
    }

    const pois = amapData.pois || []
    console.log('[AMAP] POI 数量:', pois.length)

    // 标准化返回数据
    const places = pois.map(poi => ({
      id: poi.id,
      name: poi.name,
      address: poi.address || '',
      city: poi.cityname || '',
      location: poi.location ? {
        longitude: parseFloat(poi.location.split(',')[0]),
        latitude: parseFloat(poi.location.split(',')[1])
      } : null,
      tel: poi.tel || ''
    }))

    return addCorsHeaders(jsonResponse({
      success: true,
      data: places
    }))

  } catch (error) {
    console.error('[AMAP] 搜索地点失败:', error)
    return addCorsHeaders(errorResponse('搜索失败，请重试', 500))
  }
}

// ==================== 用户 API ====================

/**
 * 获取用户信息
 * GET /api/users/:id
 */
async function getUser(request, env, id) {
  try {
    const user = await env.DB.prepare(
      'SELECT id, email, nickname, avatar, bio, city, created_at FROM users WHERE id = ?'
    ).bind(id).first()

    if (!user) {
      return addCorsHeaders(errorResponse('用户不存在', 404))
    }

    return addCorsHeaders(jsonResponse({ success: true, data: user }))

  } catch (error) {
    console.error('获取用户失败:', error)
    return addCorsHeaders(errorResponse('获取失败', 500))
  }
}

/**
 * 更新用户信息
 * PUT /api/users/:id
 * Body: { nickname?, avatar?, bio?, city? }
 */
async function updateUser(request, env, id) {
  try {
    const data = await request.json()
    const { nickname, avatar, bio, city } = data

    // 构建更新语句
    const updates = []
    const values = []

    if (nickname !== undefined) {
      updates.push('nickname = ?')
      values.push(nickname)
    }
    if (avatar !== undefined) {
      updates.push('avatar = ?')
      values.push(avatar)
    }
    if (bio !== undefined) {
      updates.push('bio = ?')
      values.push(bio)
    }
    if (city !== undefined) {
      updates.push('city = ?')
      values.push(city)
    }

    if (updates.length === 0) {
      return addCorsHeaders(errorResponse('没有要更新的字段'))
    }

    values.push(id)
    await env.DB.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run()

    return addCorsHeaders(jsonResponse({ success: true, message: '更新成功' }))

  } catch (error) {
    console.error('更新用户失败:', error)
    return addCorsHeaders(errorResponse('更新失败', 500))
  }
}

// ==================== 活动 API ====================

/**
 * 创建活动
 * POST /api/events
 * Body: { creator_id, cafe_name, cafe_address, date, time_slot, activity_type, intro, max_people }
 */
async function createEvent(request, env) {
  try {
    const data = await request.json()
    const {
      creator_id, cafe_name, cafe_address, cafe_id,
      date, time_slot, specific_time, activity_type, intro, max_people
    } = data

    // 验证 max_people 只能是 2 或 3
    if (max_people !== 2 && max_people !== 3) {
      return addCorsHeaders(errorResponse('人数上限只能是 2 或 3'))
    }

    const id = generateId()
    const now = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO events (
        id, creator_id, cafe_name, cafe_address, cafe_id,
        date, time_slot, specific_time, activity_type, intro,
        max_people, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, creator_id, cafe_name, cafe_address, cafe_id,
      date, time_slot, specific_time, activity_type, intro,
      max_people, 'open', now
    ).run()

    // 创建者自动报名
    await env.DB.prepare(
      'INSERT INTO signups (id, event_id, user_id, created_at) VALUES (?, ?, ?, ?)'
    ).bind(generateId(), id, creator_id, now).run()

    return addCorsHeaders(jsonResponse({ success: true, data: { id } }))

  } catch (error) {
    console.error('创建活动失败:', error)
    return addCorsHeaders(errorResponse('创建失败', 500))
  }
}

/**
 * 获取活动列表
 * GET /api/events?status=open&date_from=...
 */
async function getEvents(request, env) {
  try {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') || 'open'
    const dateFrom = url.searchParams.get('date_from')

    let query = 'SELECT * FROM events WHERE status = ?'
    const params = [status]

    if (dateFrom) {
      query += ' AND date >= ?'
      params.push(dateFrom)
    }

    query += ' ORDER BY date ASC, created_at DESC'

    const result = await env.DB.prepare(query).bind(...params).all()

    return addCorsHeaders(jsonResponse({ success: true, data: result.results || [] }))

  } catch (error) {
    console.error('获取活动列表失败:', error)
    return addCorsHeaders(errorResponse('获取失败', 500))
  }
}

/**
 * 获取活动详情
 * GET /api/events/:id
 */
async function getEvent(request, env, id) {
  try {
    const event = await env.DB.prepare(
      'SELECT * FROM events WHERE id = ?'
    ).bind(id).first()

    if (!event) {
      return addCorsHeaders(errorResponse('活动不存在', 404))
    }

    // 获取报名人数
    const signupCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM signups WHERE event_id = ?'
    ).bind(id).first()

    return addCorsHeaders(jsonResponse({
      success: true,
      data: { ...event, signup_count: signupCount?.count || 0 }
    }))

  } catch (error) {
    console.error('获取活动失败:', error)
    return addCorsHeaders(errorResponse('获取失败', 500))
  }
}

/**
 * 更新活动状态
 * PUT /api/events/:id
 * Body: { status }
 */
async function updateEvent(request, env, id) {
  try {
    const { status } = await request.json()

    if (!['open', 'full', 'cancelled', 'done'].includes(status)) {
      return addCorsHeaders(errorResponse('无效的状态'))
    }

    await env.DB.prepare(
      'UPDATE events SET status = ? WHERE id = ?'
    ).bind(status, id).run()

    return addCorsHeaders(jsonResponse({ success: true, message: '更新成功' }))

  } catch (error) {
    console.error('更新活动失败:', error)
    return addCorsHeaders(errorResponse('更新失败', 500))
  }
}

/**
 * 获取活动的报名列表
 * GET /api/events/:id/signups
 */
async function getEventSignups(request, env, eventId) {
  try {
    const signups = await env.DB.prepare(`
      SELECT s.*, u.nickname, u.avatar
      FROM signups s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.event_id = ?
      ORDER BY s.created_at ASC
    `).bind(eventId).all()

    return addCorsHeaders(jsonResponse({ success: true, data: signups.results || [] }))

  } catch (error) {
    console.error('获取报名列表失败:', error)
    return addCorsHeaders(errorResponse('获取失败', 500))
  }
}

// ==================== 报名 API ====================

/**
 * 报名参加活动
 * POST /api/signups
 * Body: { event_id, user_id }
 */
async function createSignup(request, env) {
  try {
    const { event_id, user_id } = await request.json()

    // 检查活动是否存在
    const event = await env.DB.prepare(
      'SELECT max_people, status FROM events WHERE id = ?'
    ).bind(event_id).first()

    if (!event) {
      return addCorsHeaders(errorResponse('活动不存在', 404))
    }

    if (event.status !== 'open') {
      return addCorsHeaders(errorResponse('活动已关闭'))
    }

    // 检查是否已报名
    const existing = await env.DB.prepare(
      'SELECT * FROM signups WHERE event_id = ? AND user_id = ?'
    ).bind(event_id, user_id).first()

    if (existing) {
      return addCorsHeaders(errorResponse('已报名'))
    }

    // 检查人数限制
    const signupCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM signups WHERE event_id = ?'
    ).bind(event_id).first()

    if ((signupCount?.count || 0) >= event.max_people) {
      return addCorsHeaders(errorResponse('活动已满'))
    }

    // 创建报名
    await env.DB.prepare(
      'INSERT INTO signups (id, event_id, user_id, created_at) VALUES (?, ?, ?, ?)'
    ).bind(generateId(), event_id, user_id, new Date().toISOString()).run()

    // 检查是否满了，满了就更新状态
    if ((signupCount?.count || 0) + 1 >= event.max_people) {
      await env.DB.prepare(
        'UPDATE events SET status = ? WHERE id = ?'
      ).bind('full', event_id).run()
    }

    return addCorsHeaders(jsonResponse({ success: true, message: '报名成功' }))

  } catch (error) {
    console.error('报名失败:', error)
    return addCorsHeaders(errorResponse('报名失败', 500))
  }
}

/**
 * 取消报名
 * DELETE /api/signups/:id
 */
async function deleteSignup(request, env, id) {
  try {
    await env.DB.prepare(
      'DELETE FROM signups WHERE id = ?'
    ).bind(id).run()

    return addCorsHeaders(jsonResponse({ success: true, message: '取消成功' }))

  } catch (error) {
    console.error('取消报名失败:', error)
    return addCorsHeaders(errorResponse('取消失败', 500))
  }
}

// ==================== 打卡 API ====================

/**
 * 创建打卡
 * POST /api/checkins
 * Body: { user_id, photo_url, cafe_name, mood_score, note, date }
 */
async function createCheckin(request, env) {
  try {
    const data = await request.json()
    const { user_id, photo_url, cafe_name, mood_score, note, date } = data

    const id = generateId()
    const now = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO checkins (id, user_id, photo_url, cafe_name, mood_score, note, date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, user_id, photo_url, cafe_name, mood_score, note, date, now).run()

    return addCorsHeaders(jsonResponse({ success: true, data: { id } }))

  } catch (error) {
    console.error('创建打卡失败:', error)
    return addCorsHeaders(errorResponse('创建失败', 500))
  }
}

/**
 * 获取用户的打卡列表
 * GET /api/checkins?user_id=xxx&year=2024&month=1
 */
async function getCheckins(request, env) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('user_id')
    const year = url.searchParams.get('year')
    const month = url.searchParams.get('month')

    if (!userId) {
      return addCorsHeaders(errorResponse('缺少 user_id 参数'))
    }

    let query = 'SELECT * FROM checkins WHERE user_id = ?'
    const params = [userId]

    if (year && month) {
      const startDate = `${year}-${month.padStart(2, '0')}-01`
      const endDate = month === '12'
        ? `${parseInt(year) + 1}-01-01`
        : `${year}-${(parseInt(month) + 1).toString().padStart(2, '0')}-01`
      query += ' AND date >= ? AND date < ?'
      params.push(startDate, endDate)
    }

    query += ' ORDER BY date DESC'

    const result = await env.DB.prepare(query).bind(...params).all()

    return addCorsHeaders(jsonResponse({ success: true, data: result.results || [] }))

  } catch (error) {
    console.error('获取打卡列表失败:', error)
    return addCorsHeaders(errorResponse('获取失败', 500))
  }
}

/**
 * 获取打卡详情
 * GET /api/checkins/:id
 */
async function getCheckin(request, env, id) {
  try {
    const checkin = await env.DB.prepare(
      'SELECT * FROM checkins WHERE id = ?'
    ).bind(id).first()

    if (!checkin) {
      return addCorsHeaders(errorResponse('打卡不存在', 404))
    }

    return addCorsHeaders(jsonResponse({ success: true, data: checkin }))

  } catch (error) {
    console.error('获取打卡失败:', error)
    return addCorsHeaders(errorResponse('获取失败', 500))
  }
}

/**
 * 删除打卡
 * DELETE /api/checkins/:id
 */
async function deleteCheckin(request, env, id) {
  try {
    await env.DB.prepare(
      'DELETE FROM checkins WHERE id = ?'
    ).bind(id).run()

    return addCorsHeaders(jsonResponse({ success: true, message: '删除成功' }))

  } catch (error) {
    console.error('删除打卡失败:', error)
    return addCorsHeaders(errorResponse('删除失败', 500))
  }
}

// ==================== 相遇记录 API ====================

/**
 * 创建相遇记录
 * POST /api/encounters
 * Body: { user_id_1, user_id_2, event_id, date }
 */
async function createEncounter(request, env) {
  try {
    const data = await request.json()
    const { user_id_1, user_id_2, event_id, date } = data

    // 确保user_id_1 < user_id_2，避免重复
    const ids = [user_id_1, user_id_2].sort()

    const id = generateId()
    const now = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO encounters (id, user_id_1, user_id_2, event_id, date, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, ids[0], ids[1], event_id, date, now).run()

    return addCorsHeaders(jsonResponse({ success: true, data: { id } }))

  } catch (error) {
    console.error('创建相遇记录失败:', error)
    return addCorsHeaders(errorResponse('创建失败', 500))
  }
}

/**
 * 查询两个用户的相遇次数
 * GET /api/encounters?user_id_1=xxx&user_id_2=xxx
 */
async function getEncounters(request, env) {
  try {
    const url = new URL(request.url)
    const userId1 = url.searchParams.get('user_id_1')
    const userId2 = url.searchParams.get('user_id_2')

    if (!userId1 || !userId2) {
      return addCorsHeaders(errorResponse('缺少 user_id 参数'))
    }

    // 确保顺序一致
    const ids = [userId1, userId2].sort()

    const result = await env.DB.prepare(`
      SELECT * FROM encounters
      WHERE user_id_1 = ? AND user_id_2 = ?
      ORDER BY date DESC
    `).bind(ids[0], ids[1]).all()

    return addCorsHeaders(jsonResponse({ success: true, data: result.results || [] }))

  } catch (error) {
    console.error('获取相遇记录失败:', error)
    return addCorsHeaders(errorResponse('获取失败', 500))
  }
}

// ==================== 评价 API ====================

/**
 * 创建评价
 * POST /api/reviews
 * Body: { from_user_id, to_user_id, event_id, rating, comment }
 */
async function createReview(request, env) {
  try {
    const data = await request.json()
    const { from_user_id, to_user_id, event_id, rating, comment } = data

    if (rating < 1 || rating > 5) {
      return addCorsHeaders(errorResponse('评分必须在1-5之间'))
    }

    const id = generateId()
    const now = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO reviews (id, from_user_id, to_user_id, event_id, rating, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, from_user_id, to_user_id, event_id, rating, comment, now).run()

    return addCorsHeaders(jsonResponse({ success: true, data: { id } }))

  } catch (error) {
    console.error('创建评价失败:', error)
    return addCorsHeaders(errorResponse('创建失败', 500))
  }
}

/**
 * 获取用户收到的评价
 * GET /api/reviews?to_user_id=xxx
 */
async function getReviews(request, env) {
  try {
    const url = new URL(request.url)
    const toUserId = url.searchParams.get('to_user_id')

    if (!toUserId) {
      return addCorsHeaders(errorResponse('缺少 to_user_id 参数'))
    }

    const reviews = await env.DB.prepare(`
      SELECT r.*, u.nickname as from_nickname, u.avatar as from_avatar
      FROM reviews r
      LEFT JOIN users u ON r.from_user_id = u.id
      WHERE r.to_user_id = ?
      ORDER BY r.created_at DESC
    `).bind(toUserId).all()

    return addCorsHeaders(jsonResponse({ success: true, data: reviews.results || [] }))

  } catch (error) {
    console.error('获取评价失败:', error)
    return addCorsHeaders(errorResponse('获取失败', 500))
  }
}

// ==================== 主路由 ====================

export default {
  async fetch(request, env, ctx) {
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return addCorsHeaders(new Response(null, { status: 204 }))
    }

    const url = new URL(request.url)
    const path = url.pathname

    // 健康检查
    if (path === '/health') {
      return addCorsHeaders(new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' }
      }))
    }

    // 验证码 API
    if (path === '/api/sms/send' && request.method === 'POST') {
      return sendSmsCode(request, env)
    }
    if (path === '/api/sms/verify' && request.method === 'POST') {
      return verifySmsCode(request, env)
    }

    // 地点搜索 API
    if (path === '/api/places/search' && request.method === 'GET') {
      return searchPlaces(request, env)
    }

    // 用户 API
    const userMatch = path.match(/^\/api\/users\/([^/]+)$/)
    if (userMatch) {
      if (request.method === 'GET') return getUser(request, env, userMatch[1])
      if (request.method === 'PUT') return updateUser(request, env, userMatch[1])
    }

    // 活动 API
    if (path === '/api/events') {
      if (request.method === 'GET') return getEvents(request, env)
      if (request.method === 'POST') return createEvent(request, env)
    }

    const eventMatch = path.match(/^\/api\/events\/([^/]+)$/)
    if (eventMatch) {
      if (request.method === 'GET') return getEvent(request, env, eventMatch[1])
      if (request.method === 'PUT') return updateEvent(request, env, eventMatch[1])
    }

    const eventSignupsMatch = path.match(/^\/api\/events\/([^/]+)\/signups$/)
    if (eventSignupsMatch && request.method === 'GET') {
      return getEventSignups(request, env, eventSignupsMatch[1])
    }

    // 报名 API
    if (path === '/api/signups' && request.method === 'POST') {
      return createSignup(request, env)
    }

    const signupMatch = path.match(/^\/api\/signups\/([^/]+)$/)
    if (signupMatch && request.method === 'DELETE') {
      return deleteSignup(request, env, signupMatch[1])
    }

    // 打卡 API
    if (path === '/api/checkins') {
      if (request.method === 'GET') return getCheckins(request, env)
      if (request.method === 'POST') return createCheckin(request, env)
    }

    const checkinMatch = path.match(/^\/api\/checkins\/([^/]+)$/)
    if (checkinMatch) {
      if (request.method === 'GET') return getCheckin(request, env, checkinMatch[1])
      if (request.method === 'DELETE') return deleteCheckin(request, env, checkinMatch[1])
    }

    // 相遇记录 API
    if (path === '/api/encounters') {
      if (request.method === 'GET') return getEncounters(request, env)
      if (request.method === 'POST') return createEncounter(request, env)
    }

    // 评价 API
    if (path === '/api/reviews') {
      if (request.method === 'GET') return getReviews(request, env)
      if (request.method === 'POST') return createReview(request, env)
    }

    // 404
    return addCorsHeaders(errorResponse('Not found', 404))
  }
}
