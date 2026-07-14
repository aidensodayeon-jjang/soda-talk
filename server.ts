import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// Removed external API integration as per requirements

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
}

interface ChatRoom {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  messages: Message[];
}

interface User {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  personalApiKey?: string;
  lastGptDate?: string;
  gptUsageCount?: number;
  persona?: string;
}

interface DBStructure {
  users: User[];
  settings: {
    aiProvider?: string;
    openaiApiKey?: string;
    lmStudioUrl: string;
    modelName: string;
    fallbackMode: boolean; // default true for easy emulation
    temperature?: number;
    maxTokens?: number;
    language?: string;
    openaiTokensUsed?: number;
    hybridModeEnabled?: boolean;
    dailyGptQuota?: number;
  };
  chats: ChatRoom[];
}

function initDB() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const defaultDB: DBStructure = {
      users: [
        { id: "user-1", username: "admin", displayName: "운영자", passwordHash: "admin123" },
        { id: "user-2", username: "muji", displayName: "무인양품", passwordHash: "muji123" }
      ],
      settings: {
        lmStudioUrl: "http://192.168.0.93:1234",
        modelName: "llama-3-korean-bllossom-8b",
        fallbackMode: true,
        hybridModeEnabled: false,
        dailyGptQuota: 3
      },
      chats: [
        {
          id: "chat-default",
          userId: "user-1",
          title: "첫 번째 대화방 ☕",
          createdAt: new Date().toISOString(),
          messages: [
            {
              id: "msg-1",
              sender: "assistant",
              text: "안녕! 나는 코딩 학원 '디랩(D-Lab)'의 친절한 인공지능 코딩 반려봇 '소다봇'이야! 🤖 코딩하다가 어려운 게 있으면 언제든 물어봐. 정답 대신 스스로 풀 수 있게 힌트를 줄게!",
              timestamp: new Date().toISOString()
            }
          ]
        }
      ]
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB, null, 2), "utf8");
  }
}

initDB();

function readDB(): DBStructure {
  initDB();
  const raw = fs.readFileSync(DB_FILE, "utf8");
  return JSON.parse(raw);
}

function writeDB(data: DBStructure) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

function checkHybridQuotaAndRoute(user: User, db: DBStructure) {
  const currentDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  
  if (user.lastGptDate !== currentDate) {
    user.lastGptDate = currentDate;
    user.gptUsageCount = 0;
  }

  let useGpt = false;
  if (db.settings.hybridModeEnabled) {
    const quota = db.settings.dailyGptQuota || 3;
    if ((user.gptUsageCount || 0) < quota) {
      useGpt = true;
      user.gptUsageCount = (user.gptUsageCount || 0) + 1;
    }
  } else {
    useGpt = db.settings.aiProvider === "openai";
  }

  if (useGpt) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      auth: `Bearer ${db.settings.openaiApiKey || ""}`,
      routedToGpt: true
    };
  } else {
    return {
      url: `${db.settings.lmStudioUrl}/v1/chat/completions`,
      auth: "Bearer lm-studio",
      routedToGpt: false
    };
  }
}

