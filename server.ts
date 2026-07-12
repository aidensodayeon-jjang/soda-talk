import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Gemini API for smart fallback/emulator
const geminiApiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({
  apiKey: geminiApiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

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
}

interface DBStructure {
  users: User[];
  settings: {
    lmStudioUrl: string;
    modelName: string;
    fallbackMode: boolean; // default true for easy emulation
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
        modelName: "meta-llama-3-8b-instruct",
        fallbackMode: true
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
              text: "안녕하세요! 무인양품, 노션, 애플의 단정하고 부드러운 감성을 닮은 AI 비서입니다. 192.168.0.93:1234 포트의 LM Studio 서비스가 지정되어 있습니다. 언제든 편안히 말을 걸어주세요.",
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
// LM Studio Settings API
// ----------------------------------------------------
app.get("/api/lmstudio/config", (req, res) => {
  const db = readDB();
  res.json(db.settings);
});

app.post("/api/lmstudio/config", (req, res) => {
  const { lmStudioUrl, modelName, fallbackMode } = req.body;
  const db = readDB();

  if (lmStudioUrl !== undefined) db.settings.lmStudioUrl = lmStudioUrl;
  if (modelName !== undefined) db.settings.modelName = modelName;
  if (fallbackMode !== undefined) db.settings.fallbackMode = fallbackMode;

  writeDB(db);
  res.json({ success: true, settings: db.settings });
});

app.post("/api/lmstudio/test", async (req, res) => {
  const { lmStudioUrl } = req.body;
  const targetUrl = lmStudioUrl || "http://192.168.0.93:1234";

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
  let assistantOutput = "";
  let usedEmulator = false;

  // Compile full prompt context from previous messages (up to 15 messages)
  const conversationHistory = chat.messages.slice(-15).map(m => ({
    role: m.sender === "user" ? "user" : "assistant",
    content: m.text
  }));

  // 2. Try to invoke LM Studio
  let lmStudioSuccess = false;
  if (!settings.fallbackMode) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

      const lmResponse = await fetch(`${settings.lmStudioUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: settings.modelName || "meta-llama-3-8b-instruct",
          messages: [
            { role: "system", content: "당신은 무인양품, 노션, 애플의 디자인 철학을 사랑하는 담백하고 따뜻한 어조의 지능형 AI 비서입니다. 한국어로 사려 깊고 세련되게 답변하세요." },
            ...conversationHistory
          ],
          temperature: 0.7,
          max_tokens: 1536
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (lmResponse.ok) {
        const resData = await lmResponse.json();
        assistantOutput = resData.choices?.[0]?.message?.content || "";
        lmStudioSuccess = true;
      }
    } catch (err) {
      console.warn("LM Studio connection failed or timed out. Swapping to Gemini virtual engine.");
    }
  }

  // 3. Dynamic smart emulator fallback
  if (!lmStudioSuccess) {
    usedEmulator = true;
    try {
      const historyPrompt = conversationHistory.map(h => `${h.role === "user" ? "Q:" : "A:"} ${h.content}`).join("\n\n");
      const simulationPrompt = `
당신은 무인양품, 노션, 애플의 단정하고 직관적인 철학을 반영하는 담백하고 사려 깊은 대화형 어조의 한국어 인공지능 비서(LM Studio 에뮬레이터)입니다.
불필요한 미사여구나 서두를 길게 뽑아내지 말고, 사용자의 질문에 진지하고 정돈된 한글 텍스트로 답장해 주세요.

--- 이전 대화 기록 ---
${historyPrompt}

--- 최신 질문에 대한 정갈한 한글 답변 생성 ---
A:`;

      const simResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: simulationPrompt,
        config: {
          temperature: 0.7
        }
      });

      assistantOutput = simResponse.text || "답변을 정비하는 과정에 다소 지연이 발생했습니다. 다시 질문해 주시겠어요?";
    } catch (geminiErr: any) {
      assistantOutput = `[가상 코어 에러] 일시적인 통신 과부하로 답변을 생성할 수 없습니다: ${geminiErr.message}`;
    }
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
    usedEmulator,
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
