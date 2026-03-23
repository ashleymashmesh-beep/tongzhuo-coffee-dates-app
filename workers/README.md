# 同桌 - Cloudflare Workers API

## 部署步骤

### 1. 创建 D1 数据库

```bash
# 进入 workers 目录
cd workers

# 创建 D1 数据库
wrangler d1 create tongzhuo-db
```

复制输出的 `database_id`，更新 `wrangler.toml` 中的 `database_id`。

### 2. 初始化数据库表结构

```bash
# 执行 schema.sql 创建表
wrangler d1 execute tongzhuo-db --file=./schema.sql
```

### 3. 创建 R2 存储桶（用于图片上传）

```bash
wrangler r2 bucket create tongzhuo-images
```

### 4. 部署 Worker

```bash
npm install
wrangler deploy
```

部署成功后会显示 Worker URL，格式如：
```
https://tongzhuo-api.xxx.workers.dev
```

## API 接口

### 验证码
- `POST /api/sms/send` - 发送邮箱验证码
- `POST /api/sms/verify` - 验证验证码并登录

### 用户
- `GET /api/users/:id` - 获取用户信息
- `PUT /api/users/:id` - 更新用户信息

### 活动
- `GET /api/events` - 获取活动列表
- `GET /api/events/:id` - 获取活动详情
- `POST /api/events` - 创建活动
- `PUT /api/events/:id` - 更新活动状态
- `GET /api/events/:id/signups` - 获取活动报名列表

### 报名
- `POST /api/signups` - 报名参加活动
- `DELETE /api/signups/:id` - 取消报名

### 打卡
- `GET /api/checkins` - 获取打卡列表
- `GET /api/checkins/:id` - 获取打卡详情
- `POST /api/checkins` - 创建打卡
- `DELETE /api/checkins/:id` - 删除打卡

### 相遇记录
- `GET /api/encounters` - 查询相遇记录
- `POST /api/encounters` - 创建相遇记录

### 评价
- `GET /api/reviews` - 获取评价列表
- `POST /api/reviews` - 创建评价

## 本地开发

```bash
# 启动本地开发服务器
wrangler dev

# 本地测试 D1 数据库
wrangler d1 execute tongzhuo-db --local --command="SELECT * FROM users"
```

## 数据库表结构

详见 `schema.sql` 文件。

### 主要表
- `users` - 用户表
- `events` - 活动表（约咖）
- `signups` - 报名表
- `encounters` - 相遇记录表
- `reviews` - 评价表
- `checkins` - 打卡表
- `sms_codes` - 验证码表