// ----------------------------------------------------
// SODA API Gateway (Hardware Proxy)
// ----------------------------------------------------
app.post('/v1/chat/completions', express.json(), async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "");
  const db = readDB();
  const user = db.users.find(u => u.personalApiKey === token);
  if (!user) return res.status(403).json({ error: "Invalid SODA API Key" });

  const routeConfig = checkHybridQuotaAndRoute(user, db);
  writeDB(db); // Save quota increments immediately

  try {
    const openaiRes = await fetch(routeConfig.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": routeConfig.auth
      },
      body: JSON.stringify(req.body)
    });

    const data = await openaiRes.json();
    
    // Log to DB
    const promptMessage = req.body.messages?.[req.body.messages.length - 1]?.content || "No prompt";
    const replyMessage = data.choices?.[0]?.message?.content || "No reply";

    let chat = db.chats.find(c => c.userId === user.id && c.title === "아두이노 소다봇 대화");
    if (!chat) {
      chat = {
        id: "chat-hw-" + Date.now(),
        userId: user.id,
        title: "아두이노 소다봇 대화",
        createdAt: new Date().toISOString(),
        messages: []
      };
      db.chats.push(chat);
    }
    
    chat.messages.push({
      id: "msg-" + Date.now() + "1",
      sender: "user",
      text: promptMessage,
      timestamp: new Date().toISOString()
    });
    chat.messages.push({
      id: "msg-" + Date.now() + "2",
      sender: "assistant",
      text: replyMessage,
      timestamp: new Date().toISOString()
    });
    writeDB(db);

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/v1', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "");
  const db = readDB();
  
  const user = db.users.find(u => u.personalApiKey === token);
  if (!user) return res.status(403).json({ error: "Invalid SODA API Key" });

  req.headers.authorization = `Bearer ${db.settings.openaiApiKey || ""}`;
  next();
}, createProxyMiddleware({
  target: 'https://api.openai.com',
  changeOrigin: true
}));

app.use(express.json());

// ----------------------------------------------------
// Authentication API
// ----------------------------------------------------
const sessions = new Map<string, { id: string; username: string; displayName: string }>();

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "아이디와 비밀번호를 모두 입력해 주세요." });
  }

  const db = readDB();
  const user = db.users.find(u => u.username === username);

  if (!user || user.passwordHash !== password) {
    return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
  }

  const sessionId = Math.random().toString(36).substring(2, 15);
  const sessionUser = { id: user.id, username: user.username, displayName: user.displayName };
  sessions.set(sessionId, sessionUser);

  res.json({ success: true, sessionId, user: sessionUser });
});

app.post("/api/auth/signup", (req, res) => {
  const { username, displayName, password } = req.body;
  if (!username || !displayName || !password) {
    return res.status(400).json({ error: "모든 항목을 입력해 주세요." });
  }

  const db = readDB();
  const exists = db.users.some(u => u.username === username);
  if (exists) {
    return res.status(400).json({ error: "이미 존재하는 아이디입니다." });
  }

  const newUser = {
    id: "user-" + Date.now(),
    username,
    displayName,
    passwordHash: password
  };

  db.users.push(newUser);
  writeDB(db);

  const sessionId = Math.random().toString(36).substring(2, 15);
  const sessionUser = { id: newUser.id, username: newUser.username, displayName: newUser.displayName };
  sessions.set(sessionId, sessionUser);

  res.json({ success: true, sessionId, user: sessionUser });
});

app.post("/api/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    sessions.delete(token);
  }
  res.json({ success: true });
});

app.get("/api/auth/me", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "인증되지 않은 사용자입니다." });
  }
  const token = authHeader.replace("Bearer ", "");
  const session = sessions.get(token);
  if (!session) {
    return res.status(401).json({ error: "세션이 만료되었습니다." });
  }
  res.json({ user: session });
});

// ----------------------------------------------------
// Admin API
// ----------------------------------------------------
const requireAdmin = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증되지 않은 사용자입니다." });
  
  const token = authHeader.replace("Bearer ", "");
  const session = sessions.get(token);
  if (!session || session.username !== "admin") {
    return res.status(403).json({ error: "운영자 권한이 필요합니다." });
  }
  next();
};

app.get("/api/admin/users", requireAdmin, (req, res) => {
  const db = readDB();
  res.json({ users: db.users });
});

app.post("/api/admin/users", requireAdmin, (req, res) => {
  const { username, displayName, password } = req.body;
  const db = readDB();
  if (db.users.some(u => u.username === username)) return res.status(400).json({ error: "이미 존재하는 아이디입니다." });
  
  const newUser = { id: "user-" + Date.now(), username, displayName, passwordHash: password };
  db.users.push(newUser);
  writeDB(db);
  res.json({ success: true, user: newUser });
});

