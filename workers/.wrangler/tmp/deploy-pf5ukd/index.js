var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
function generateId() {
  return crypto.randomUUID();
}
__name(generateId, "generateId");
function setCorsHeaders(request, response, env) {
  const origins = (env?.ALLOWED_ORIGINS || "").split(",");
  const origin = request.headers.get("Origin");
  if (origin && origins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}
__name(setCorsHeaders, "setCorsHeaders");
function handleOptions(request) {
  const response = new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    }
  });
  return setCorsHeaders(request, response, { ALLOWED_ORIGINS: "" });
}
__name(handleOptions, "handleOptions");
function generateCode() {
  return Math.floor(1e5 + Math.random() * 9e5).toString();
}
__name(generateCode, "generateCode");
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
    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      let response2 = errorResponse("\u90AE\u7BB1\u4E0D\u80FD\u4E3A\u7A7A");
      return setCorsHeaders(request, response2, env);
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      let response2 = errorResponse("\u90AE\u7BB1\u683C\u5F0F\u4E0D\u6B63\u786E");
      return setCorsHeaders(request, response2, env);
    }
    const oneMinuteAgo = Date.now() - 6e4;
    const recentCode = await env.DB.prepare(
      "SELECT created_at FROM sms_codes WHERE email = ? AND created_at > ? AND verified = 0 ORDER BY created_at DESC LIMIT 1"
    ).bind(email.toLowerCase(), oneMinuteAgo).first();
    if (recentCode) {
      let response2 = errorResponse("\u53D1\u9001\u592A\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5", 429);
      return setCorsHeaders(request, response2, env);
    }
    const code = generateCode();
    const expiry = Date.now() + 5 * 60 * 1e3;
    console.log("\u9A8C\u8BC1\u7801:", code, "\u90AE\u7BB1:", email.toLowerCase());
    const id = generateId();
    await env.DB.prepare(
      "INSERT INTO sms_codes (id, email, code, expiry, created_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, email.toLowerCase(), code, expiry, Date.now()).run();
    let response = jsonResponse({
      success: true,
      message: "\u9A8C\u8BC1\u7801\u5DF2\u53D1\u9001",
      expiryMinutes: 5
    });
    return setCorsHeaders(request, response, env);
  } catch (error) {
    console.error("\u53D1\u9001\u9A8C\u8BC1\u7801\u5931\u8D25:", error);
    let response = errorResponse("\u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5", 500);
    return setCorsHeaders(request, response, env);
  }
}
__name(sendSmsCode, "sendSmsCode");
async function verifySmsCode(request, env) {
  try {
    const { email, code } = await request.json();
    if (!email || !code) {
      let response2 = errorResponse("\u90AE\u7BB1\u548C\u9A8C\u8BC1\u7801\u4E0D\u80FD\u4E3A\u7A7A");
      return setCorsHeaders(request, response2, env);
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      let response2 = errorResponse("\u90AE\u7BB1\u683C\u5F0F\u4E0D\u6B63\u786E");
      return setCorsHeaders(request, response2, env);
    }
    const record = await env.DB.prepare(
      "SELECT * FROM sms_codes WHERE email = ? AND code = ? AND verified = 0 AND expiry > ? ORDER BY created_at DESC LIMIT 1"
    ).bind(email.toLowerCase(), code, Date.now()).first();
    if (!record) {
      let response2 = errorResponse("\u9A8C\u8BC1\u7801\u9519\u8BEF\u6216\u5DF2\u8FC7\u671F");
      return setCorsHeaders(request, response2, env);
    }
    await env.DB.prepare(
      "UPDATE sms_codes SET verified = 1 WHERE id = ?"
    ).bind(record.id).run();
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
      userData = { id: userId, email: email.toLowerCase() };
    } else {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await env.DB.prepare(
        "UPDATE users SET last_login_at = ? WHERE id = ?"
      ).bind(now, userResult.id).run();
      userData = { id: userResult.id, email: userResult.email };
    }
    let response = jsonResponse({
      success: true,
      message: "\u9A8C\u8BC1\u6210\u529F",
      user: userData
    });
    return setCorsHeaders(request, response, env);
  } catch (error) {
    console.error("\u9A8C\u8BC1\u5931\u8D25:", error);
    let response = errorResponse("\u9A8C\u8BC1\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5", 500);
    return setCorsHeaders(request, response, env);
  }
}
__name(verifySmsCode, "verifySmsCode");
async function getUser(request, env, id) {
  try {
    const user = await env.DB.prepare(
      "SELECT id, email, nickname, avatar, bio, city, created_at FROM users WHERE id = ?"
    ).bind(id).first();
    if (!user) {
      let response2 = errorResponse("\u7528\u6237\u4E0D\u5B58\u5728", 404);
      return setCorsHeaders(request, response2, env);
    }
    let response = jsonResponse({ success: true, data: user });
    return setCorsHeaders(request, response, env);
  } catch (error) {
    console.error("\u83B7\u53D6\u7528\u6237\u5931\u8D25:", error);
    let response = errorResponse("\u83B7\u53D6\u5931\u8D25", 500);
    return setCorsHeaders(request, response, env);
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
      let response2 = errorResponse("\u6CA1\u6709\u8981\u66F4\u65B0\u7684\u5B57\u6BB5");
      return setCorsHeaders(request, response2, env);
    }
    values.push(id);
    await env.DB.prepare(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`
    ).bind(...values).run();
    let response = jsonResponse({ success: true, message: "\u66F4\u65B0\u6210\u529F" });
    return setCorsHeaders(request, response, env);
  } catch (error) {
    console.error("\u66F4\u65B0\u7528\u6237\u5931\u8D25:", error);
    let response = errorResponse("\u66F4\u65B0\u5931\u8D25", 500);
    return setCorsHeaders(request, response, env);
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
      let response2 = errorResponse("\u4EBA\u6570\u4E0A\u9650\u53EA\u80FD\u662F 2 \u6216 3");
      return setCorsHeaders(request, response2, env);
    }
    const id = generateId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await env.DB.prepare(`
      INSERT INTO events (
        id, creator_id, cafe_name, cafe_address, cafe_id,
        date, time_slot, specific_time, activity_type, intro,
        max_people, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    let response = jsonResponse({ success: true, data: { id } });
    return setCorsHeaders(request, response, env);
  } catch (error) {
    console.error("\u521B\u5EFA\u6D3B\u52A8\u5931\u8D25:", error);
    let response = errorResponse("\u521B\u5EFA\u5931\u8D25", 500);
    return setCorsHeaders(request, response, env);
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
    let response = jsonResponse({ success: true, data: result.results || [] });
    return setCorsHeaders(request, response, env);
  } catch (error) {
    console.error("\u83B7\u53D6\u6D3B\u52A8\u5217\u8868\u5931\u8D25:", error);
    let response = errorResponse("\u83B7\u53D6\u5931\u8D25", 500);
    return setCorsHeaders(request, response, env);
  }
}
__name(getEvents, "getEvents");
async function getEvent(request, env, id) {
  try {
    const event = await env.DB.prepare(
      "SELECT * FROM events WHERE id = ?"
    ).bind(id).first();
    if (!event) {
      let response2 = errorResponse("\u6D3B\u52A8\u4E0D\u5B58\u5728", 404);
      return setCorsHeaders(request, response2, env);
    }
    const signupCount = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM signups WHERE event_id = ?"
    ).bind(id).first();
    let response = jsonResponse({
      success: true,
      data: { ...event, signup_count: signupCount.count }
    });
    return setCorsHeaders(request, response, env);
  } catch (error) {
    console.error("\u83B7\u53D6\u6D3B\u52A8\u5931\u8D25:", error);
    let response = errorResponse("\u83B7\u53D6\u5931\u8D25", 500);
    return setCorsHeaders(request, response, env);
  }
}
__name(getEvent, "getEvent");
async function updateEvent(request, env, id) {
  try {
    const { status } = await request.json();
    if (!["open", "full", "cancelled", "done"].includes(status)) {
      let response2 = errorResponse("\u65E0\u6548\u7684\u72B6\u6001");
      return setCorsHeaders(request, response2, env);
    }
    await env.DB.prepare(
      "UPDATE events SET status = ? WHERE id = ?"
    ).bind(status, id).run();
    let response = jsonResponse({ success: true, message: "\u66F4\u65B0\u6210\u529F" });
    return setCorsHeaders(request, response, env);
  } catch (error) {
    console.error("\u66F4\u65B0\u6D3B\u52A8\u5931\u8D25:", error);
    let response = errorResponse("\u66F4\u65B0\u5931\u8D25", 500);
    return setCorsHeaders(request, response, env);
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
    let response = jsonResponse({ success: true, data: signups.results || [] });
    return setCorsHeaders(request, response, env);
  } catch (error) {
    console.error("\u83B7\u53D6\u62A5\u540D\u5217\u8868\u5931\u8D25:", error);
    let response = errorResponse("\u83B7\u53D6\u5931\u8D25", 500);
    return setCorsHeaders(request, response, env);
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
      let response2 = errorResponse("\u6D3B\u52A8\u4E0D\u5B58\u5728", 404);
      return setCorsHeaders(request, response2, env);
    }
    if (event.status !== "open") {
      let response2 = errorResponse("\u6D3B\u52A8\u5DF2\u5173\u95ED");
      return setCorsHeaders(request, response2, env);
    }
    const existing = await env.DB.prepare(
      "SELECT * FROM signups WHERE event_id = ? AND user_id = ?"
    ).bind(event_id, user_id).first();
    if (existing) {
      let response2 = errorResponse("\u5DF2\u62A5\u540D");
      return setCorsHeaders(request, response2, env);
    }
    const signupCount = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM signups WHERE event_id = ?"
    ).bind(event_id).first();
    if (signupCount.count >= event.max_people) {
      let response2 = errorResponse("\u6D3B\u52A8\u5DF2\u6EE1");
      return setCorsHeaders(request, response2, env);
    }
    await env.DB.prepare(
      "INSERT INTO signups (id, event_id, user_id, created_at) VALUES (?, ?, ?, ?)"
    ).bind(generateId(), event_id, user_id, (/* @__PURE__ */ new Date()).toISOString()).run();
    if (signupCount.count + 1 >= event.max_people) {
      await env.DB.prepare(
        "UPDATE events SET status = ? WHERE id = ?"
      ).bind("full", event_id).run();
    }
    let response = jsonResponse({ success: true, message: "\u62A5\u540D\u6210\u529F" });
    return setCorsHeaders(request, response, env);
  } catch (error) {
    console.error("\u62A5\u540D\u5931\u8D25:", error);
    let response = errorResponse("\u62A5\u540D\u5931\u8D25", 500);
    return setCorsHeaders(request, response, env);
  }
}
__name(createSignup, "createSignup");
async function deleteSignup(request, env, id) {
  try {
    await env.DB.prepare(
      "DELETE FROM signups WHERE id = ?"
    ).bind(id).run();
    let response = jsonResponse({ success: true, message: "\u53D6\u6D88\u6210\u529F" });
    return setCorsHeaders(request, response, env);
  } catch (error) {
    console.error("\u53D6\u6D88\u62A5\u540D\u5931\u8D25:", error);
    let response = errorResponse("\u53D6\u6D88\u5931\u8D25", 500);
    return setCorsHeaders(request, response, env);
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
    let response = jsonResponse({ success: true, data: { id } });
    return setCorsHeaders(request, response, env);
  } catch (error) {
    console.error("\u521B\u5EFA\u6253\u5361\u5931\u8D25:", error);
    let response = errorResponse("\u521B\u5EFA\u5931\u8D25", 500);
    return setCorsHeaders(request, response, env);
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
      let response2 = errorResponse("\u7F3A\u5C11 user_id \u53C2\u6570");
      return setCorsHeaders(request, response2, env);
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
    let response = jsonResponse({ success: true, data: result.results || [] });
    return setCorsHeaders(request, response);
  } catch (error) {
    console.error("\u83B7\u53D6\u6253\u5361\u5217\u8868\u5931\u8D25:", error);
    let response = errorResponse("\u83B7\u53D6\u5931\u8D25", 500);
    return setCorsHeaders(request, response);
  }
}
__name(getCheckins, "getCheckins");
async function getCheckin(request, env, id) {
  try {
    const checkin = await env.DB.prepare(
      "SELECT * FROM checkins WHERE id = ?"
    ).bind(id).first();
    if (!checkin) {
      let response2 = errorResponse("\u6253\u5361\u4E0D\u5B58\u5728", 404);
      return setCorsHeaders(request, response2, env);
    }
    let response = jsonResponse({ success: true, data: checkin });
    return setCorsHeaders(request, response, env);
  } catch (error) {
    console.error("\u83B7\u53D6\u6253\u5361\u5931\u8D25:", error);
    let response = errorResponse("\u83B7\u53D6\u5931\u8D25", 500);
    return setCorsHeaders(request, response, env);
  }
}
__name(getCheckin, "getCheckin");
async function deleteCheckin(request, env, id) {
  try {
    await env.DB.prepare(
      "DELETE FROM checkins WHERE id = ?"
    ).bind(id).run();
    let response = jsonResponse({ success: true, message: "\u5220\u9664\u6210\u529F" });
    return setCorsHeaders(request, response, env);
  } catch (error) {
    console.error("\u5220\u9664\u6253\u5361\u5931\u8D25:", error);
    let response = errorResponse("\u5220\u9664\u5931\u8D25", 500);
    return setCorsHeaders(request, response, env);
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
    let response = jsonResponse({ success: true, data: { id } });
    return setCorsHeaders(request, response);
  } catch (error) {
    console.error("\u521B\u5EFA\u76F8\u9047\u8BB0\u5F55\u5931\u8D25:", error);
    let response = errorResponse("\u521B\u5EFA\u5931\u8D25", 500);
    return setCorsHeaders(request, response);
  }
}
__name(createEncounter, "createEncounter");
async function getEncounters(request, env) {
  try {
    const url = new URL(request.url);
    const userId1 = url.searchParams.get("user_id_1");
    const userId2 = url.searchParams.get("user_id_2");
    if (!userId1 || !userId2) {
      let response2 = errorResponse("\u7F3A\u5C11 user_id \u53C2\u6570");
      return setCorsHeaders(request, response2, env);
    }
    const ids = [userId1, userId2].sort();
    const result = await env.DB.prepare(`
      SELECT * FROM encounters
      WHERE user_id_1 = ? AND user_id_2 = ?
      ORDER BY date DESC
    `).bind(ids[0], ids[1]).all();
    let response = jsonResponse({ success: true, data: result.results || [] });
    return setCorsHeaders(request, response);
  } catch (error) {
    console.error("\u83B7\u53D6\u76F8\u9047\u8BB0\u5F55\u5931\u8D25:", error);
    let response = errorResponse("\u83B7\u53D6\u5931\u8D25", 500);
    return setCorsHeaders(request, response);
  }
}
__name(getEncounters, "getEncounters");
async function createReview(request, env) {
  try {
    const data = await request.json();
    const { from_user_id, to_user_id, event_id, rating, comment } = data;
    if (rating < 1 || rating > 5) {
      let response2 = errorResponse("\u8BC4\u5206\u5FC5\u987B\u57281-5\u4E4B\u95F4");
      return setCorsHeaders(request, response2, env);
    }
    const id = generateId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await env.DB.prepare(`
      INSERT INTO reviews (id, from_user_id, to_user_id, event_id, rating, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, from_user_id, to_user_id, event_id, rating, comment, now).run();
    let response = jsonResponse({ success: true, data: { id } });
    return setCorsHeaders(request, response);
  } catch (error) {
    console.error("\u521B\u5EFA\u8BC4\u4EF7\u5931\u8D25:", error);
    let response = errorResponse("\u521B\u5EFA\u5931\u8D25", 500);
    return setCorsHeaders(request, response);
  }
}
__name(createReview, "createReview");
async function getReviews(request, env) {
  try {
    const url = new URL(request.url);
    const toUserId = url.searchParams.get("to_user_id");
    if (!toUserId) {
      let response2 = errorResponse("\u7F3A\u5C11 to_user_id \u53C2\u6570");
      return setCorsHeaders(request, response2, env);
    }
    const reviews = await env.DB.prepare(`
      SELECT r.*, u.nickname as from_nickname, u.avatar as from_avatar
      FROM reviews r
      LEFT JOIN users u ON r.from_user_id = u.id
      WHERE r.to_user_id = ?
      ORDER BY r.created_at DESC
    `).bind(toUserId).all();
    let response = jsonResponse({ success: true, data: reviews.results || [] });
    return setCorsHeaders(request, response);
  } catch (error) {
    console.error("\u83B7\u53D6\u8BC4\u4EF7\u5931\u8D25:", error);
    let response = errorResponse("\u83B7\u53D6\u5931\u8D25", 500);
    return setCorsHeaders(request, response);
  }
}
__name(getReviews, "getReviews");
var index_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/health" && request.method === "GET") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (path === "/api/sms/send" && request.method === "POST") {
      return sendSmsCode(request, env);
    }
    if (path === "/api/sms/verify" && request.method === "POST") {
      return verifySmsCode(request, env);
    }
    if (path.startsWith("/api/users/") && request.method === "GET") {
      const id = path.split("/")[3];
      return getUser(request, env, id);
    }
    if (path.startsWith("/api/users/") && request.method === "PUT") {
      const id = path.split("/")[3];
      return updateUser(request, env, id);
    }
    if (path === "/api/events" && request.method === "GET") {
      return getEvents(request, env);
    }
    if (path === "/api/events" && request.method === "POST") {
      return createEvent(request, env);
    }
    if (path.startsWith("/api/events/") && path.split("/").length === 4 && request.method === "GET") {
      const id = path.split("/")[3];
      return getEvent(request, env, id);
    }
    if (path.startsWith("/api/events/") && path.split("/").length === 4 && request.method === "PUT") {
      const id = path.split("/")[3];
      return updateEvent(request, env, id);
    }
    if (path.startsWith("/api/events/") && path.split("/").length === 5 && request.method === "GET") {
      const id = path.split("/")[3];
      return getEventSignups(request, env, id);
    }
    if (path === "/api/signups" && request.method === "POST") {
      return createSignup(request, env);
    }
    if (path.startsWith("/api/signups/") && path.split("/").length === 4 && request.method === "DELETE") {
      const id = path.split("/")[3];
      return deleteSignup(request, env, id);
    }
    if (path === "/api/checkins" && request.method === "GET") {
      return getCheckins(request, env);
    }
    if (path === "/api/checkins" && request.method === "POST") {
      return createCheckin(request, env);
    }
    if (path.startsWith("/api/checkins/") && path.split("/").length === 4 && request.method === "GET") {
      const id = path.split("/")[3];
      return getCheckin(request, env, id);
    }
    if (path.startsWith("/api/checkins/") && path.split("/").length === 4 && request.method === "DELETE") {
      const id = path.split("/")[3];
      return deleteCheckin(request, env, id);
    }
    if (path === "/api/encounters" && request.method === "GET") {
      return getEncounters(request, env);
    }
    if (path === "/api/encounters" && request.method === "POST") {
      return createEncounter(request, env);
    }
    if (path === "/api/reviews" && request.method === "GET") {
      return getReviews(request, env);
    }
    if (path === "/api/reviews" && request.method === "POST") {
      return createReview(request, env);
    }
    let response = errorResponse("Not found", 404);
    return setCorsHeaders(request, response, env);
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
