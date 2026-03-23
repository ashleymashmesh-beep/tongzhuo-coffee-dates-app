-- 同桌 - 数据库表结构

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nickname TEXT,
  avatar TEXT,
  bio TEXT,
  city TEXT,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

-- 活动表（约咖）
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  cafe_name TEXT NOT NULL,
  cafe_address TEXT NOT NULL,
  cafe_id TEXT,
  date TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  specific_time TEXT,
  activity_type TEXT NOT NULL,
  intro TEXT,
  max_people INTEGER NOT NULL CHECK(max_people IN (2, 3)),
  status TEXT NOT NULL CHECK(status IN ('open', 'full', 'cancelled', 'done')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 报名表
CREATE TABLE IF NOT EXISTS signups (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(event_id, user_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 相遇记录表
CREATE TABLE IF NOT EXISTS encounters (
  id TEXT PRIMARY KEY,
  user_id_1 TEXT NOT NULL,
  user_id_2 TEXT NOT NULL,
  event_id TEXT NOT NULL,
  date TEXT NOT NULL,
  notified INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id_1) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id_2) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- 评价表
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE(from_user_id, to_user_id, event_id)
);

-- 打卡表
CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  cafe_name TEXT,
  mood_score INTEGER CHECK(mood_score >= 1 AND mood_score <= 5),
  note TEXT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 验证码表
CREATE TABLE IF NOT EXISTS sms_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expiry INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  verified INTEGER DEFAULT 0
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_creator ON events(creator_id);
CREATE INDEX IF NOT EXISTS idx_signups_event ON signups(event_id);
CREATE INDEX IF NOT EXISTS idx_signups_user ON signups(user_id);
CREATE INDEX IF NOT EXISTS idx_encounters_users ON encounters(user_id_1, user_id_2);
CREATE INDEX IF NOT EXISTS idx_checkins_user ON checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_date ON checkins(date);
CREATE INDEX IF NOT EXISTS idx_reviews_to_user ON reviews(to_user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_from_user ON reviews(from_user_id);
CREATE INDEX IF NOT EXISTS idx_sms_codes_email ON sms_codes(email);