app.put("/api/admin/users/:id", requireAdmin, (req, res) => {
  const { displayName, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "유저를 찾을 수 없습니다." });
  
  if (displayName) user.displayName = displayName;
  if (password) user.passwordHash = password;
  writeDB(db);
  res.json({ success: true, user });
});

app.delete("/api/admin/users/:id", requireAdmin, (req, res) => {
  if (req.params.id === "user-1") return res.status(400).json({ error: "최고 관리자는 삭제할 수 없습니다." });
  const db = readDB();
  db.users = db.users.filter(u => u.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

app.post("/api/admin/users/:id/apikey", requireAdmin, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "유저를 찾을 수 없습니다." });
  
  const newApiKey = "sk-soda-" + crypto.randomBytes(16).toString("hex");
  user.personalApiKey = newApiKey;
  writeDB(db);
  res.json({ success: true, apiKey: newApiKey });
});

app.get("/api/admin/users/:id/stats", requireAdmin, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "유저를 찾을 수 없습니다." });

  const userChats = db.chats.filter(c => c.userId === user.id);
  const totalMessages = userChats.reduce((acc, chat) => acc + chat.messages.length, 0);

  res.json({
    user: {
      username: user.username,
      displayName: user.displayName,
      lastGptDate: user.lastGptDate || null,
      gptUsageCount: user.gptUsageCount || 0
    },
    stats: {
      totalChats: userChats.length,
      totalMessages: totalMessages
    },
    settings: {
      hybridModeEnabled: db.settings.hybridModeEnabled,
      dailyGptQuota: db.settings.dailyGptQuota || 3
    }
  });
});

app.get("/api/admin/stats/all", requireAdmin, (req, res) => {
  const db = readDB();
  const allUsersStats = db.users.map(u => {
    const userChats = db.chats.filter(c => c.userId === u.id);
    const totalMessages = userChats.reduce((acc, chat) => acc + chat.messages.length, 0);
    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      totalChats: userChats.length,
      totalMessages: totalMessages,
      lastGptDate: u.lastGptDate || null,
      gptUsageCount: u.gptUsageCount || 0
    };
  });

  res.json({
    users: allUsersStats,
    settings: {
      hybridModeEnabled: db.settings.hybridModeEnabled,
      dailyGptQuota: db.settings.dailyGptQuota || 3
    }
  });
});

app.get("/api/admin/chats", requireAdmin, (req, res) => {
  const db = readDB();
  // We want to return chats enriched with user display names
  const chatsWithUsers = db.chats.map(chat => {
    const user = db.users.find(u => u.id === chat.userId);
    return {
      ...chat,
      username: user ? user.displayName : "알 수 없는 유저"
    };
  });
  // Sort by latest created first
  chatsWithUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(chatsWithUsers);
});

// ----------------------------------------------------
// System Status API
// ----------------------------------------------------
app.get("/api/system/status", (req, res) => {
  const db = readDB();
  const memoryUsage = {
    total: os.totalmem(),
    free: os.freemem()
  };
  const openaiUsage = {
    used: db.settings.openaiTokensUsed || 3240, // Mock or real token usage
    limit: 10000 // Monthly limit mock
  };
  res.json({ memoryUsage, openaiUsage });
});

// ----------------------------------------------------
// LM Studio Settings API
// ----------------------------------------------------
app.get("/api/lmstudio/config", (req, res) => {
  const db = readDB();
  res.json(db.settings);
});

