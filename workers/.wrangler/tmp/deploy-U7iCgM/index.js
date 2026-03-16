var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var YUNTONGXUN_SERVER = "app.cloopen.com";
var YUNTONGXUN_PORT = "8883";
var YUNTONGXUN_VERSION = "2013-12-26";
var CODE_EXPIRY_SECONDS = 300;
function setCorsHeaders(request, response) {
  const origins = (env.ALLOWED_ORIGINS || "").split(",");
  const origin = request.headers.get("Origin");
  if (origin && origins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}
__name(setCorsHeaders, "setCorsHeaders");
function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(handleOptions, "handleOptions");
function generateCode() {
  return Math.floor(1e5 + Math.random() * 9e5).toString();
}
__name(generateCode, "generateCode");
function getExpiryTimestamp() {
  return Date.now() + CODE_EXPIRY_SECONDS * 1e3;
}
__name(getExpiryTimestamp, "getExpiryTimestamp");
function base64Encode(str) {
  return btoa(str);
}
__name(base64Encode, "base64Encode");
async function md5(str) {
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("MD5", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}
__name(md5, "md5");
async function sendYuntongxunSms(phone, code, env2) {
  const accountSid = env2.YUNTONGXUN_ACCOUNT_SID;
  const accountToken = env2.YUNTONGXUN_ACCOUNT_TOKEN;
  const appId = env2.YUNTONGXUN_APP_ID;
  if (!accountSid || !accountToken || !appId) {
    throw new Error("\u5BB9\u8054\u4E91\u914D\u7F6E\u672A\u8BBE\u7F6E\uFF0C\u8BF7\u5728 Workers \u8BBE\u7F6E\u73AF\u5883\u53D8\u91CF");
  }
  const timestamp = Date.now().toString();
  const now = /* @__PURE__ */ new Date();
  const date = now.toISOString().split("T")[0].replace(/-/g, "");
  const sig = accountSid + accountToken + timestamp;
  const sigEncoded = await md5(sig);
  const auth = base64Encode(accountSid + ":" + timestamp);
  const url = `https://${YUNTONGXUN_SERVER}:${YUNTONGXUN_PORT}/${YUNTONGXUN_VERSION}/Accounts/${accountSid}/SMS/TemplateSMS?sig=${sigEncoded}`;
  const body = {
    to: phone,
    appId,
    templateId: "1",
    // 请在容联云后台创建短信模板并使用对应的模板ID
    datas: [code, "5"]
    // 模板参数：验证码，有效期（分钟）
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json;charset=utf-8",
      "Authorization": auth
    },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (result.statusCode === "000000") {
    console.log("\u77ED\u4FE1\u53D1\u9001\u6210\u529F:", { phone, code });
    return true;
  } else {
    console.error("\u77ED\u4FE1\u53D1\u9001\u5931\u8D25:", result);
    throw new Error(`\u77ED\u4FE1\u53D1\u9001\u5931\u8D25: ${result.statusMsg}`);
  }
}
__name(sendYuntongxunSms, "sendYuntongxunSms");
async function handleSendCode(request, env2) {
  try {
    const { phone } = await request.json();
    if (!phone || typeof phone !== "string") {
      return Response.json({ success: false, message: "\u624B\u673A\u53F7\u4E0D\u80FD\u4E3A\u7A7A" }, { status: 400 });
    }
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return Response.json({ success: false, message: "\u624B\u673A\u53F7\u683C\u5F0F\u4E0D\u6B63\u786E" }, { status: 400 });
    }
    const lastCodeKey = `sms:${phone}:last`;
    const lastSent = await env2.SMS_CODES.get(lastCodeKey);
    if (lastSent) {
      const lastSentTime = parseInt(lastSent);
      if (Date.now() - lastSentTime < 6e4) {
        return Response.json({ success: false, message: "\u53D1\u9001\u592A\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" }, { status: 429 });
      }
    }
    const code = generateCode();
    const expiryTime = getExpiryTimestamp();
    await sendYuntongxunSms(phone, code, env2);
    const codeKey = `sms:${phone}:code`;
    await env2.SMS_CODES.put(codeKey, JSON.stringify({
      code,
      expiryTime,
      createdAt: Date.now()
    }), {
      expirationTtl: CODE_EXPIRY_SECONDS
    });
    await env2.SMS_CODES.put(lastCodeKey, Date.now().toString(), {
      expirationTtl: 60
    });
    let response = Response.json({
      success: true,
      message: "\u9A8C\u8BC1\u7801\u5DF2\u53D1\u9001",
      expiryMinutes: 5
    });
    return setCorsHeaders(request, response);
  } catch (error) {
    console.error("\u53D1\u9001\u9A8C\u8BC1\u7801\u5931\u8D25:", error);
    let response = Response.json({
      success: false,
      message: error.message || "\u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"
    }, { status: 500 });
    return setCorsHeaders(request, response);
  }
}
__name(handleSendCode, "handleSendCode");
async function handleVerifyCode(request, env2) {
  try {
    const { phone, code } = await request.json();
    if (!phone || typeof phone !== "string") {
      return Response.json({ success: false, message: "\u624B\u673A\u53F7\u4E0D\u80FD\u4E3A\u7A7A" }, { status: 400 });
    }
    if (!code || typeof code !== "string") {
      return Response.json({ success: false, message: "\u9A8C\u8BC1\u7801\u4E0D\u80FD\u4E3A\u7A7A" }, { status: 400 });
    }
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return Response.json({ success: false, message: "\u624B\u673A\u53F7\u683C\u5F0F\u4E0D\u6B63\u786E" }, { status: 400 });
    }
    const codeKey = `sms:${phone}:code`;
    const storedData = await env2.SMS_CODES.get(codeKey);
    if (!storedData) {
      return Response.json({ success: false, message: "\u9A8C\u8BC1\u7801\u9519\u8BEF\u6216\u5DF2\u8FC7\u671F" }, { status: 400 });
    }
    const { code: storedCode, expiryTime } = JSON.parse(storedData);
    if (Date.now() > expiryTime) {
      await env2.SMS_CODES.delete(codeKey);
      return Response.json({ success: false, message: "\u9A8C\u8BC1\u7801\u5DF2\u8FC7\u671F" }, { status: 400 });
    }
    if (code !== storedCode) {
      return Response.json({ success: false, message: "\u9A8C\u8BC1\u7801\u9519\u8BEF" }, { status: 400 });
    }
    await env2.SMS_CODES.delete(codeKey);
    let response = Response.json({
      success: true,
      message: "\u9A8C\u8BC1\u6210\u529F",
      phone
    });
    return setCorsHeaders(request, response);
  } catch (error) {
    console.error("\u9A8C\u8BC1\u9A8C\u8BC1\u7801\u5931\u8D25:", error);
    let response = Response.json({
      success: false,
      message: error.message || "\u9A8C\u8BC1\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5"
    }, { status: 500 });
    return setCorsHeaders(request, response);
  }
}
__name(handleVerifyCode, "handleVerifyCode");
var index_default = {
  async fetch(request, env2, ctx) {
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }
    const url = new URL(request.url);
    if (url.pathname === "/api/sms/send" && request.method === "POST") {
      return handleSendCode(request, env2);
    }
    if (url.pathname === "/api/sms/verify" && request.method === "POST") {
      return handleVerifyCode(request, env2);
    }
    let response = Response.json({ error: "Not found" }, { status: 404 });
    return setCorsHeaders(request, response);
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
