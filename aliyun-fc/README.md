# 阿里云短信验证码服务 - 部署指南

## 前置准备

### 1. 开通阿里云服务
- [ ] 短信服务：https://dysms.console.aliyun.com/
- [ ] 函数计算 FC：https://fc.console.aliyun.com/
- [ ] （可选）云数据库 Redis 版：https://rds.console.aliyun.com/

### 2. 配置短信服务
1. **添加签名**
   - 进入短信服务控制台 → 国内消息 → 签名管理
   - 添加签名，如：「同桌」
   - 等待审核（通常1-2小时）

2. **添加模板**
   - 进入国内消息 → 模板管理
   - 添加模板，内容如：`您的验证码是${code}，5分钟内有效。`
   - 模板类型：验证码
   - 等待审核

3. **获取 AccessKey**
   - 点击右上角头像 → AccessKey 管理
   - 创建 AccessKey
   - 保存 AccessKey ID 和 AccessKey Secret

## 部署步骤

### 方式一：通过控制台部署（推荐新手）

1. **进入函数计算控制台**
   https://fc.console.aliyun.com/

2. **创建服务**
   - 点击「创建服务」
   - 服务名称：`tongzhuo-service`
   - 描述：同桌应用后端服务
   - 点击「创建」

3. **创建函数**
   - 进入服务 → 点击「创建函数」
   - 选择「使用内置运行时创建」
   - 函数名称：`send-sms`
   - 请求处理程序：`index.handler`
   - 运行环境：`Node.js 18`
   - 函数代码：在线编辑

4. **粘贴代码**
   - 将 `aliyun-fc/send-sms/index.js` 的内容粘贴到编辑器
   - 点击「保存」

5. **配置环境变量**
   - 点击「配置」→ 环境变量
   - 添加以下变量：

   | 变量名 | 值 | 说明 |
   |--------|-----|------|
   | ACCESS_KEY_ID | 你的 AccessKey ID | 阿里云密钥 ID |
   | ACCESS_KEY_SECRET | 你的 AccessKey Secret | 阿里云密钥 Secret |
   | SIGN_NAME | 你的短信签名 | 如：同桌 |
   | TEMPLATE_CODE | 你的模板代码 | 如：SMS_123456789 |

6. **安装依赖**
   - 在代码编辑器中找到「依赖管理」或「package.json」
   - 添加依赖：
   ```json
   {
     "dependencies": {
       "@alicloud/dysmsapi20170525": "^3.0.0",
       "@alicloud/openapi-client": "^0.4.6"
     }
   }
   ```
   - 点击「部署」

7. **配置 HTTP 触发器**
   - 点击「触发器管理」→「创建触发器」
   - 触发器类型：HTTP 触发器
   - 触发器名称：http-trigger
   - 认证方式：anonymous（匿名访问）
   - 请求方式：POST
   - 路径：`/sms`
   - 点击「确定」

8. **获取函数 URL**
   - 在函数详情页，找到「公共请求头」或「访问 URL」
   - 记下这个 URL，格式如：`https://xxx.cn-shanghai.fc.aliyuncs.com/sms`

### 方式二：通过阿里云 CLI 部署

1. **安装阿里云 CLI**
   ```bash
   # macOS/Linux
   curl https://aliyuncli.alicdn.com/aliyun-cli-linux-latest-amd64.tgz | tar zxf -
   sudo mv aliyun /usr/local/bin/

   # Windows
   # 下载：https://aliyuncli.alicdn.com/aliyun-cli-setup-windows.exe
   ```

2. **配置凭证**
   ```bash
   aliyun configure
   ```

3. **部署函数**
   ```bash
   cd aliyun-fc/send-sms
   aliyun fc deploy --template-file template.yml
   ```

## 测试接口

### 发送验证码
```bash
curl -X POST https://your-fc-url/sms \
  -H "Content-Type: application/json" \
  -d '{
    "action": "send",
    "phone": "13800138000"
  }'
```

### 验证登录
```bash
curl -X POST https://your-fc-url/sms \
  -H "Content-Type: application/json" \
  -d '{
    "action": "verify",
    "phone": "13800138000",
    "code": "123456"
  }'
```

## 费用说明

| 服务 | 计费方式 | 预估费用 |
|------|----------|----------|
| 短信服务 | 按条计费 | 约 ¥0.045/条 |
| 函数计算 | 按调用次数+执行时间 | 免费额度：100万次/月 |
| Redis（可选） | 按规格计费 | 小规格约 ¥20/月 |

## 安全建议

1. **不要在前端直接调用短信接口**
   - 函数计算 URL 应该保密
   - 可以添加签名验证

2. **限制请求频率**
   - 代码中已实现 60 秒限制
   - 可以在函数计算中配置流控

3. **生产环境建议**
   - 使用 Redis 存储验证码（支持多实例）
   - 使用 JWT 替代简单 token
   - 添加日志和监控