app.post("/api/lmstudio/config", (req, res) => {
  const { aiProvider, openaiApiKey, lmStudioUrl, modelName, fallbackMode, temperature, maxTokens, language, hybridModeEnabled, dailyGptQuota } = req.body;
  const db = readDB();

  if (aiProvider !== undefined) db.settings.aiProvider = aiProvider;
  if (openaiApiKey !== undefined) db.settings.openaiApiKey = openaiApiKey;
  if (lmStudioUrl !== undefined) db.settings.lmStudioUrl = lmStudioUrl;
  if (modelName !== undefined) db.settings.modelName = modelName;
  if (fallbackMode !== undefined) db.settings.fallbackMode = fallbackMode;
  if (temperature !== undefined) db.settings.temperature = temperature;
  if (maxTokens !== undefined) db.settings.maxTokens = maxTokens;
  if (language !== undefined) db.settings.language = language;
  if (hybridModeEnabled !== undefined) db.settings.hybridModeEnabled = hybridModeEnabled;
  if (dailyGptQuota !== undefined) db.settings.dailyGptQuota = dailyGptQuota;

  writeDB(db);
  res.json({ success: true, settings: db.settings });
});

app.post("/api/lmstudio/test", async (req, res) => {
  // Global state for LM Studio settings (mocked persistence)
  let globalLmStudioUrl = "https://granular-kindly-morally.ngrok-free.dev";
  let globalLmStudioConnected = false;
  
  const { lmStudioUrl } = req.body;
  const targetUrl = lmStudioUrl || globalLmStudioUrl;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 sec timeout

    const response = await fetch(`${targetUrl}/v1/models`, {
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return res.json({
        connected: true,
        message: "LM Studio 서버와 원활히 소통 중입니다!",
        models: data.data || []
      });
    } else {
      return res.json({
        connected: false,
        message: `LM Studio 응답 코드 에러: ${response.status}`
      });
    }
  } catch (err: any) {
    return res.json({
      connected: false,
      message: `연결 상태: 대기 모드 (LM Studio 원격 연결 불가능시 인공지능 에뮬레이터 모드가 정상 대체 지원됩니다)`
    });
  }
});

