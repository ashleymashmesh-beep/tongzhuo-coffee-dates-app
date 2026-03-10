# 同桌 — CLAUDE.md

> 每次启动时请先完整读取这份文件，它是本项目的唯一上下文来源。
> 项目根目录有 tongzhuo-prototype.html，是设计原型文件，
> 所有页面的配色、字体、卡片样式、圆角、间距必须严格参考这个文件，
> 不要自己发明新的设计风格。

---

## 产品简介

**同桌**是一个面向线上办公人群的 Web App，核心功能是：
1. 提前预约约咖——发布约咖活动，找1-2个人一起在咖啡馆打工或玩
2. 咖啡打卡日历——拍照记录每天的咖啡，以月历形式展示

目标用户：灵活办公、经常在咖啡馆工作的人，渴望真实的小圈子连结，I 人友好。

---

## 核心价值观（每次写代码前都要记住）

**反愿景——绝对不做：**
- 不追求 DAU、不做推送轰炸、不做点赞数/关注数
- 不做广场式 feed，不制造 FOMO
- 不做快餐式一次性聚会功能
- 不帮用户规避摩擦，不做「相性指数」「最佳搭子」等游戏化评分

**正愿景：**
- 两三个人，提前约好，慢慢变成真朋友
- 摩擦和碰撞是连结的豁口，产品只帮人找到值得深入的人
- 小而真实，不热闹但温暖

**设计原则：**
- 人数上限是硬性规则：每次约咖最多 3 人，代码层面强制，不可绕过
- 多次相遇提示只对当事人可见，不公开展示
- 没有任何社交压力指标

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Vite |
| 样式 | Tailwind CSS，移动端优先 |
| 后端/数据库 | Firebase（Firestore + Storage + Auth） |
| 地图/搜索 | 高德地图 Web API（POI 搜索 + 定位） |
| 部署 | Vercel |

**重要：**
- 所有页面以手机浏览器为第一优先，不做桌面端布局
- API Key 全部存在 `.env` 环境变量，不能硬编码在任何文件里
- Firebase 配置放在 `src/lib/firebase.js`，从 `.env` 读取

---

## 项目结构

```
tongzhuo/
├── public/
├── src/
│   ├── lib/
│   │   ├── firebase.js        # Firebase 初始化
│   │   └── amap.js            # 高德 API 工具函数
│   ├── hooks/                 # 自定义 React hooks
│   ├── pages/
│   │   ├── Home.jsx           # 首页：约咖列表
│   │   ├── Publish.jsx        # 发布约咖
│   │   ├── CheckIn.jsx        # 打卡页面
│   │   ├── Calendar.jsx       # 月历视图
│   │   └── Profile.jsx        # 个人主页
│   ├── components/            # 可复用组件
│   └── App.jsx
├── .env                       # 环境变量（不提交到 git）
├── .env.example               # 环境变量模板（提交到 git）
├── CLAUDE.md                  # 本文件
└── PRD.md                     # 完整 PRD
```

---

## Firestore 数据结构

### `users` 集合
```
{
  id: string,           // Firebase Auth UID
  nickname: string,
  avatar: string,       // Storage URL
  bio: string,          // 不超过 50 字
  city: string,
  createdAt: timestamp
}
```

### `meetups` 集合（约咖活动）
```
{
  id: string,
  creatorId: string,
  cafeName: string,
  cafeAddress: string,
  cafeId: string,       // 高德 POI ID
  date: string,         // YYYY-MM-DD
  timeSlot: string,     // "morning" | "afternoon" | "evening"
  activityType: string, // "quiet" | "chat" | "craft" | "other"
  intro: string,        // 发布者一句话介绍，可选
  maxPeople: number,    // 只能是 2 或 3，硬性限制
  attendees: string[],  // 已报名用户 ID 数组
  status: string,       // "open" | "full" | "cancelled" | "done"
  createdAt: timestamp
}
```

### `checkins` 集合（打卡记录）
```
{
  id: string,
  userId: string,
  photoUrl: string,     // Firebase Storage URL
  cafeName: string,     // 可选
  moodScore: number,    // 1-5
  note: string,         // 小确幸文字，不超过 150 字，可选
  date: string,         // YYYY-MM-DD
  createdAt: timestamp
}
```

### `encounters` 集合（相遇记录）
```
{
  id: string,
  userIds: string[],    // 两个用户 ID，升序排列后存储（方便查询）
  meetupId: string,
  date: string,
  notified: boolean     // 是否已发送 3 次相遇提示
}
```

---

## 功能说明

### 功能一：发布约咖（最高优先级）

**流程：**
1. 选择日期和时段（上午/下午/傍晚）
2. 搜索附近咖啡馆（调用高德 POI API，自动定位）
3. 选择活动类型
4. 填写一句话介绍（可选）
5. 选择人数上限（2 或 3，仅这两个选项）
6. 发布

**报名流程：**
- 首页显示未来 7 天内 status 为 open 的活动
- 点击报名，attendees 数组加入当前用户 ID
- attendees.length >= maxPeople 时自动将 status 改为 full
- 不显示实时报名人数变化

**约束：**
- maxPeople 字段写入 Firestore 前必须校验只能是 2 或 3
- 同一用户不能报名自己发布的活动

---

### 功能二：照片打卡日历（最高优先级）

**打卡：**
- 调起手机相机或相册（input type="file" accept="image/*" capture="environment"）
- 上传前压缩到 800px 宽，质量 0.8
- 存入 Firebase Storage：`checkins/{userId}/{date}_{timestamp}.jpg`
- 同步写入 Firestore checkins 集合

**月历视图：**
- 默认显示当前月
- 有打卡的日期：显示照片缩略图（60x60px，圆角）
- 没有打卡的日期：空白格，不显示任何提示
- 点击有打卡的日期：底部弹出详情（照片大图 + 心情咖啡豆 + 文字）
- 不显示连续打卡天数，不制造打卡压力

---

### 功能三：多次相遇提醒

- 每次约咖活动 status 变为 done 时，为所有出席的用户两两写入 encounters 记录
- 查询某两个用户之间 encounters 数量，达到 3 次且 notified 为 false 时：
  - 给双方各发一条站内通知：「你们已经见面 3 次了 ☕」
  - 将所有相关 encounters 的 notified 改为 true
- 通知只出现一次，之后不再重复

---

### 高德 API 集成

```javascript
// src/lib/amap.js 的职责
// 1. 初始化高德 JS SDK
// 2. 获取当前定位
// 3. 搜索附近咖啡馆（关键词"咖啡"，返回名称、地址、距离）
// 4. 返回标准化的数组供组件使用
```

环境变量：`VITE_AMAP_KEY`

---

## 环境变量模板（.env.example）

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_AMAP_KEY=
```

---

## 开发顺序（请严格按此顺序，一步完成再做下一步）

1. 初始化 Vite + React + Tailwind，配置 Firebase，验证连接
2. Firebase Auth 手机号登录页面
3. 发布约咖页面（含高德搜索选店）
4. 首页约咖列表 + 报名
5. 照片打卡页面
6. 月历视图
7. 多次相遇计数逻辑
8. 个人主页

---

## 每次对话的工作方式

- 每次只做上面列表中的一个步骤，做完后等待确认再继续
- 写完代码后告诉我：做了什么、需要我做什么操作来测试
- 遇到需要填写 Firebase 或高德配置的地方，明确告诉我去哪里获取
- 报错信息贴给我，我会帮你判断原因，给出修复指令再让你执行
