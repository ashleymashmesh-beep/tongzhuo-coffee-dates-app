// src/index.js
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/health") {
      return new Response(JSON.stringify({ status: "ok", message: "Worker is running" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400"
        }
      });
    }
    if (path === "/api/sms/send" && request.method === "POST") {
      try {
        const { email } = await request.json();
        const code = Math.floor(1e5 + Math.random() * 9e5).toString();
        console.log("\u9A8C\u8BC1\u7801:", code, "\u90AE\u7BB1:", email);
        return new Response(JSON.stringify({
          success: true,
          message: "\u9A8C\u8BC1\u7801\u5DF2\u53D1\u9001",
          code
          // 仅用于测试
        }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          message: error.message
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    }
    return new Response(JSON.stringify({ success: false, message: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