// Streaming proxy to LM Studio with virtual emulator fallback
app.post("/api/lmstudio/stream", async (req, res) => {
  req.socket.setNoDelay(true);
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });

  const token = authHeader.replace("Bearer ", "");
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const db = readDB();
  const user = db.users.find(u => u.id === session.id);
  
  let fetchUrl = `${db.settings.lmStudioUrl}/v1/chat/completions`;
  let authHeaderValue = "Bearer lm-studio";

  if (user) {
    const routeConfig = checkHybridQuotaAndRoute(user, db);
    fetchUrl = routeConfig.url;
    authHeaderValue = routeConfig.auth;
    writeDB(db);
  }

  const fallbackMode = db.settings.fallbackMode;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const streamFallback = async () => {
    const fallbackText = "안녕! 지금 엔진이 오프라인 상태라서 가상 에뮬레이터 모드로 동작 중이야. 🤖\n\nAI 엔진 설정을 올바르게 입력하면 진짜 인공지능과 대화할 수 있어! 어떤 코딩 힌트가 필요해? 🌱";
    const segments = fallbackText.split(/(\s+)/);
    for (const segment of segments) {
      if (segment) {
        const chunk = {
          choices: [
            {
              delta: { content: segment },
              finish_reason: null
            }
          ]
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 300s timeout

    const lmResponse = await fetch(fetchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeaderValue,
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify(req.body),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!lmResponse.ok) {
      throw new Error(`LM Studio returned status ${lmResponse.status}`);
    }

    if (!lmResponse.body) {
      throw new Error("ReadableStream not supported on backend response");
    }

    const reader = lmResponse.body.getReader();
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        res.write(value);
      }
    }
    res.end();
  } catch (err: any) {
    console.warn("LM Studio streaming failed:", err.message || err);
    if (fallbackMode) {
      await streamFallback();
    } else {
      const errChunk = {
        choices: [
          {
            delta: {
              content: `[LM Studio 연결 실패: ${err.message || err}]`
            }
          }
        ]
      };
      res.write(`data: ${JSON.stringify(errChunk)}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
});


// ----------------------------------------------------
// Chats & Message History API (ChatGPT Vibe)
// ----------------------------------------------------
app.get("/api/chats", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });

  const token = authHeader.replace("Bearer ", "");
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const db = readDB();
  const userChats = db.chats.filter(c => c.userId === session.id);
  res.json(userChats);
});

app.post("/api/chats", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });

  const token = authHeader.replace("Bearer ", "");
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { title } = req.body;
  const db = readDB();

  const newChat: ChatRoom = {
    id: "chat-" + Date.now(),
    userId: session.id,
    title: title || "새로운 대화 ✨",
    createdAt: new Date().toISOString(),
    messages: []
  };

  db.chats.push(newChat);
  writeDB(db);

  res.json(newChat);
});

app.delete("/api/chats/:id", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });

  const token = authHeader.replace("Bearer ", "");
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { id } = req.params;
  const db = readDB();

  const chatIdx = db.chats.findIndex(c => c.id === id && c.userId === session.id);
  if (chatIdx !== -1) {
    db.chats.splice(chatIdx, 1);
    writeDB(db);
    return res.json({ success: true });
  }

  res.status(404).json({ error: "대화방을 찾을 수 없습니다." });
});

// Sync Messages from Client (for client-side LM Studio fetching)
app.post("/api/chats/:id/sync", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });

  const token = authHeader.replace("Bearer ", "");
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { id } = req.params;
  const { messages, title } = req.body;

  const db = readDB();
  const chat = db.chats.find(c => c.id === id && c.userId === session.id);

  if (!chat) {
    return res.status(404).json({ error: "대화방을 찾을 수 없습니다." });
  }

  if (title) chat.title = title;
  if (messages && Array.isArray(messages)) {
    chat.messages.push(...messages);
  }

  writeDB(db);
  res.json({ success: true, chat });
});


// ==========================================
// Auto-Memory Extraction (Background Task)
// ==========================================
async function extractAndSaveMemory(userId, chatMessages, settings) {
  try {
    const textHistory = chatMessages.map(m => `${m.sender === 'user' ? '사용자' : 'AI'}: ${m.text}`).join('\n');
    const prompt = `다음은 사용자와 AI의 최근 대화 기록입니다. 
사용자에 대한 새롭고 중요한 사실(취향, 직업, 가족관계, 중요한 경험 등)을 발견하면 간결한 한 문장씩 요약해 주세요. 
새로 기억할 만한 내용이 없으면 반드시 '없음'이라고만 대답하세요.

대화 기록:
${textHistory}

요약:`;

    // Local LLM 
    const targetUrl = settings.lmStudioUrl || "http://192.168.0.93:1234";
    const lmResponse = await fetch(`${targetUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer lm-studio" },
      body: JSON.stringify({
        model: settings.modelName || "llama-3-korean-bllossom-8b",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 150
      })
    });

    if (lmResponse.ok) {
      const resData = await lmResponse.json();
      let extraction = resData.choices?.[0]?.message?.content?.trim() || "없음";
      if (!extraction.includes("없음") && extraction.length > 3) {
        // Update DB
        const db = readDB();
        const u = db.users.find(u => u.id === userId);
        if (u) {
          const currentPersona = u.persona || "";
          // Only append if it's new
          u.persona = currentPersona ? `${currentPersona}\n- ${extraction}` : `- ${extraction}`;
          writeDB(db);
          console.log(`[Auto-Memory] Updated memory for ${userId}: ${extraction}`);
        }
      }
    }
  } catch (err) {
    console.warn("[Auto-Memory] Background extraction failed:", err.message);
  }
}

// Send Message & Get Stream-compatible response from LM Studio (or Fallback Emulator)
app.post("/api/chats/:id/messages", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });

  const token = authHeader.replace("Bearer ", "");
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { id } = req.params;
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "메시지 텍스트를 입력해 주세요." });
  }

  const db = readDB();
  const chat = db.chats.find(c => c.id === id && c.userId === session.id);

  if (!chat) {
    return res.status(404).json({ error: "대화방을 찾을 수 없습니다." });
  }

  // 1. Add User Message
  const userMsg: Message = {
    id: "msg-" + Date.now() + "-user",
    sender: "user",
    text,
    timestamp: new Date().toISOString()
  };
  chat.messages.push(userMsg);

  // Auto rename chat title if it's the first message and placeholder
  if (chat.messages.filter(m => m.sender === "user").length === 1 && (chat.title === "새로운 대화 ✨" || chat.title.startsWith("새로운 대화"))) {
    chat.title = text.substring(0, 16) + (text.length > 16 ? "..." : "");
  }

  const settings = db.settings;

  // 5. Trigger Auto-Memory Extraction every 2 messages (1 turn) for easier testing
  if (chat.messages.length % 2 === 0) {
    // Run asynchronously so it doesn't block the API response
    // We send the last 10 messages for context extraction
    const recentMessages = chat.messages.slice(-10);
    extractAndSaveMemory(session.id, recentMessages, settings).catch(console.error);
  }

  let assistantOutput = "";

  // Compile full prompt context from previous messages
  // 성능 및 속도 최적화를 위해 과거 컨텍스트를 최근 2개(1턴)로 슬라이싱합니다.
  const windowedMessages = chat.messages.slice(-2);
  const conversationHistory = windowedMessages.map(m => ({
    role: m.sender === "user" ? "user" : "assistant",
    content: m.text
  }));

  // 관리자가 유저에게 부여한 맞춤형 페르소나가 있다면 로드합니다.
  const userRecord = db.users.find(u => u.id === session.id);
  let sodabotPersona = "코딩 학원 '디랩(D-Lab)'의 인공지능 코딩 반려봇 '소다봇'이야. 초등학생 눈높이의 친근한 한국어 반말 구어체(~했어?, ~야!)와 이모지를 적극 사용해. 에러에는 깊이 공감해주고, 코딩 질문에는 정답 대신 단계별 힌트만 줘.";
  
  if (userRecord && userRecord.persona) {
    sodabotPersona = `${sodabotPersona}\n\n[특별 지시사항: 사용자에 맞게 다음 페르소나를 반드시 적용할 것]\n${userRecord.persona}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 300s timeout for local LLM

    const targetUrl = "http://192.168.0.93:1234";
    
    const lmResponse = await fetch(`${targetUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer lm-studio" // Dummy key to bypass API key checks
      },
      body: JSON.stringify({
        model: "llama-3-korean-bllossom-8b",
        messages: [
          { role: "system", content: sodabotPersona },
          ...conversationHistory
        ],
        temperature: 0.7,
        max_tokens: 1024
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (lmResponse.ok) {
      const resData = await lmResponse.json();
      assistantOutput = resData.choices?.[0]?.message?.content || "";
    } else {
      console.warn("LM Studio returned an error:", lmResponse.status, lmResponse.statusText);
      assistantOutput = "로컬 엔진이 잠시 쉬고 있어! 잠시 후 다시 시도해줘.";
    }
  } catch (err: any) {
    console.warn("LM Studio connection failed or timed out:", err.message || err);
    assistantOutput = "로컬 엔진이 잠시 쉬고 있어! 잠시 후 다시 시도해줘.";
  }

  // 4. Save Assistant Message
  const assistantMsg: Message = {
    id: "msg-" + Date.now() + "-assistant",
    sender: "assistant",
    text: assistantOutput,
    timestamp: new Date().toISOString()
  };
  chat.messages.push(assistantMsg);
  writeDB(db);

  res.json({
    success: true,
    userMessage: userMsg,
    assistantMessage: assistantMsg,
    usedEmulator: false,
    chatTitle: chat.title
  });
});

// ----------------------------------------------------
// Front-End Integration via Vite & Static Hosting
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
