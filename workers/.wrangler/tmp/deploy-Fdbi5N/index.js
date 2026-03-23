var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
function generateId() {
  return crypto.randomUUID();
}
__name(generateId, "generateId");
function generateCode() {
  return Math.floor(1e5 + Math.random() * 9e5).toString();
}
__name(generateCode, "generateCode");
function addCorsHeaders(response) {
  const newResponse = new Response(response.body, response);
  newResponse.headers.set("Access-Control-Allow-Origin", "*");
  newResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  newResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return newResponse;
}
__name(addCorsHeaders, "addCorsHeaders");
function jsonResponse(data, status = 200) {
  return Response.json(data, { status });
}
__name(jsonResponse, "jsonResponse");
function errorResponse(message, status = 400) {
  return Response.json({ success: false, message }, { status });
}
__name(errorResponse, "errorResponse");
async function sendSmsCode(request, env) {
  try {
    const { email, code } = await request.json();
    console.log("[DEBUG] /api/sms/send \u6536\u5230\u8BF7\u6C42:", { email, code });
    if (!email || typeof email !== "string") {
      return addCorsHeaders(errorResponse("\u90AE\u7BB1\u4E0D\u80FD\u4E3A\u7A7A"));
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return addCorsHeaders(errorResponse("\u90AE\u7BB1\u683C\u5F0F\u4E0D\u6B63\u786E"));
    }
    const verificationCode = code || generateCode();
    const expiry = Date.now() + 5 * 60 * 1e3;
    console.log("[DEBUG] \u9A8C\u8BC1\u7801:", verificationCode, "\u90AE\u7BB1:", email.toLowerCase(), "\u8FC7\u671F\u65F6\u95F4:", new Date(expiry).toISOString());
    const id = generateId();
    await env.DB.prepare(
      "INSERT INTO sms_codes (id, email, code, expiry, created_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, email.toLowerCase(), verificationCode, expiry, Date.now()).run();
    console.log("[DEBUG] \u9A8C\u8BC1\u7801\u5DF2\u5B58\u5165\u6570\u636E\u5E93, id:", id);
    return addCorsHeaders(jsonResponse({
      success: true,
      message: "\u9A8C\u8BC1\u7801\u5DF2\u53D1\u9001",
      code: verificationCode,
      // 返回验证码供前端使用（如果前端没传的话）
      expiryMinutes: 5
    }));
  } catch (error) {
    console.error("\u53D1\u9001\u9A8C\u8BC1\u7801\u5931\u8D25:", error);
    return addCorsHeaders(errorResponse("\u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5", 500));
  }
}
__name(sendSmsCode, "sendSmsCode");
async function verifySmsCode(request, env) {
  try {
    const { email, code } = await request.json();
    console.log("[DEBUG] /api/sms/verify \u6536\u5230\u8BF7\u6C42:", { email, code });
    if (!email || !code) {
      return addCorsHeaders(errorResponse("\u90AE\u7BB1\u548C\u9A8C\u8BC1\u7801\u4E0D\u80FD\u4E3A\u7A7A"));
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return addCorsHeaders(errorResponse("\u90AE\u7BB1\u683C\u5F0F\u4E0D\u6B63\u786E"));
    }
    const currentTime = Date.now();
    console.log("[DEBUG] \u5F53\u524D\u65F6\u95F4:", new Date(currentTime).toISOString());
    const allCodes = await env.DB.prepare(
      "SELECT * FROM sms_codes WHERE email = ? ORDER BY created_at DESC LIMIT 5"
    ).bind(email.toLowerCase()).all();
    console.log("[DEBUG] \u6570\u636E\u5E93\u4E2D\u8BE5\u90AE\u7BB1\u7684\u9A8C\u8BC1\u7801\u8BB0\u5F55:", allCodes.results?.map((r) => ({
      id: r.id,
      code: r.code,
      verified: r.verified,
      expiry: new Date(r.expiry).toISOString(),
      is_expired: r.expiry < currentTime
    })) || "\u65E0\u8BB0\u5F55");
    const record = await env.DB.prepare(
      "SELECT * FROM sms_codes WHERE email = ? AND code = ? AND verified = 0 AND expiry > ? ORDER BY created_at DESC LIMIT 1"
    ).bind(email.toLowerCase(), code, currentTime).first();
    console.log("[DEBUG] \u5339\u914D\u7684\u9A8C\u8BC1\u7801\u8BB0\u5F55:", record || "\u65E0\u5339\u914D\u8BB0\u5F55");
    if (!record) {
      return addCorsHeaders(errorResponse("\u9A8C\u8BC1\u7801\u9519\u8BEF\u6216\u5DF2\u8FC7\u671F"));
    }
    await env.DB.prepare(
      "UPDATE sms_codes SET verified = 1 WHERE id = ?"
    ).bind(record.id).run();
    console.log("[DEBUG] \u9A8C\u8BC1\u7801\u5DF2\u6807\u8BB0\u4E3A\u5DF2\u9A8C\u8BC1");
    const userResult = await env.DB.prepare(
      "SELECT * FROM users WHERE email = ?"
    ).bind(email.toLowerCase()).first();
    let userData;
    if (!userResult) {
      const userId = generateId();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await env.DB.prepare(
        "INSERT INTO users (id, email, created_at, last_login_at) VALUES (?, ?, ?, ?)"
      ).bind(userId, email.toLowerCase(), now, now).run();
      console.log("[DEBUG] \u521B\u5EFA\u65B0\u7528\u6237:", userId);
      userData = { id: userId, email: email.toLowerCase() };
    } else {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await env.DB.prepare(
        "UPDATE users SET last_login_at = ? WHERE id = ?"
      ).bind(now, userResult.id).run();
      console.log("[DEBUG] \u66F4\u65B0\u7528\u6237\u767B\u5F55\u65F6\u95F4:", userResult.id);
      userData = { id: userResult.id, email: userResult.email };
    }
    return addCorsHeaders(jsonResponse({
      success: true,
      message: "\u9A8C\u8BC1\u6210\u529F",
      user: userData
    }));
  } catch (error) {
    console.error("\u9A8C\u8BC1\u5931\u8D25:", error);
    return addCorsHeaders(errorResponse("\u9A8C\u8BC1\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5", 500));
  }
}
__name(verifySmsCode, "verifySmsCode");
async function getUser(request, env, id) {
  try {
    const user = await env.DB.prepare(
      "SELECT id, email, nickname, avatar, bio, city, created_at FROM users WHERE id = ?"
    ).bind(id).first();
    if (!user) {
      return addCorsHeaders(errorResponse("\u7528\u6237\u4E0D\u5B58\u5728", 404));
    }
    return addCorsHeaders(jsonResponse({ success: true, data: user }));
  } catch (error) {
    console.error("\u83B7\u53D6\u7528\u6237\u5931\u8D25:", error);
    return addCorsHeaders(errorResponse("\u83B7\u53D6\u5931\u8D25", 500));
  }
}
__name(getUser, "getUser");
async function updateUser(request, env, id) {
  try {
    const data = await request.json();
    const { nickname, avatar, bio, city } = data;
    const updates = [];
    const values = [];
    if (nickname !== void 0) {
      updates.push("nickname = ?");
      values.push(nickname);
    }
    if (avatar !== void 0) {
      updates.push("avatar = ?");
      values.push(avatar);
    }
    if (bio !== void 0) {
      updates.push("bio = ?");
      values.push(bio);
    }
    if (city !== void 0) {
      updates.push("city = ?");
      values.push(city);
    }
    if (updates.length === 0) {
      return addCorsHeaders(errorResponse("\u6CA1\u6709\u8981\u66F4\u65B0\u7684\u5B57\u6BB5"));
    }
    values.push(id);
    await env.DB.prepare(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`
    ).bind(...values).run();
    return addCorsHeaders(jsonResponse({ success: true, message: "\u66F4\u65B0\u6210\u529F" }));
  } catch (error) {
    console.error("\u66F4\u65B0\u7528\u6237\u5931\u8D25:", error);
    return addCorsHeaders(errorResponse("\u66F4\u65B0\u5931\u8D25", 500));
  }
}
__name(updateUser, "updateUser");
async function createEvent(request, env) {
  try {
    const data = await request.json();
    const {
      creator_id,
      cafe_name,
      cafe_address,
      cafe_id,
      date,
      time_slot,
      specific_time,
      activity_type,
      intro,
      max_people
    } = data;
    if (max_people !== 2 && max_people !== 3) {
      return addCorsHeaders(errorResponse("\u4EBA\u6570\u4E0A\u9650\u53EA\u80FD\u662F 2 \u6216 3"));
    }
    const id = generateId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await env.DB.prepare(`
      INSERT INTO events (
        id, creator_id, cafe_name, cafe_address, cafe_id,
        date, time_slot, specific_time, activity_type, intro,
        max_people, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      creator_id,
      cafe_name,
      cafe_address,
      cafe_id,
      date,
      time_slot,
      specific_time,
      activity_type,
      intro,
      max_people,
      "open",
      now
    ).run();
    await env.DB.prepare(
      "INSERT INTO signups (id, event_id, user_id, created_at) VALUES (?, ?, ?, ?)"
    ).bind(generateId(), id, creator_id, now).run();
    return addCorsHeaders(jsonResponse({ success: true, data: { id } }));
  } catch (error) {
    console.error("\u521B\u5EFA\u6D3B\u52A8\u5931\u8D25:", error);
    return addCorsHeaders(errorResponse("\u521B\u5EFA\u5931\u8D25", 500));
  }
}
__name(createEvent, "createEvent");
async function getEvents(request, env) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "open";
    const dateFrom = url.searchParams.get("date_from");
    let query = "SELECT * FROM events WHERE status = ?";
    const params = [status];
    if (dateFrom) {
      query += " AND date >= ?";
      params.push(dateFrom);
    }
    query += " ORDER BY date ASC, created_at DESC";
    const result = await env.DB.prepare(query).bind(...params).all();
    return addCorsHeaders(jsonResponse({ success: true, data: result.results || [] }));
  } catch (error) {
    console.error("\u83B7\u53D6\u6D3B\u52A8\u5217\u8868\u5931\u8D25:", error);
    return addCorsHeaders(errorResponse("\u83B7\u53D6\u5931\u8D25", 500));
  }
}
__name(getEvents, "getEvents");
async function getEvent(request, env, id) {
  try {
    const event = await env.DB.prepare(
      "SELECT * FROM events WHERE id = ?"
    ).bind(id).first();
    if (!event) {
      return addCorsHeaders(errorResponse("\u6D3B\u52A8\u4E0D\u5B58\u5728", 404));
    }
    const signupCount = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM signups WHERE event_id = ?"
    ).bind(id).first();
    return addCorsHeaders(jsonResponse({
      success: true,
      data: { ...event, signup_count: signupCount?.count || 0 }
    }));
  } catch (error) {
    console.error("\u83B7\u53D6\u6D3B\u52A8\u5931\u8D25:", error);
    return addCorsHeaders(errorResponse("\u83B7\u53D6\u5931\u8D25", 500));
  }
}
__name(getEvent, "getEvent");
async function updateEvent(request, env, id) {
  try {
    const { status } = await request.json();
    if (!["open", "full", "cancelled", "done"].includes(status)) {
      return addCorsHeaders(errorResponse("\u65E0\u6548\u7684\u72B6\u6001"));
    }
    await env.DB.prepare(
      "UPDATE events SET status = ? WHERE id = ?"
    ).bind(status, id).run();
    return addCorsHeaders(jsonResponse({ success: true, message: "\u66F4\u65B0\u6210\u529F" }));
  } catch (error) {
    console.error("\u66F4\u65B0\u6D3B\u52A8\u5931\u8D25:", error);
    return addCorsHeaders(errorResponse("\u66F4\u65B0\u5931\u8D25", 500));
  }
}
__name(updateEvent, "updateEvent");
async function getEventSignups(request, env, eventId) {
  try {
    const signups = await env.DB.prepare(`
      SELECT s.*, u.nickname, u.avatar
      FROM signups s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.event_id = ?
      ORDER BY s.created_at ASC
    `).bind(eventId).all();
    return addCorsHeaders(jsonResponse({ success: true, data: signups.results || [] }));
  } catch (error) {
    console.error("\u83B7\u53D6\u62A5\u540D\u5217\u8868\u5931\u8D25:", error);
    return addCorsHeaders(errorResponse("\u83B7\u53D6\u5931\u8D25", 500));
  }
}
__name(getEventSignups, "getEventSignups");
async function createSignup(request, env) {
  try {
    const { event_id, user_id } = await request.json();
    const event = await env.DB.prepare(
      "SELECT max_people, status FROM events WHERE id = ?"
    ).bind(event_id).first();
    if (!event) {
      return addCorsHeaders(errorResponse("\u6D3B\u52A8\u4E0D\u5B58\u5728", 404));
    }
    if (event.status !== "open") {
      return addCorsHeaders(errorResponse("\u6D3B\u52A8\u5DF2\u5173\u95ED"));
    }
    const existing = await env.DB.prepare(
      "SELECT * FROM signups WHERE event_id = ? AND user_id = ?"
    ).bind(event_id, user_id).first();
    if (existing) {
      return addCorsHeaders(errorResponse("\u5DF2\u62A5\u540D"));
    }
    const signupCount = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM signups WHERE event_id = ?"
    ).bind(event_id).first();
    if ((signupCount?.count || 0) >= event.max_people) {
      return addCorsHeaders(errorResponse("\u6D3B\u52A8\u5DF2\u6EE1"));
    }
    await env.DB.prepare(
      "INSERT INTO signups (id, event_id, user_id, created_at) VALUES (?, ?, ?, ?)"
    ).bind(generateId(), event_id, user_id, (/* @__PURE__ */ new Date()).toISOString()).run();
    if ((signupCount?.count || 0) + 1 >= event.max_people) {
      await env.DB.prepare(
        "UPDATE events SET status = ? WHERE id = ?"
      ).bind("full", event_id).run();
    }
    return addCorsHeaders(jsonResponse({ success: true, message: "\u62A5\u540D\u6210\u529F" }));
  } catch (error) {
    console.error("\u62A5\u540D\u5931\u8D25:", error);
    return addCorsHeaders(errorResponse("\u62A5\u540D\u5931\u8D25", 500));
  }
}
__name(createSignup, "createSignup");
async function deleteSignup(request, env, id) {
  try {
    await env.DB.prepare(
      "DELETE FROM signups WHERE id = ?"
    ).bind(id).run();
    return addCorsHeaders(jsonResponse({ success: true, message: "\u53D6\u6D88\u6210\u529F" }));
  } catch (error) {
    console.error("\u53D6\u6D88\u62A5\u540D\u5931\u8D25:", error);
    return addCorsHeaders(errorResponse("\u53D6\u6D88\u5931\u8D25", 500));
  }
}
__name(deleteSignup, "deleteSignup");
async function createCheckin(request, env) {
  try {
    const data = await request.json();
    const { user_id, photo_url, cafe_name, mood_score, note, date } = data;
    const id = generateId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await env.DB.prepare(`
      INSERT INTO checkins (id, user_id, photo_url, cafe_name, mood_score, note, date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, user_id, photo_url, cafe_name, mood_score, note, date, now).run();
    return addCorsHeaders(jsonResponse({ success: true, data: { id } }));
  } catch (error) {
    console.error("\u521B\u5EFA\u6253\u5361\u5931\u8D25:", error);
    return addCorsHeaders(errorResponse("\u521B\u5EFA\u5931\u8D25", 500));
  }
}
__name(createCheckin, "createCheckin");
async function getCheckins(request, env) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("user_id");
    const year = url.searchParams.get("year");
    const month = url.searchParams.get("month");
    if (!userId) {
      return addCorsHeaders(errorResponse("\u7F3A\u5C11 user_id \u53C2\u6570"));
    }
    let query = "SELECT * FROM checkins WHERE user_id = ?";
    const params = [userId];
    if (year && month) {
      const startDate = `${year}-${month.padStart(2, "0")}-01`;
      const endDate = month === "12" ? `${parseInt(year) + 1}-01-01` : `${year}-${(parseInt(month) + 1).toString().padStart(2, "0")}-01`;
      query += " AND date >= ? AND date < ?";
      params.push(startDate, endDate);
    }
    query += " ORDER BY date DESC";
    const result = await env.DB.prepare(query).bind(...params).all();
    return addCorsHeaders(jsonResponse({ success: true, data: result.results || [] }));
  } catch (error) {
    console.error("\u83B7\u53D6\u6253\u5361\u5217\u8868\u5931\u8D25:", error);
    return addCorsHeaders(errorResponse("\u83B7\u53D6\u5931\u8D25", 500));
  }
}
__name(getCheckins, "getCheckins");
async function getCheckin(request, env, id) {
  try {
    const checkin = await env.DB.prepare(
      "SELECT * FROM checkins WHERE id = ?"
    ).bind(id).first();
    if (!checkin) {
      return addCorsHeaders(errorResponse("\u6253\u5361\u4E0D\u5B58\u5728", 404));
    }
    return addCorsHeaders(jsonResponse({ success: true, data: checkin }));
  } catch (error) {
    console.error("\u83B7\u53D6\u6253\u5361\u5931\u8D25:", error);
    return addCorsHeaders(errorResponse("\u83B7\u53D6\u5931\u8D25", 500));
  }
}
__name(getCheckin, "getCheckin");
async function deleteCheckin(request, env, id) {
  try {
    await env.DB.prepare(
      "DELETE FROM checkins WHERE id = ?"
    ).bind(id).run();
    return addCorsHeaders(jsonResponse({ success: true, message: "\u5220\u9664\u6210\u529F" }));
  } catch (error) {
    console.error("\u5220\u9664\u6253\u5361\u5931\u8D25:", error);
    return addCorsHeaders(errorResponse("\u5220\u9664\u5931\u8D25", 500));
  }
}
__name(deleteCheckin, "deleteCheckin");
async function createEncounter(request, env) {
  try {
    const data = await request.json();
    const { user_id_1, user_id_2, event_id, date } = data;
    const ids = [user_id_1, user_id_2].sort();
    const id = generateId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await env.DB.prepare(`
      INSERT INTO encounters (id, user_id_1, user_id_2, event_id, date, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, ids[0], ids[1], event_id, date, now).run();
    return addCorsHeaders(jsonResponse({ success: true, data: { id } }));
  } catch (error) {
    console.error("\u521B\u5EFA\u76F8\u9047\u8BB0\u5F55\u5931\u8D25:", error);
    return addCorsHeaders(errorResponse("\u521B\u5EFA\u5931\u8D25", 500));
  }
}
__name(createEncounter, "createEncounter");
async function getEncounters(request, env) {
  try {
    const url = new URL(request.url);
    const userId1 = url.searchParams.get("user_id_1");
    const userId2 = url.searchParams.get("user_id_2");
    if (!userId1 || !userId2) {
      return addCorsHeaders(errorResponse("\u7F3A\u5C11 user_id \u53C2\u6570"));
    }
    const ids = [userId1, userId2].sort();
    const result = await env.DB.prepare(`
      SELECT * FROM encounters
      WHERE user_id_1 = ? AND user_id_2 = ?
      ORDER BY date DESC
    `).bind(ids[0], ids[1]).all();
    return addCorsHeaders(jsonResponse({ success: true, data: result.results || [] }));
  } catch (error) {
    console.error("\u83B7\u53D6\u76F8\u9047\u8BB0\u5F55\u5931\u8D25:", error);
    return addCorsHeaders(errorResponse("\u83B7\u53D6\u5931\u8D25", 500));
  }
}
__name(getEncounters, "getEncounters");
async function createReview(request, env) {
  try {
    const data = await request.json();
    const { from_user_id, to_user_id, event_id, rating, comment } = data;
    if (rating < 1 || rating > 5) {
      return addCorsHeaders(errorResponse("\u8BC4\u5206\u5FC5\u987B\u57281-5\u4E4B\u95F4"));
    }
    const id = generateId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await env.DB.prepare(`
      INSERT INTO reviews (id, from_user_id, to_user_id, event_id, rating, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, from_user_id, to_user_id, event_id, rating, comment, now).run();
    return addCorsHeaders(jsonResponse({ success: true, data: { id } }));
  } catch (error) {
    console.error("\u521B\u5EFA\u8BC4\u4EF7\u5931\u8D25:", error);
    return addCorsHeaders(errorResponse("\u521B\u5EFA\u5931\u8D25", 500));
  }
}
__name(createReview, "createReview");
async function getReviews(request, env) {
  try {
    const url = new URL(request.url);
    const toUserId = url.searchParams.get("to_user_id");
    if (!toUserId) {
      return addCorsHeaders(errorResponse("\u7F3A\u5C11 to_user_id \u53C2\u6570"));
    }
    const reviews = await env.DB.prepare(`
      SELECT r.*, u.nickname as from_nickname, u.avatar as from_avatar
      FROM reviews r
      LEFT JOIN users u ON r.from_user_id = u.id
      WHERE r.to_user_id = ?
      ORDER BY r.created_at DESC
    `).bind(toUserId).all();
    return addCorsHeaders(jsonResponse({ success: true, data: reviews.results || [] }));
  } catch (error) {
    console.error("\u83B7\u53D6\u8BC4\u4EF7\u5931\u8D25:", error);
    return addCorsHeaders(errorResponse("\u83B7\u53D6\u5931\u8D25", 500));
  }
}
__name(getReviews, "getReviews");
var index_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return addCorsHeaders(new Response(null, { status: 204 }));
    }
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/health") {
      return addCorsHeaders(new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" }
      }));
    }
    if (path === "/api/sms/send" && request.method === "POST") {
      return sendSmsCode(request, env);
    }
    if (path === "/api/sms/verify" && request.method === "POST") {
      return verifySmsCode(request, env);
    }
    const userMatch = path.match(/^\/api\/users\/([^/]+)$/);
    if (userMatch) {
      if (request.method === "GET") return getUser(request, env, userMatch[1]);
      if (request.method === "PUT") return updateUser(request, env, userMatch[1]);
    }
    if (path === "/api/events") {
      if (request.method === "GET") return getEvents(request, env);
      if (request.method === "POST") return createEvent(request, env);
    }
    const eventMatch = path.match(/^\/api\/events\/([^/]+)$/);
    if (eventMatch) {
      if (request.method === "GET") return getEvent(request, env, eventMatch[1]);
      if (request.method === "PUT") return updateEvent(request, env, eventMatch[1]);
    }
    const eventSignupsMatch = path.match(/^\/api\/events\/([^/]+)\/signups$/);
    if (eventSignupsMatch && request.method === "GET") {
      return getEventSignups(request, env, eventSignupsMatch[1]);
    }
    if (path === "/api/signups" && request.method === "POST") {
      return createSignup(request, env);
    }
    const signupMatch = path.match(/^\/api\/signups\/([^/]+)$/);
    if (signupMatch && request.method === "DELETE") {
      return deleteSignup(request, env, signupMatch[1]);
    }
    if (path === "/api/checkins") {
      if (request.method === "GET") return getCheckins(request, env);
      if (request.method === "POST") return createCheckin(request, env);
    }
    const checkinMatch = path.match(/^\/api\/checkins\/([^/]+)$/);
    if (checkinMatch) {
      if (request.method === "GET") return getCheckin(request, env, checkinMatch[1]);
      if (request.method === "DELETE") return deleteCheckin(request, env, checkinMatch[1]);
    }
    if (path === "/api/encounters") {
      if (request.method === "GET") return getEncounters(request, env);
      if (request.method === "POST") return createEncounter(request, env);
    }
    if (path === "/api/reviews") {
      if (request.method === "GET") return getReviews(request, env);
      if (request.method === "POST") return createReview(request, env);
    }
    return addCorsHeaders(errorResponse("Not found", 404));
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
