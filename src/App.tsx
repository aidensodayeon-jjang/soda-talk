import React, { useState, useEffect, useRef } from "react";
import AuthScreen from "./components/AuthScreen";
import {
  Sparkles,
  Plus,
  Trash2,
  Settings,
  LogOut,
  Send,
  Terminal,
  User,
  Cpu,
  Wifi,
  WifiOff,
  Check,
  RefreshCw,
  Compass,
  MessageSquare,
  BookOpen,
  ArrowRight,
  X,
  Info,
  Sun,
  ChevronDown,
  FileText,
  Zap,
  Users,
  Key,
  PlusCircle,
  Activity
} from "lucide-react";
import { ChatRoom, Message, LMStudioConfig } from "./types";

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("authSessionId"));
  const [user, setUser] = useState<{ id: string; username: string; displayName: string } | null>(null);

  // Core Data States
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);

  // Settings Panel State
  const [showSettings, setShowSettings] = useState(false);
  const [aiProvider, setAiProvider] = useState("local");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [lmStudioUrl, setLmStudioUrl] = useState("https://granular-kindly-morally.ngrok-free.dev");
  const [modelName, setModelName] = useState("meta-llama-3-8b-instruct");
  const [fallbackMode, setFallbackMode] = useState(true);
  const [hybridModeEnabled, setHybridModeEnabled] = useState(false);
  const [dailyGptQuota, setDailyGptQuota] = useState(3);
  const [lmStudioConnected, setLmStudioConnected] = useState<boolean | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testMessage, setTestMessage] = useState("");

  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [language, setLanguage] = useState("Korean");
  const [systemStatus, setSystemStatus] = useState<{ memoryUsage?: { total: number, free: number }, openaiUsage?: { used: number, limit: number } }>({});

  // Admin Panel State
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminChats, setAdminChats] = useState<any[]>([]);
  const [monitoringChatId, setMonitoringChatId] = useState<string | null>(null);
  const [monitoringTab, setMonitoringTab] = useState<"rooms" | "messages">("rooms");
  const [adminSelectedUserId, setAdminSelectedUserId] = useState<string | null>(null);
  const [adminSelectedUserStatsId, setAdminSelectedUserStatsId] = useState<string | null>(null);
  const [adminUserStats, setAdminUserStats] = useState<any>(null);
  const [showGlobalDashboard, setShowGlobalDashboard] = useState(false);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [adminError, setAdminError] = useState("");

  const fetchAdminUsers = async () => {
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAdminUsers(data.users);
      }
    } catch (err) {
      console.error("Failed to load users", err);
    }
  };

  const fetchGlobalStats = async () => {
    try {
      const res = await fetch('/api/admin/stats/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setGlobalStats(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUserStats = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAdminUserStats(data);
        setAdminSelectedUserStatsId(userId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminChats = async () => {
    try {
      const res = await fetch("/api/admin/chats", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setAdminChats(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (showAdminPanel) {
      fetchAdminUsers();
      fetchAdminChats();
    }
  }, [showAdminPanel]);

  // 5초마다 실시간 대화 피드 갱신
  useEffect(() => {
    let interval;
    if (user?.username === "admin") {
      fetchAdminChats(); // 최초 1회 실행
      interval = setInterval(() => {
        fetchAdminChats();
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [user]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: newUsername, displayName: newDisplayName, password: newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setNewUsername("");
        setNewDisplayName("");
        setNewPassword("");
        fetchAdminUsers();
      } else {
        setAdminError(data.error);
      }
    } catch (err) {
      setAdminError("생성 실패");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("정말 이 유저를 삭제하시겠습니까?")) return;
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAdminUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePersona = async (userId: string, newPersona: string) => {
    try {
      await fetch(`/api/admin/users/${userId}/persona`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ persona: newPersona })
      });
      fetchAdminUsers();
      alert("페르소나가 업데이트 되었습니다!");
    } catch (err) {
      console.error(err);
      alert("페르소나 업데이트 실패");
    }
  };

  const handleGenerateApiKey = async (userId: string) => {
    if (!window.confirm("기존 API 키가 있다면 무효화됩니다. 새로 발급하시겠습니까?")) return;
    try {
      await fetch(`/api/admin/users/${userId}/apikey`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAdminUsers();
    } catch (err) {
      console.error(err);
    }
  };


  const chatEndRef = useRef<HTMLDivElement>(null);

  // 1. Verify session on mount
  useEffect(() => {
    if (token) {
      verifySession(token);
    }
  }, [token]);

  // 2. Fetch data once logged in
  useEffect(() => {
    if (user) {
      fetchChats();
      fetchLMStudioConfig();
    }
  }, [user]);

  // 3. Auto-scroll chat history to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, activeChatId, sending]);

  const verifySession = async (sessionToken: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${sessionToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
      } else {
        handleLogout();
      }
    } catch (err) {
      console.error("Session verification failed", err);
      handleLogout();
    }
  };

  const fetchChats = async () => {
    try {
      const res = await fetch("/api/chats", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setChats(data);
        // Do not auto-activate first chat (per user request to start fresh)
      }
    } catch (err) {
      console.error("Failed to fetch chats", err);
    }
  };

  const fetchLMStudioConfig = async () => {
    try {
      const res = await fetch("/api/lmstudio/config");
      const data = await res.json();
      if (res.ok) {
        if (data.aiProvider) setAiProvider(data.aiProvider || "local");
        setOpenaiApiKey(data.openaiApiKey || "");
        if (data.lmStudioUrl) setLmStudioUrl(data.lmStudioUrl);
        if (data.modelName) setModelName(data.modelName);
        setFallbackMode(data.fallbackMode);
        if (data.hybridModeEnabled !== undefined) setHybridModeEnabled(data.hybridModeEnabled);
        if (data.dailyGptQuota !== undefined) setDailyGptQuota(data.dailyGptQuota);
        if (data.temperature !== undefined) setTemperature(data.temperature);
        if (data.maxTokens !== undefined) setMaxTokens(data.maxTokens);
        if (data.language !== undefined) setLanguage(data.language);
        checkConnection(data.lmStudioUrl);
      }
    } catch (err) {
      console.error("Failed to load LM Studio settings", err);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (user) {
      const fetchStatus = async () => {
        try {
          const res = await fetch("/api/system/status");
          if (res.ok) {
            const data = await res.json();
            setSystemStatus(data);
          }
        } catch (err) {
          // ignore
        }
      };
      fetchStatus();
      interval = setInterval(fetchStatus, 3000);
    }
    return () => clearInterval(interval);
  }, [user]);

  const checkConnection = async (urlToCheck?: string) => {
    const url = urlToCheck || lmStudioUrl;
    try {
      const res = await fetch("/api/lmstudio/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lmStudioUrl: url })
      });
      const data = await res.json();
      setLmStudioConnected(data.connected);
      return data;
    } catch (err) {
      setLmStudioConnected(false);
      return { connected: false, message: "연결 오류가 발생했습니다." };
    }
  };

  const handleCreateNewChat = () => {
    setActiveChatId(null);
  };

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation(); // prevent setting active
    if (!confirm("이 대화방을 완전히 삭제할까요?")) return;

    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setChats(prev => prev.filter(c => c.id !== chatId));
        if (activeChatId === chatId) {
          const remaining = chats.filter(c => c.id !== chatId);
          setActiveChatId(remaining.length > 0 ? remaining[0].id : null);
        }
      }
    } catch (err) {
      console.error("Failed to delete chat", err);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, presetText?: string) => {
    if (e) e.preventDefault();
    const textToSend = presetText || inputText;
    if (!textToSend.trim() || sending) return;

    let targetChatId = activeChatId;

    // Create a chat automatically if none is selected or active
    if (!targetChatId) {
      try {
        const res = await fetch("/api/chats", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ title: textToSend.substring(0, 16) })
        });
        const data = await res.json();
        if (res.ok) {
          setChats(prev => [data, ...prev]);
          targetChatId = data.id;
          setActiveChatId(data.id);
        } else {
          return;
        }
      } catch (err) {
        console.error("Auto chat creation failed", err);
        return;
      }
    }

    setSending(true);
    if (!presetText) setInputText("");

    // 1. Create and render User Message locally
    const userMsg: Message = {
      id: "msg-" + Date.now() + "-user",
      sender: "user",
      text: textToSend,
      timestamp: new Date().toISOString()
    };

    let updatedChats = chats;
    setChats(prev => {
      updatedChats = prev.map(c => {
        if (c.id === targetChatId) return { ...c, messages: [...c.messages, userMsg] };
        return c;
      });
      return updatedChats;
    });

    // Sync User Message to backend
    try {
      await fetch(`/api/chats/${targetChatId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: [userMsg] })
      });
    } catch (err) {
      console.error("Failed to sync user message", err);
    }

    const assistantMsgId = "msg-" + Date.now() + "-assistant";
    let assistantMsgText = "";
    let usedModelName = "";

    setChats(prev => prev.map(c => {
      if (c.id === targetChatId) {
        return {
          ...c,
          messages: [...c.messages, { id: assistantMsgId, sender: "assistant", text: "", timestamp: new Date().toISOString() }]
        };
      }
      return c;
    }));

    try {
      const currentChat = chats.find(c => c.id === targetChatId);
      const previousMessages = currentChat ? currentChat.messages : [];
      const cleanMessages = previousMessages.filter(m => !m.text.includes("로컬 엔진이 잠시 쉬고 있어"));
      const windowedMessages = [...cleanMessages, userMsg].slice(-20);

      const conversationHistory = windowedMessages.map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text
      }));

      const sodabotPersona = "코딩 학원 '디랩(D-Lab)'의 인공지능 코딩 반려봇 '소다봇'이야. 초등학생 눈높이의 친근한 한국어 반말 구어체(~했어?, ~야!)와 이모지를 적극 사용해. 에러에는 깊이 공감해주고, 코딩 질문에는 정답 대신 단계별 힌트만 줘.";

      const res = await fetch(`/api/lmstudio/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: sodabotPersona },
            ...conversationHistory
          ],
          temperature: temperature,
          max_tokens: maxTokens,
          stream: true
        })
      });

      console.log("LM Studio HTTP status:", res.status);
      if (!res.ok) {
        const errText = await res.text();
        console.error("LM Studio error response:", errText);
        throw new Error(errText || `LM Studio HTTP 에러: ${res.status}`);
      }

      if (!res.body) throw new Error("ReadableStream not supported in this browser.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let buffer = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep the last incomplete line in buffer

          for (let line of lines) {
            line = line.trim();
            if (line.startsWith("data:") && !line.includes("[DONE]")) {
              try {
                const payload = line.replace(/^data:\s*/, "");
                const parsed = JSON.parse(payload);
                if (parsed.model) usedModelName = parsed.model;
                const tokenContent = parsed.choices?.[0]?.delta?.content || "";

                if (tokenContent) {
                  assistantMsgText += tokenContent;
                  console.log("Received token:", tokenContent, "Total text so far:", assistantMsgText);

                  setChats(prev => prev.map(c => {
                    if (c.id === targetChatId) {
                      return {
                        ...c,
                        messages: c.messages.map(m =>
                          m.id === assistantMsgId ? { ...m, text: assistantMsgText, modelUsed: usedModelName || m.modelUsed } : m
                        )
                      };
                    }
                    return c;
                  }));
                }
              } catch (e) {
                console.error("Stream parse error:", e, "Line:", line);
              }
            }
          }
        }
      }

      console.log("Stream completely finished!");

    } catch (err: any) {
      console.warn("Client-side LM Studio connect error:", err);
      const errDetails = err.message || err.toString();
      assistantMsgText = "로컬 엔진이 잠시 쉬고 있어! 에러 원인: [" + errDetails + "]";
      setChats(prev => prev.map(c => {
        if (c.id === targetChatId) {
          return {
            ...c,
            messages: c.messages.map(m => m.id === assistantMsgId ? { ...m, text: assistantMsgText } : m)
          };
        }
        return c;
      }));
    } finally {
      // Sync finalized Assistant Message to backend
      const assistantMsgFinal: Message = {
        id: assistantMsgId,
        sender: "assistant",
        text: assistantMsgText,
        timestamp: new Date().toISOString(),
        modelUsed: usedModelName || "Unknown Model"
      };

      try {
        await fetch(`/api/chats/${targetChatId}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ messages: [assistantMsgFinal] })
        });
      } catch (err) {
        console.error("Failed to sync assistant message", err);
      }

      setSending(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/lmstudio/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiProvider,
          openaiApiKey,
          lmStudioUrl,
          modelName,
          fallbackMode,
          hybridModeEnabled,
          dailyGptQuota
        })
      });
      if (res.ok) {
        setShowSettings(false);
        checkConnection(lmStudioUrl);
      }
    } catch (err) {
      console.error("Failed to save settings", err);
    }
  };

  const handleToggleProvider = async () => {
    const newProvider = aiProvider === "local" ? "openai" : "local";
    setAiProvider(newProvider); // Optimistic UI update
    try {
      await fetch("/api/lmstudio/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiProvider: newProvider })
      });
    } catch (err) {
      console.error("Failed to toggle provider", err);
    }
  };

  const handleTestSettingsConnection = async () => {
    setTestingConnection(true);
    setTestMessage("");
    const res = await checkConnection(lmStudioUrl);
    setTestMessage(res.message);
    setTestingConnection(false);
  };

  const handleLoginSuccess = (sessionId: string, loggedInUser: { id: string; username: string; displayName: string }) => {
    localStorage.setItem("authSessionId", sessionId);
    setToken(sessionId);
    setUser(loggedInUser);
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error("Logout request failed", err);
      }
    }
    localStorage.removeItem("authSessionId");
    setToken(null);
    setUser(null);
    setChats([]);
    setActiveChatId(null);
  };

  if (!user) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const activeChat = chats.find(c => c.id === activeChatId);

  // Suggestions for empty state (Notion / MUJI Vibe)
  const suggestionCards = [
    {
      title: "베란다 실내 식물 추천 🌱",
      desc: "아파트 실내에서 간편하게 기를 수 있는 미니멀 식물과 관리 팁을 알려드립니다.",
      prompt: "아파트 베란다나 침실에서 키우기 좋은 미니멀한 실내 식물 3가지와 물주기 팁을 알려줘."
    },
    {
      title: "브랜드 카피라이팅 기획 ✏️",
      desc: "꾸밈없고 일상에 녹아드는 간결한 문장의 한 줄 광고 기획서.",
      prompt: "가벼운 린넨 이불 제품에 어울리는 담백하고 미니멀한 가을용 카피 3가지만 적어줘."
    },
    {
      title: "따뜻한 맞춤법 교정기 ☕",
      desc: "은어와 띄어쓰기가 뒤섞인 서툰 글을 다정하고 품격 넘치는 정돈된 우리글로 다듬기.",
      prompt: "다음 오탈자 글을 교정해줘: '저번에산 베개 넘나편해서 꿀잠잤음 진짜 고마워요 번창하새요'"
    }
  ];

  const memTotalGB = systemStatus?.memoryUsage ? (systemStatus.memoryUsage.total / 1024 / 1024 / 1024).toFixed(1) : "8.0";
  const memFreeGB = systemStatus?.memoryUsage ? (systemStatus.memoryUsage.free / 1024 / 1024 / 1024).toFixed(1) : "1.8";
  const memUsedGB = (parseFloat(memTotalGB) - parseFloat(memFreeGB)).toFixed(1);
  const memPercent = Math.min(100, Math.max(0, (parseFloat(memUsedGB) / parseFloat(memTotalGB)) * 100));

  const openaiUsed = systemStatus?.openaiUsage?.used || 3240;
  const openaiLimit = systemStatus?.openaiUsage?.limit || 10000;
  const openaiPercent = Math.min(100, Math.max(0, (openaiUsed / openaiLimit) * 100));

  // ===== ADMIN CUSTOM LAYOUT =====
  if (user?.username === "admin") {
    return (
      <div className="flex h-screen bg-[#FAF9F6] text-[#1D1D1F] font-sans antialiased overflow-hidden">
        {/* 1. Admin Left Sidebar */}
        <aside className="w-64 border-r border-[#EAE6DF] bg-[#FAF9F6] flex flex-col shrink-0 select-none">
          <div className="p-5 pb-2">
            <h1 className="text-xl font-bold tracking-tight text-[#1D1D1F] flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">S</span>
              Admin Console
            </h1>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-[#86868B] px-2 mb-2 uppercase tracking-wider">시스템 관리</div>
              <button onClick={() => { fetchGlobalStats(); setShowGlobalDashboard(true); }} className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 flex items-center gap-2 transition-colors">
                <Activity className="w-4 h-4" /> 통합 모니터링
              </button>
              <button onClick={() => setShowAdminPanel(true)} className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-indigo-700 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 flex items-center gap-2 transition-colors">
                <Users className="w-4 h-4" /> 유저 관리
              </button>
              <button onClick={() => setShowSettings(true)} className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-[#5C5B57] hover:bg-white border border-transparent hover:border-[#EAE6DF] flex items-center gap-2 transition-colors">
                <Settings className="w-4 h-4" /> 서버 설정
              </button>
            </div>

            <div className="space-y-1 pt-4 border-t border-[#EAE6DF]">
              <div className="flex items-center justify-between px-2 mb-2">
                <div className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider">미니 대화 기록</div>
                <button
                  onClick={handleCreateNewChat}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold transition-colors"
                >
                  <PlusCircle className="w-3 h-3 inline mr-0.5" />새 대화
                </button>
              </div>
              {chats.map(chat => (
                <div
                  key={chat.id}
                  onClick={() => setActiveChatId(chat.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium truncate cursor-pointer transition-colors ${activeChatId === chat.id ? "bg-white border border-[#EAE6DF] shadow-sm text-[#1D1D1F]" : "text-[#5C5B57] hover:bg-[#EAE6DF]/50"}`}
                >
                  <MessageSquare className="w-3.5 h-3.5 inline mr-1.5 opacity-70" />
                  {chat.title}
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 border-t border-[#EAE6DF] bg-white">
            <div className="flex items-center gap-2 p-1.5 rounded-lg bg-[#FAF9F6] border border-[#EAE6DF] mb-2">
              <div className="w-7 h-7 rounded-full bg-[#FAF9F6] border border-[#EAE6DF] flex items-center justify-center text-[#5C5B57] font-mono text-[11px] font-bold">A</div>
              <div className="truncate flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#1D1D1F] truncate">최고 운영자</p>
                <p className="text-[10px] text-[#86868B] font-mono truncate">@admin</p>
              </div>
            </div>
            <button onClick={handleLogout} className="w-full py-1.5 px-2 bg-[#FAF9F6] hover:bg-rose-50 border border-[#EAE6DF] hover:border-rose-200 rounded-lg text-[10px] font-medium text-[#5C5B57] hover:text-rose-700 flex items-center justify-center gap-1 transition-colors">
              <LogOut className="w-3 h-3" /> 로그아웃
            </button>
          </div>
        </aside>

        {/* 2. Admin Center Main (Global Dashboard Inline) */}
        <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-white border-r border-[#EAE6DF] p-6 relative">
          <div className="max-w-4xl mx-auto w-full space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-[#1D1D1F]">시스템 통합 모니터링</h2>
              <p className="text-sm text-[#86868B]">모든 사용자의 대화 통계 및 AI 리소스 사용 현황을 실시간으로 파악합니다.</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl text-white shadow-lg shadow-indigo-200">
                <Activity className="w-6 h-6 mb-3 opacity-80" />
                <p className="text-xs font-medium opacity-80">활성 엔진</p>
                <p className="text-lg font-bold truncate">{modelName || "Qwen 4B"}</p>
              </div>
              <div className="p-5 bg-white border border-[#EAE6DF] rounded-3xl shadow-sm">
                <Users className="w-6 h-6 mb-3 text-emerald-500" />
                <p className="text-xs font-medium text-[#86868B]">등록된 사용자</p>
                <p className="text-lg font-bold text-[#1D1D1F]">{globalStats?.users?.length || 0} 명</p>
              </div>
              <div className="p-5 bg-white border border-[#EAE6DF] rounded-3xl shadow-sm">
                <MessageSquare className="w-6 h-6 mb-3 text-blue-500" />
                <p className="text-xs font-medium text-[#86868B]">총 대화방 수</p>
                <p className="text-lg font-bold text-[#1D1D1F]">{globalStats?.users?.reduce((acc: any, u: any) => acc + u.totalChats, 0) || 0} 개</p>
              </div>
            </div>

            <div className="p-6 bg-[#FAF9F6] border border-[#EAE6DF] rounded-3xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#1D1D1F]">하이브리드 라우팅 및 할당량 관리</h3>
                  <p className="text-xs text-[#86868B]">유저당 하루에 허용할 프리미엄 GPT 호출 횟수를 설정합니다.</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hybridModeEnabled}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        setHybridModeEnabled(checked);
                        try {
                          await fetch("/api/lmstudio/config", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ hybridModeEnabled: checked, dailyGptQuota })
                          });
                          fetchGlobalStats();
                        } catch (err) { }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#EAE6DF] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="0" value={dailyGptQuota}
                      onChange={(e) => setDailyGptQuota(parseInt(e.target.value))}
                      className="w-20 p-2 bg-white border border-[#EAE6DF] rounded-xl text-sm text-center font-mono focus:border-emerald-400 focus:outline-none"
                    />
                    <button
                      onClick={async () => {
                        try {
                          await fetch("/api/lmstudio/config", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ dailyGptQuota, hybridModeEnabled })
                          });
                          alert("저장되었습니다!");
                          fetchGlobalStats();
                        } catch (err) { }
                      }}
                      className="px-4 py-2 bg-[#1D1D1F] hover:bg-black text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
                    >
                      저장
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#1D1D1F]">사용자별 일일 쿼터 소진 현황</h3>
                <button onClick={fetchGlobalStats} className="text-[10px] text-indigo-600 font-bold hover:underline">새로고침</button>
              </div>
              <div className="border border-[#EAE6DF] rounded-2xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF9F6] text-[#86868B] border-b border-[#EAE6DF]">
                    <tr>
                      <th className="p-3 font-semibold">유저</th>
                      <th className="p-3 font-semibold text-center">총 대화방</th>
                      <th className="p-3 font-semibold w-1/2">오늘 GPT 사용 현황 (한도: {globalStats?.settings?.dailyGptQuota || dailyGptQuota}회)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE6DF]">
                    {globalStats?.users?.map((u: any) => {
                      const quota = globalStats?.settings?.dailyGptQuota || dailyGptQuota || 3;
                      const usage = u.gptUsageCount || 0;
                      const percentage = Math.min((usage / quota) * 100, 100);
                      const isExhausted = usage >= quota;

                      return (
                        <tr key={u.id} className="hover:bg-[#FAF9F6] transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-[#1D1D1F]">{u.displayName}</div>
                            <div className="text-[10px] font-mono text-[#86868B]">@{u.username}</div>
                          </td>
                          <td className="p-3 text-center font-mono text-[#1D1D1F]">{u.totalChats}</td>
                          <td className="p-3">
                            {hybridModeEnabled ? (
                              <div className="space-y-1.5">
                                <div className="flex justify-between text-[10px] text-[#86868B] font-medium">
                                  <span>{usage} 회 사용</span>
                                  <span className={isExhausted ? "text-rose-500 font-bold" : ""}>
                                    {isExhausted ? "한도 초과" : `${quota - usage} 회 남음`}
                                  </span>
                                </div>
                                <div className="h-2 w-full bg-[#EAE6DF] rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-1000 ${isExhausted ? 'bg-rose-500' : 'bg-gradient-to-r from-emerald-400 to-emerald-500'}`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="text-[10px] text-[#B0ACA5] text-center">하이브리드 모드 꺼짐</div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Live Chat Monitoring Feed */}
            <div className="space-y-3 pt-6 border-t border-[#EAE6DF]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                    </span>
                    실시간 대화 모니터링
                  </h3>
                  <p className="text-[10px] text-[#86868B] mt-0.5">새로고침 없이 5초마다 최신 대화가 자동으로 업데이트됩니다.</p>
                </div>
                <div className="flex bg-[#EAE6DF] p-1 rounded-xl shadow-inner">
                  <button onClick={() => setMonitoringTab("rooms")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${monitoringTab === "rooms" ? "bg-white shadow-sm text-[#1D1D1F]" : "text-[#86868B] hover:text-[#5C5B57]"}`}>대화방 뷰</button>
                  <button onClick={() => setMonitoringTab("messages")} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${monitoringTab === "messages" ? "bg-white shadow-sm text-[#1D1D1F]" : "text-[#86868B] hover:text-[#5C5B57]"}`}>메시지 뷰</button>
                </div>
              </div>

              {monitoringTab === "rooms" ? (
                <>
                  <div className="space-y-8">
                    {Object.entries(
                      adminChats.reduce((acc: any, chat) => {
                        const lastMsgTime = chat.messages?.length > 0 ? chat.messages[chat.messages.length - 1].timestamp : chat.createdAt;
                        const date = new Date(lastMsgTime).toLocaleDateString();
                        if (!acc[date]) acc[date] = [];
                        acc[date].push(chat);
                        return acc;
                      }, {})
                    )
                    .sort((a: any, b: any) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
                    .map(([date, chatsArr]: any) => (
                      <div key={date} className="space-y-4">
                        <h4 className="text-sm font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg inline-block">{date}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {chatsArr
                            .sort((a: any, b: any) => {
                              const aTime = a.messages?.length > 0 ? a.messages[a.messages.length - 1].timestamp : a.createdAt;
                              const bTime = b.messages?.length > 0 ? b.messages[b.messages.length - 1].timestamp : b.createdAt;
                              return new Date(bTime).getTime() - new Date(aTime).getTime();
                            })
                            .map((chat: any) => {
                            const lastMsg = chat.messages?.length > 0 ? chat.messages[chat.messages.length - 1] : null;
                            const isApi = chat.title === "아두이노 소다봇 대화";
                            return (
                              <div 
                                key={chat.id} 
                                onClick={() => setMonitoringChatId(chat.id)}
                                className="bg-white border border-[#EAE6DF] hover:border-[#9C282C] rounded-2xl p-4 shadow-sm hover:shadow-[0_4px_16px_rgba(156,40,44,0.03)] transition-all cursor-pointer group flex flex-col justify-between"
                              >
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1.5 truncate max-w-[60%]">
                                      <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full truncate shrink-0">
                                        @{chat.username}
                                      </span>
                                      {isApi ? (
                                        <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[9px] font-bold rounded-md shrink-0">API</span>
                                      ) : (
                                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded-md shrink-0">WEB</span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-[#86868B] font-mono shrink-0">
                                      {lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                                    </span>
                                  </div>
                                  <h4 className="text-xs font-semibold text-[#1D1D1F] truncate pr-2 mb-2">{chat.title}</h4>
                                  <div className="text-[11px] text-[#5C5B57] line-clamp-3 leading-relaxed bg-[#FAF9F6] p-2 rounded-xl">
                                    {lastMsg ? (
                                      <div className="flex flex-col gap-1">
                                        <span className={lastMsg.sender === "user" ? "font-semibold" : ""}>
                                          {lastMsg.sender === "user" ? "U: " : "A: "}{lastMsg.text}
                                        </span>
                                        {lastMsg.modelUsed && <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded self-start truncate max-w-full">🤖 {lastMsg.modelUsed}</span>}
                                      </div>
                                    ) : (
                                      <span className="italic text-[#86868B]">아직 메시지가 없습니다.</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  {adminChats.length === 0 && (
                    <div className="text-center py-10 text-xs text-[#86868B] bg-[#FAF9F6] rounded-2xl border border-[#EAE6DF] border-dashed">
                      진행 중인 대화가 없습니다.
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white border border-[#EAE6DF] rounded-2xl shadow-sm h-[600px] overflow-y-auto flex flex-col">
                  {(() => {
                    const allMessages = adminChats.flatMap((chat: any) => 
                      (chat.messages || []).map((msg: any, index: number) => ({
                        ...msg,
                        chatId: chat.id,
                        chatTitle: chat.title,
                        username: chat.username,
                        isApi: chat.title === "아두이노 소다봇 대화",
                        msgIndex: index
                      }))
                    ).sort((a: any, b: any) => {
                      const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                      if (timeDiff !== 0) return timeDiff;
                      return b.msgIndex - a.msgIndex;
                    });

                    if (allMessages.length === 0) {
                      return (
                        <div className="m-auto text-center py-10 text-xs text-[#86868B]">
                          진행 중인 메시지가 없습니다.
                        </div>
                      )
                    }

                    return (
                      <div className="flex flex-col">
                        {allMessages.map((msg: any) => (
                          <div key={`${msg.chatId}-${msg.id}`} onClick={() => setMonitoringChatId(msg.chatId)} className="flex gap-4 p-4 hover:bg-[#FAF9F6] transition-colors border-b border-[#EAE6DF] cursor-pointer group">
                            <div className="shrink-0 w-12 text-center space-y-1">
                              <div className="text-[10px] font-bold text-gray-700 bg-gray-100 rounded-md py-0.5 px-1 truncate">@{msg.username}</div>
                              {msg.isApi ? (
                                <div className="text-[9px] font-bold text-orange-700 bg-orange-100 rounded">API</div>
                              ) : (
                                <div className="text-[9px] font-bold text-blue-700 bg-blue-100 rounded">WEB</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className={`text-xs font-bold ${msg.sender === "user" ? "text-[#1D1D1F]" : "text-[#9C282C]"}`}>
                                  {msg.sender === "user" ? "User" : "AI"}
                                </span>
                                <span className="text-[10px] text-[#86868B] font-mono group-hover:text-indigo-600 transition-colors">
                                  {new Date(msg.timestamp).toLocaleString()}
                                </span>
                                {msg.modelUsed && <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded ml-auto shrink-0">🤖 {msg.modelUsed}</span>}
                              </div>
                              <div className={`text-xs leading-relaxed whitespace-pre-wrap ${msg.sender === "user" ? "text-[#1D1D1F] font-medium" : "text-[#5C5B57]"}`}>
                                {msg.text}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

          </div>
        </main>

        {/* 3. Admin Right Sidebar (Mini Chat) */}
        <aside className="w-[340px] bg-[#FAF9F6] flex flex-col shrink-0 select-none">
          <header className="h-12 border-b border-[#EAE6DF] bg-white flex items-center justify-between px-4 shrink-0">
            <span className="text-xs font-bold text-[#1D1D1F]">미니 대화 테스트</span>
            <div className="flex items-center gap-1.5 text-[10px] text-[#86868B]">
              <span className={`w-1.5 h-1.5 rounded-full ${lmStudioConnected ? "bg-emerald-500" : "bg-rose-500"}`} />
              {lmStudioConnected ? "Connected" : "Offline"}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {(!activeChat || activeChat.messages.length === 0) ? (
              <div className="text-center py-10 opacity-50">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-[#86868B]" />
                <p className="text-xs text-[#86868B]">새로운 대화를 시작하세요.</p>
              </div>
            ) : (
              activeChat.messages.map((msg: any, i: number) => (
                <div key={i} className={`flex gap-2 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-[11px] leading-relaxed shadow-sm ${msg.sender === "user" ? "bg-indigo-600 text-white rounded-br-none" : "bg-white border border-[#EAE6DF] text-[#1D1D1F] rounded-bl-none"}`}>
                    {msg.text}
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="flex gap-2 justify-start">
                <div className="bg-white border border-[#EAE6DF] p-3 rounded-2xl rounded-bl-none shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-[#86868B] rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-[#86868B] rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                    <span className="w-1.5 h-1.5 bg-[#86868B] rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 bg-white border-t border-[#EAE6DF]">
            <form onSubmit={handleSendMessage} className="relative flex items-center">
              <input
                type="text"
                disabled={sending}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="테스트 메시지 입력..."
                className="w-full pl-3 pr-10 py-2.5 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-[11px] focus:outline-none focus:border-indigo-400"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || sending}
                className="absolute right-1.5 p-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-[#FAF9F6] text-white disabled:text-[#B0ACA5] rounded-lg transition-colors"
              >
                <Send className="w-3 h-3" />
              </button>
            </form>
          </div>
        </aside>

        {/* Modals for Admin */}
        {showAdminPanel && (
          <div className="fixed inset-0 bg-[#1D1D1F]/40 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in p-4">
            <div className="bg-white border border-[#EAE6DF] rounded-3xl w-full max-w-4xl shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[90vh]">
              {/* This points to the existing Admin Management Modal code */}
              <div className="flex items-center justify-between pb-4 border-b border-[#FAF9F6] shrink-0">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#1D1D1F]">운영자 유저 관리</h3>
                  <p className="text-xs text-[#86868B]">플랫폼의 모든 사용자를 관리하고 대화 기록을 조회합니다.</p>
                </div>
                <button onClick={() => setShowAdminPanel(false)} className="text-xs text-[#86868B] hover:text-[#1D1D1F] bg-[#FAF9F6] px-3 py-1.5 rounded-full">닫기 ✕</button>
              </div>
              <div className="flex-1 overflow-y-auto py-4 space-y-6">
                {/* User Table (Simplified from existing) */}
                <div className="border border-[#EAE6DF] rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9F6] text-[#86868B] border-b border-[#EAE6DF]">
                      <tr>
                        <th className="p-3 font-semibold">사용자 정보</th>
                        <th className="p-3 font-semibold">맞춤형 페르소나 설정 (System Prompt)</th>
                        <th className="p-3 font-semibold text-right">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAE6DF]">
                      {adminUsers.map(u => (
                        <tr key={u.id} className="hover:bg-indigo-50/30 transition-colors align-top">
                          <td className="p-3">
                            <div className="font-medium text-[#1D1D1F]">{u.displayName}</div>
                            <div className="font-mono text-[11px] text-[#86868B]">@{u.username}</div>
                            <div className="font-mono text-[10px] text-[#5C5B57] mt-1 pt-1 border-t border-[#EAE6DF] w-fit">Key: {u.personalApiKey || "발급 안됨"}</div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-2">
                              <textarea
                                defaultValue={u.persona || ""}
                                onBlur={(e) => {
                                  if (e.target.value !== u.persona) {
                                    handleUpdatePersona(u.id, e.target.value);
                                  }
                                }}
                                placeholder="예: 이 유저에게는 초등학생 말투로 설명하세요."
                                className="w-full h-20 p-2 bg-white border border-[#EAE6DF] rounded-xl text-[11px] focus:outline-none focus:border-indigo-400 resize-none"
                              />
                              <div className="text-[9px] text-[#86868B]">입력 후 영역 바깥을 클릭(포커스 해제)하면 자동 저장됩니다.</div>
                            </div>
                          </td>
                          <td className="p-3 text-right space-x-2 whitespace-nowrap">
                            <button onClick={() => handleGenerateApiKey(u.id)} className="px-2 py-1 bg-white border border-[#EAE6DF] hover:border-indigo-300 rounded-lg text-[10px]">Key 재발급</button>
                            {u.id !== "user-1" && (
                              <button onClick={() => handleDeleteUser(u.id)} className="px-2 py-1 bg-white border border-[#EAE6DF] text-rose-500 rounded-lg text-[10px]">삭제</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {showSettings && (
          <div className="fixed inset-0 bg-[#1D1D1F]/40 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in p-4">
            <div className="bg-white border border-[#EAE6DF] rounded-3xl w-full max-w-lg shadow-2xl p-6 relative flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-[#FAF9F6]">
                <h3 className="text-base font-bold text-[#1D1D1F]">서버 설정</h3>
                <button onClick={() => setShowSettings(false)} className="text-xs text-[#86868B] bg-[#FAF9F6] px-3 py-1.5 rounded-full">닫기 ✕</button>
              </div>
              <form onSubmit={handleSaveSettings} className="space-y-4 pt-4 overflow-y-auto max-h-[70vh]">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#1D1D1F]">기본 AI 제공자</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAiProvider("local")} className={`flex-1 py-2 rounded-xl text-xs border ${aiProvider === "local" ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-[#EAE6DF]"}`}>로컬 (LM Studio)</button>
                    <button type="button" onClick={() => setAiProvider("openai")} className={`flex-1 py-2 rounded-xl text-xs border ${aiProvider === "openai" ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-[#EAE6DF]"}`}>클라우드 (OpenAI)</button>
                  </div>
                </div>
                {aiProvider === "openai" && (
                  <input type="password" value={openaiApiKey} onChange={e => setOpenaiApiKey(e.target.value)} className="w-full p-3 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-xs" placeholder="OpenAI API Key" />
                )}
                <input type="text" value={lmStudioUrl} onChange={e => setLmStudioUrl(e.target.value)} className="w-full p-3 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-xs" placeholder="LM Studio URL" />
                <input type="text" value={modelName} onChange={e => setModelName(e.target.value)} className="w-full p-3 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-xs" placeholder="모델명" />

                <div className="flex justify-between pt-2">
                  <button type="button" onClick={handleTestSettingsConnection} className="px-4 py-2 border rounded-xl text-xs">{testingConnection ? "테스트 중..." : "테스트"}</button>
                  <button type="submit" className="px-4 py-2 bg-black text-white rounded-xl text-xs">저장</button>
                </div>
                {testMessage && <p className="text-[10px] text-indigo-600">{testMessage}</p>}
              </form>
            </div>
          </div>
        )}

        {/* Monitoring Chat Detail Modal */}
        {monitoringChatId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-[#EAE6DF] overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-[#EAE6DF] bg-[#FAF9F6]">
                <div>
                  <h3 className="text-lg font-bold text-[#1D1D1F]">대화 상세 내역</h3>
                  <p className="text-xs text-[#86868B]">실시간 모니터링 중입니다.</p>
                </div>
                <button onClick={() => setMonitoringChatId(null)} className="p-2 text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#EAE6DF] rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
                {adminChats.find(c => c.id === monitoringChatId)?.messages.map((msg: any) => (
                  <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed ${msg.sender === "user"
                        ? "bg-[#2A2927] text-white rounded-tr-sm"
                        : "bg-[#FAF9F6] border border-[#EAE6DF] text-[#1D1D1F] rounded-tl-sm"
                      }`}>
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                      <div className={`flex items-center justify-between text-[9px] mt-2 font-mono ${msg.sender === "user" ? "text-gray-400" : "text-[#86868B]"}`}>
                        <span>{new Date(msg.timestamp).toLocaleString()}</span>
                        {msg.modelUsed && <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded ml-2 truncate max-w-[120px]">🤖 {msg.modelUsed}</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {adminChats.find(c => c.id === monitoringChatId)?.messages.length === 0 && (
                  <div className="text-center text-xs text-[#86868B] py-10">메시지가 없습니다.</div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ===== NORMAL USER LAYOUT =====
  return (
    <div className="flex h-screen bg-[#FAF9F6] text-[#2A2927] overflow-hidden font-sans selection:bg-[#9C282C]/10 selection:text-[#9C282C]">

      {/* 1. Sidebar Panel (Apple/Notion Vibe Left Section) */}
      <aside className="w-64 border-r border-[#EAE6DF] bg-[#FAF9F6] flex flex-col justify-between shrink-0 h-screen select-none z-30">

        {/* Top Header */}
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2 px-1">
            <div className="w-8 h-8 rounded-xl bg-[#FAF9F6] border border-[#EAE6DF] flex items-center justify-center text-[#9C282C] shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">SODA TALK</h2>
              <button
                onClick={handleToggleProvider}
                className="flex items-center gap-1 text-[10px] text-[#86868B] hover:text-[#9C282C] font-mono tracking-wider transition-colors"
                title="클릭하여 AI 모드 전환 (Local / Cloud)"
              >
                {aiProvider === "openai" ? "☁️ CLOUD AI CORE" : "🖥️ LOCAL AI CORE"}
                <svg className="w-2.5 h-2.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
            </div>
          </div>

          {/* New Chat Button (Notion dotted style) */}
          <button
            id="new-chat-sidebar-btn"
            onClick={() => handleCreateNewChat()}
            className="w-full py-2 px-3 border border-dashed border-[#CFC9BF] hover:border-[#9C282C] bg-white rounded-xl text-xs font-medium text-[#5C5B57] hover:text-[#9C282C] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.02)] active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            새로운 대화 시작하기
          </button>
        </div>

        {/* Categories (New UI) */}
        <div className="px-3 pb-2 space-y-0.5">
          <button className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold bg-[#EAE6DF]/40 text-[#1D1D1F] flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5" /> 대화
          </button>
          <button className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-[#5C5B57] hover:bg-[#EAE6DF]/20 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" /> 아이디어
          </button>
          <button className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-[#5C5B57] hover:bg-[#EAE6DF]/20 flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5" /> 코드 & 분석
          </button>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 py-1 scrollbar-thin border-t border-[#EAE6DF] pt-3 mt-1">
          <div className="px-3 py-1 text-[10px] font-semibold text-[#86868B] uppercase tracking-wider font-mono">
            최근 대화 ({chats.length})
          </div>

          {chats.length === 0 ? (
            <div className="p-4 text-center text-[11px] text-[#B0ACA5] font-mono leading-relaxed">
              작성된 대화가 없습니다.<br />새 대화를 기동해 보세요.
            </div>
          ) : (
            chats.map((chat) => {
              const isActive = chat.id === activeChatId;
              return (
                <div
                  key={chat.id}
                  id={`chat-item-${chat.id}`}
                  onClick={() => setActiveChatId(chat.id)}
                  className={`group flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition-all ${isActive
                      ? "bg-white border border-[#EAE6DF] text-[#1D1D1F] font-semibold shadow-sm"
                      : "text-[#5C5B57] hover:bg-[#EAE6DF]/40 hover:text-[#1D1D1F]"
                    }`}
                >
                  <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-[#9C282C]" : "text-[#86868B]"}`} />
                    <span className="truncate">{chat.title}</span>
                  </div>

                  {/* Delete Button */}
                  <button
                    id={`delete-chat-btn-${chat.id}`}
                    onClick={(e) => handleDeleteChat(e, chat.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-[#9C282C] transition-opacity cursor-pointer rounded"
                    title="대화방 삭제"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* User Info & Quick Control Footer */}
        <div className="p-3 border-t border-[#EAE6DF] bg-white space-y-2">
          {/* User badge */}
          <div className="flex items-center gap-2 p-1.5 rounded-lg bg-[#FAF9F6] border border-[#EAE6DF]">
            <div className="w-7 h-7 rounded-full bg-[#FAF9F6] border border-[#EAE6DF] flex items-center justify-center text-[#5C5B57] font-mono text-[11px] font-bold">
              {user.displayName.substring(0, 1)}
            </div>
            <div className="truncate flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#1D1D1F] truncate">{user.displayName}</p>
              <p className="text-[10px] text-[#86868B] font-mono truncate">@{user.username}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-1.5 pt-0.5">
            <button
              id="sidebar-logout-btn"
              onClick={handleLogout}
              className="py-1.5 px-2 bg-[#FAF9F6] hover:bg-rose-50 border border-[#EAE6DF] hover:border-rose-200 rounded-lg text-[10px] font-medium text-[#5C5B57] hover:text-rose-700 flex items-center justify-center gap-1 cursor-pointer transition-colors"
            >
              <LogOut className="w-3 h-3" />
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Conversational Panel (Right Section) */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-white relative">
        {/* Apple style Minimal Header */}
        <header className="h-14 border-b border-[#EAE6DF] bg-white flex items-center justify-between px-6 shrink-0 z-10 select-none">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight font-mono">
              {activeChat ? activeChat.title : "새로운 대화"}
            </span>
            <span className="text-[#EAE6DF] text-sm">/</span>
            <div className="flex items-center gap-1.5 text-xs text-[#86868B]">
              <span className={`w-1.5 h-1.5 rounded-full ${lmStudioConnected ? "bg-emerald-500" : "bg-amber-500"}`} />
              <span className="font-mono text-[11px] text-[#5C5B57]">
                {lmStudioConnected ? "AI Engine Connected" : "AI Engine Standby"}
              </span>
            </div>
          </div>

          {/* Fallback Mode indicator */}
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${fallbackMode
                ? "bg-amber-50 border border-amber-100 text-amber-700"
                : "bg-emerald-50 border border-emerald-100 text-emerald-700"
              }`}>
              {fallbackMode ? "에뮬레이터 대기 상태" : "로컬 Direct 접속 전용"}
            </span>
          </div>
        </header>

        {/* Scrollable Conversation Arena */}
        <div className="flex-1 overflow-y-auto px-6 py-8 bg-[#FAF9F6]/50 relative">

          {/* Subtle elegant grid background lines */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#EAE6DF_1px,transparent_1px),linear-gradient(to_bottom,#EAE6DF_1px,transparent_1px)] bg-[size:5rem_5rem] opacity-20 pointer-events-none" />

          <div className="max-w-3xl mx-auto space-y-6 relative z-10 pb-8">

            {/* A. If no active chat or chat message is completely empty, render a beautifully designed welcome screen (Muji + Apple) */}
            {(!activeChat || activeChat.messages.length === 0) ? (
              <div className="py-12 space-y-8 animate-fade-in">

                {/* Visual Accent Title */}
                <div className="text-center space-y-3 max-w-lg mx-auto">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-white border border-[#EAE6DF] rounded-2xl text-[#9C282C] shadow-sm mb-1">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <h1 className="text-xl font-bold text-[#1D1D1F] tracking-tight">
                    안녕하세요, {user.displayName}님.
                  </h1>
                  <p className="text-xs text-[#86868B] leading-relaxed">
                    오늘 어떤 깊은 생각이나 질문을 안고 오셨나요? 정성스럽게 답변해 드릴게요.
                  </p>
                </div>

                {/* Grid Suggestions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                  {suggestionCards.map((card, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSendMessage(undefined, card.prompt)}
                      className="bg-white border border-[#EAE6DF] hover:border-[#9C282C] rounded-2xl p-4 shadow-sm hover:shadow-[0_4px_16px_rgba(156,40,44,0.03)] transition-all cursor-pointer text-left space-y-2 group active:scale-[0.99] hover:scale-[1.01]"
                    >
                      <h3 className="text-xs font-semibold text-[#1D1D1F] flex items-center justify-between">
                        {card.title}
                        <ArrowRight className="w-3.5 h-3.5 text-[#B0ACA5] group-hover:text-[#9C282C] transition-colors" />
                      </h3>
                      <p className="text-[11px] text-[#86868B] leading-normal">{card.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Connection Status Callout */}
                <div className="p-4 bg-white border border-[#EAE6DF] rounded-2xl flex items-start gap-3 text-xs text-[#5C5B57] leading-relaxed">
                  <Cpu className="w-4 h-4 text-[#9C282C] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[#1D1D1F]">안정적인 연동 지능 제공</span>
                    <p className="text-[11px] text-[#86868B] mt-0.5">
                      로컬 AI 엔진이 꺼져 있거나 접근 불가능할 시,
                      <strong>Gemini가 고도로 훈련된 Llama-3 가상 코어로 즉각 스왑</strong>되어 대화를 안전하게 완수합니다. 안심하고 사용하세요.
                    </p>
                  </div>
                </div>

              </div>
            ) : (

              /* B. Render actual message timeline */
              <div className="space-y-6 animate-fade-in">
                {activeChat.messages.map((msg) => {
                  const isUser = msg.sender === "user";
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isUser ? "justify-end" : "justify-start"} items-start gap-3`}
                    >
                      {/* Avatar for AI */}
                      {!isUser && (
                        <div className="w-8 h-8 rounded-xl bg-white border border-[#EAE6DF] flex items-center justify-center text-[#9C282C] shrink-0 shadow-sm font-bold font-mono text-xs">
                          M
                        </div>
                      )}

                      {/* Message Box */}
                      <div className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed ${isUser
                          ? "bg-[#2A2927] text-white rounded-tr-sm shadow-sm"
                          : "bg-white border border-[#EAE6DF] text-[#2A2927] rounded-tl-sm shadow-sm space-y-2"
                        }`}>

                        {/* Message Text */}
                        <div className="whitespace-pre-wrap font-sans break-words antialiased">
                          {msg.text}
                        </div>

                        {/* Timestamp & Model */}
                        <div className="flex items-center justify-between text-[10px] text-[#86868B] font-mono border-t border-[#FAF9F6] pt-1.5 mt-2">
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {msg.modelUsed && <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded ml-2 truncate max-w-[120px]">🤖 {msg.modelUsed}</span>}
                        </div>
                      </div>

                      {/* Avatar for User */}
                      {isUser && (
                        <div className="w-8 h-8 rounded-xl bg-[#FAF9F6] border border-[#EAE6DF] flex items-center justify-center text-[#5C5B57] shrink-0 font-bold font-mono text-[10px]">
                          {user.displayName.substring(0, 1)}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Typing Loading Indicator */}
                {sending && (
                  <div className="flex justify-start items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white border border-[#EAE6DF] flex items-center justify-center text-[#9C282C] shrink-0 shadow-sm animate-pulse font-bold font-mono text-xs">
                      M
                    </div>
                    <div className="bg-white border border-[#EAE6DF] rounded-2xl p-4 text-xs text-[#86868B] font-mono leading-relaxed shadow-sm flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#9C282C]" />
                      <span>추론을 진행하고 있습니다. 잠시만 기다려 주세요...</span>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            )}

          </div>
        </div>

        {/* C. Bottom Input Area (ChatGPT Style Bar) */}
        <div className="p-4 border-t border-[#EAE6DF] bg-white z-10">
          <div className="max-w-3xl mx-auto space-y-2">

            <form onSubmit={handleSendMessage} className="relative flex items-center">
              <input
                id="main-chat-input"
                type="text"
                required
                disabled={sending}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={sending ? "AI 응답을 안전하게 기다리고 있습니다..." : "비서에게 질문을 남겨보세요... (Shift + Enter 줄바꿈)"}
                className="w-full pl-4 pr-12 py-3.5 bg-[#FAF9F6] border border-[#EAE6DF] focus:border-[#2A2927] rounded-2xl text-xs font-sans focus:outline-none transition-all placeholder:text-[#B0ACA5] shadow-inner"
              />

              <button
                id="send-message-btn"
                type="submit"
                disabled={!inputText.trim() || sending}
                className="absolute right-2 p-2 bg-[#2A2927] hover:bg-[#9C282C] disabled:bg-[#FAF9F6] text-white disabled:text-[#B0ACA5] rounded-xl transition-all cursor-pointer shadow-sm"
                title="메시지 보내기"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

            {/* Subtle footer credit notes */}
            <div className="flex justify-between items-center text-[10px] text-[#86868B] font-mono select-none px-1">
              <span>SODA TALK AI Assistant</span>
              <span>입력 완료 후 엔터를 누르면 전송됩니다.</span>
            </div>
          </div>
        </div>
      </main>

      {/* 3. Right Dashboard Panel */}
      <aside className="w-[320px] border-l border-[#EAE6DF] bg-white p-5 flex flex-col gap-6 overflow-y-auto shrink-0 select-none scrollbar-thin">

        {/* Header: AI 엔진 선택 */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-[#86868B] font-semibold">AI 엔진 선택</span>
            <button className="w-6 h-6 flex items-center justify-center rounded-full border border-[#EAE6DF] hover:bg-[#FAF9F6] text-[#5C5B57] transition-colors">
              <Sun className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1 cursor-pointer">
            <span className="text-sm font-bold text-[#1D1D1F]">자동 (로컬 우선)</span>
            <ChevronDown className="w-4 h-4 text-[#86868B]" />
          </div>
        </div>

        {/* 현재 사용 엔진 카드 */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#1D1D1F]">현재 사용 엔진</h3>

          <div className="p-4 bg-white border border-[#EAE6DF] rounded-2xl shadow-sm space-y-4">

            {/* Local Engine */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#FAF9F6] border border-[#EAE6DF] flex items-center justify-center text-[#1D1D1F]">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#1D1D1F]">로컬 엔진 {aiProvider === 'local' ? '(메인)' : '(백업)'}</div>
                    <div className="text-[10px] text-[#86868B]">모델: {modelName || "Qwen 4B (GGUF)"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${lmStudioConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                  <span className={`text-[10px] font-semibold ${lmStudioConnected ? 'text-emerald-600' : 'text-rose-600'}`}>{lmStudioConnected ? '실행 중' : '오프라인'}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-[#86868B]">
                  <span>메모리 사용량</span>
                  <span>{memUsedGB}GB / {memTotalGB}GB</span>
                </div>
                <div className="h-1.5 w-full bg-[#FAF9F6] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-1000"
                    style={{ width: `${memPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-[#EAE6DF] border-dashed pt-4" />

            {/* OpenAI Cloud */}
            <div className={`space-y-2 transition-opacity ${aiProvider === 'openai' || hybridModeEnabled ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#FAF9F6] border border-[#EAE6DF] flex items-center justify-center text-[#1D1D1F]">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#1D1D1F]">OpenAI API {aiProvider === 'openai' ? '(메인)' : hybridModeEnabled ? '(하이브리드)' : '(백업)'}</div>
                    <div className="text-[10px] text-[#86868B]">모델: gpt-4o-mini</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-[10px] font-semibold text-emerald-600">연결됨</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-[#86868B]">
                  <span>요청 한도</span>
                  <span>{openaiUsed.toLocaleString()} / {openaiLimit.toLocaleString()}</span>
                </div>
                <div className="h-1.5 w-full bg-[#FAF9F6] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-indigo-400 transition-all duration-1000"
                    style={{ width: `${openaiPercent}%` }}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* 대화 설정 */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold text-[#1D1D1F]">대화 설정</h3>
          <div className="p-4 bg-[#FAF9F6]/50 border border-[#EAE6DF] rounded-2xl space-y-4">

            <div className="flex justify-between items-center gap-4">
              <span className="text-[11px] font-medium text-[#5C5B57] shrink-0">응답 창의성</span>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="range"
                  min="0" max="1" step="0.1"
                  value={temperature}
                  onChange={(e) => {
                    setTemperature(parseFloat(e.target.value));
                    // Optional: save on blur or debounce
                  }}
                  className="w-full h-1.5 bg-[#EAE6DF] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <span className="text-[11px] font-mono text-[#1D1D1F] w-4">{temperature}</span>
              </div>
            </div>

            <div className="flex justify-between items-center gap-4">
              <span className="text-[11px] font-medium text-[#5C5B57] shrink-0">최대 응답 길이</span>
              <select
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="bg-white border border-[#EAE6DF] rounded-lg text-[11px] px-2 py-1.5 focus:outline-none flex-1 text-[#1D1D1F]"
              >
                <option value={512}>512 토큰</option>
                <option value={1024}>1024 토큰</option>
                <option value={2048}>2048 토큰</option>
              </select>
            </div>

            <div className="flex justify-between items-center gap-4">
              <span className="text-[11px] font-medium text-[#5C5B57] shrink-0">언어</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-white border border-[#EAE6DF] rounded-lg text-[11px] px-2 py-1.5 focus:outline-none flex-1 text-[#1D1D1F]"
              >
                <option value="Korean">한국어</option>
                <option value="English">English</option>
              </select>
            </div>

          </div>
        </div>

        {/* 추천 프롬프트 */}
        <div className="space-y-3 pt-2 pb-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-[#1D1D1F]">추천 프롬프트</h3>
            <RefreshCw className="w-3.5 h-3.5 text-[#86868B] cursor-pointer hover:text-[#1D1D1F]" />
          </div>
          <div className="space-y-1.5">
            {[
              { icon: FileText, text: "이 문서 요약해줘" },
              { icon: Sparkles, text: "더 나은 제목을 제안해줘" },
              { icon: Cpu, text: "코드 오류를 찾아줘" },
              { icon: Zap, text: "마케팅 아이디어 5가지 제안해줘" },
            ].map((p, i) => (
              <div key={i} onClick={() => setInputText(p.text)} className="flex items-center gap-2 text-[11px] text-[#5C5B57] p-2 rounded-lg hover:bg-[#FAF9F6] cursor-pointer transition-colors border border-transparent hover:border-[#EAE6DF]">
                <p.icon className="w-3.5 h-3.5 opacity-70" />
                <span>{p.text}</span>
              </div>
            ))}
          </div>
        </div>

      </aside>


      {/* 4. Admin User Management Drawer/Modal */}
      {showAdminPanel && (
        <div className="fixed inset-0 bg-[#1D1D1F]/40 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in p-4">
          <div className="bg-white border border-[#EAE6DF] rounded-3xl w-full max-w-4xl shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#FAF9F6] shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-[#1D1D1F]">시스템 유저 및 API Key 관리 (운영자 전용)</h3>
              </div>
              <button
                onClick={() => setShowAdminPanel(false)}
                className="text-xs text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer font-semibold bg-[#FAF9F6] px-3 py-1.5 rounded-full"
              >
                닫기 ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-6 scrollbar-thin pr-2">

              {adminSelectedUserStatsId && adminUserStats ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setAdminSelectedUserStatsId(null)} className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md font-semibold hover:bg-indigo-100 transition-colors">
                      ← 뒤로 가기
                    </button>
                    <h4 className="text-sm font-bold text-[#1D1D1F]">
                      {adminUserStats.user.displayName} (@{adminUserStats.user.username}) 대시보드
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-[#FAF9F6] border border-[#EAE6DF] rounded-2xl flex flex-col items-center justify-center gap-1">
                      <span className="text-xs font-bold text-[#86868B]">총 대화방 수</span>
                      <span className="text-2xl font-bold text-[#1D1D1F]">{adminUserStats.stats.totalChats}</span>
                    </div>
                    <div className="p-4 bg-[#FAF9F6] border border-[#EAE6DF] rounded-2xl flex flex-col items-center justify-center gap-1">
                      <span className="text-xs font-bold text-[#86868B]">총 메시지 교환 수</span>
                      <span className="text-2xl font-bold text-[#1D1D1F]">{adminUserStats.stats.totalMessages}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-white border border-[#EAE6DF] rounded-2xl space-y-3">
                    <h5 className="text-xs font-bold text-[#1D1D1F]">오늘의 인공지능 사용 현황</h5>
                    {adminUserStats.settings.hybridModeEnabled ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-[#86868B] font-medium">
                          <span>GPT 할당량 소진</span>
                          <span>{adminUserStats.user.gptUsageCount} / {adminUserStats.settings.dailyGptQuota} 회</span>
                        </div>
                        <div className="h-2 w-full bg-[#FAF9F6] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-1000"
                            style={{ width: `${Math.min((adminUserStats.user.gptUsageCount / adminUserStats.settings.dailyGptQuota) * 100, 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-[#86868B] mt-1">
                          할당량 소진 후에는 자동으로 무제한 무료 로컬 모델(LM Studio)로 연결됩니다.
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-[#86868B]">하이브리드 모드가 비활성화되어 있습니다.</p>
                    )}
                  </div>
                </div>
              ) : adminSelectedUserId ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <button onClick={() => setAdminSelectedUserId(null)} className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md font-semibold hover:bg-indigo-100 transition-colors">
                      ← 뒤로 가기
                    </button>
                    <h4 className="text-sm font-bold text-[#1D1D1F]">
                      {adminUsers.find(u => u.id === adminSelectedUserId)?.displayName} 님의 대화 기록
                    </h4>
                  </div>
                  {adminChats.filter(c => c.userId === adminSelectedUserId).length === 0 ? (
                    <div className="text-center py-8 text-[#86868B] text-xs">대화 기록이 없습니다.</div>
                  ) : (
                    <div className="space-y-4">
                      {adminChats.filter(c => c.userId === adminSelectedUserId).map(chat => (
                        <div key={chat.id} className="border border-[#EAE6DF] rounded-xl overflow-hidden bg-white">
                          <div className="bg-[#FAF9F6] px-3 py-2 border-b border-[#EAE6DF] flex justify-between items-center">
                            <span className="text-xs font-bold text-[#1D1D1F]">{chat.title}</span>
                            <span className="text-[10px] text-[#86868B]">{new Date(chat.createdAt).toLocaleString()}</span>
                          </div>
                          <div className="p-3 space-y-3 max-h-60 overflow-y-auto scrollbar-thin">
                            {chat.messages.map((m: any) => (
                              <div key={m.id} className={`flex ${m.sender === 'user' || m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${m.sender === 'user' || m.role === 'user' ? 'bg-indigo-50 text-indigo-900' : 'bg-[#F5F5F7] text-[#1D1D1F]'}`}>
                                  <div className="font-semibold text-[10px] mb-1 opacity-60">
                                    {m.sender === 'user' || m.role === 'user' ? 'User' : 'Assistant'}
                                  </div>
                                  <div className="whitespace-pre-wrap">{m.text || m.content}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* User List Table */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-[#1D1D1F]">등록된 사용자 목록</h4>
                    <div className="border border-[#EAE6DF] rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#FAF9F6] text-[#86868B] border-b border-[#EAE6DF]">
                          <tr>
                            <th className="p-3 font-semibold">ID (계정)</th>
                            <th className="p-3 font-semibold">이름</th>
                            <th className="p-3 font-semibold">API Key</th>
                            <th className="p-3 font-semibold text-right">관리 액션</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EAE6DF] text-[#1D1D1F]">
                          {adminUsers.map(u => (
                            <tr key={u.id} className="hover:bg-indigo-50/30 transition-colors">
                              <td className="p-3 font-mono text-[11px] font-semibold">{u.username}</td>
                              <td className="p-3 font-medium">{u.displayName}</td>
                              <td className="p-3 font-mono text-[10px] text-[#5C5B57]">
                                {u.personalApiKey ? (
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md select-all">
                                      {u.personalApiKey}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[#B0ACA5]">발급 안됨</span>
                                )}
                              </td>
                              <td className="p-3 text-right space-x-2">
                                <button
                                  onClick={() => handleGenerateApiKey(u.id)}
                                  className="px-2.5 py-1.5 bg-white border border-[#EAE6DF] hover:border-indigo-300 hover:text-indigo-600 rounded-lg text-[10px] font-medium transition-colors inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Key className="w-3 h-3" /> Key 재발급
                                </button>
                                <button
                                  onClick={() => fetchUserStats(u.id)}
                                  className="px-2.5 py-1.5 bg-white border border-[#EAE6DF] hover:border-emerald-300 hover:text-emerald-600 text-emerald-600 rounded-lg text-[10px] font-medium transition-colors inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Activity className="w-3 h-3" /> 대시보드
                                </button>
                                <button
                                  onClick={() => setAdminSelectedUserId(u.id)}
                                  className="px-2.5 py-1.5 bg-white border border-[#EAE6DF] hover:border-blue-300 hover:text-blue-600 text-blue-500 rounded-lg text-[10px] font-medium transition-colors inline-flex items-center gap-1 cursor-pointer"
                                >
                                  대화 보기
                                </button>
                                {u.id !== "user-1" && (
                                  <button
                                    onClick={() => handleDeleteUser(u.id)}
                                    className="px-2.5 py-1.5 bg-white border border-[#EAE6DF] hover:border-rose-300 hover:text-rose-600 text-rose-500 rounded-lg text-[10px] font-medium transition-colors inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" /> 삭제
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Create User Form */}
                  <div className="space-y-3 pt-4 border-t border-[#EAE6DF] border-dashed">
                    <h4 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-1.5">
                      <PlusCircle className="w-4 h-4 text-indigo-500" /> 신규 사용자 강제 생성
                    </h4>

                    <form onSubmit={handleCreateUser} className="bg-[#FAF9F6] p-4 rounded-2xl border border-[#EAE6DF] space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-[#5C5B57]">로그인 ID</label>
                          <input
                            required value={newUsername} onChange={e => setNewUsername(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-[#EAE6DF] rounded-xl focus:outline-none focus:border-indigo-400 font-mono" placeholder="예: aiden"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-[#5C5B57]">표시 이름</label>
                          <input
                            required value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-[#EAE6DF] rounded-xl focus:outline-none focus:border-indigo-400" placeholder="예: 에이든"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-[#5C5B57]">초기 비밀번호</label>
                          <input
                            type="text" required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-[#EAE6DF] rounded-xl focus:outline-none focus:border-indigo-400 font-mono" placeholder="password123"
                          />
                        </div>
                      </div>

                      {adminError && <p className="text-xs text-rose-500 font-medium">{adminError}</p>}

                      <div className="flex justify-end">
                        <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm cursor-pointer">
                          사용자 등록
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}


      {/* 5. Server Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-[#1D1D1F]/40 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in p-4">
          <div className="bg-white border border-[#EAE6DF] rounded-3xl w-full max-w-lg shadow-2xl p-6 relative overflow-hidden flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-[#FAF9F6] shrink-0">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#1D1D1F]">서버 설정 (운영자 전용)</h3>
                <p className="text-xs text-[#86868B]">AI 엔진 라우팅 및 전역 설정을 변경합니다.</p>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="text-xs text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer font-semibold bg-[#FAF9F6] px-3 py-1.5 rounded-full"
              >
                닫기 ✕
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-5 pt-4 overflow-y-auto max-h-[70vh] pr-2 scrollbar-thin">
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#1D1D1F]">기본 AI 제공자</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAiProvider("local")} className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${aiProvider === "local" ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-[#EAE6DF] text-[#5C5B57] hover:bg-[#FAF9F6]"}`}>
                    LM Studio (로컬)
                  </button>
                  <button type="button" onClick={() => setAiProvider("openai")} className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${aiProvider === "openai" ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-[#EAE6DF] text-[#5C5B57] hover:bg-[#FAF9F6]"}`}>
                    OpenAI (클라우드)
                  </button>
                </div>
              </div>

              {aiProvider === "openai" && (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-xs font-bold text-[#1D1D1F]">OpenAI API Key</label>
                  <input type="password" value={openaiApiKey} onChange={e => setOpenaiApiKey(e.target.value)} className="w-full p-3 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-xs font-mono focus:border-indigo-400 focus:outline-none" placeholder="sk-..." />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#1D1D1F]">LM Studio URL</label>
                <input type="text" value={lmStudioUrl} onChange={e => setLmStudioUrl(e.target.value)} className="w-full p-3 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-xs font-mono focus:border-indigo-400 focus:outline-none" placeholder="https://granular-kindly-morally.ngrok-free.dev" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#1D1D1F]">모델 식별자 (Model Name)</label>
                <input type="text" value={modelName} onChange={e => setModelName(e.target.value)} className="w-full p-3 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-xs focus:border-indigo-400 focus:outline-none" placeholder="llama-3-korean-bllossom-8b" />
              </div>

              <div className="flex items-center justify-between p-3 border border-[#EAE6DF] rounded-xl bg-[#FAF9F6]">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-[#1D1D1F]">가상 에뮬레이터 모드 (Fallback)</p>
                  <p className="text-[10px] text-[#86868B]">엔진 오프라인 시 임시 더미 응답으로 대체합니다.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={fallbackMode} onChange={e => setFallbackMode(e.target.checked)} className="sr-only peer" />
                  <div className="w-9 h-5 bg-[#EAE6DF] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                </label>
              </div>

              <div className="space-y-3 pt-4 border-t border-[#EAE6DF] border-dashed">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-[#1D1D1F]">하이브리드 라우팅 모드 (비용 절감)</p>
                    <p className="text-[10px] text-[#86868B]">매일 첫 접속 몇 번은 GPT로, 이후엔 로컬 모델로 자동 전환합니다.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={hybridModeEnabled} onChange={e => setHybridModeEnabled(e.target.checked)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-[#EAE6DF] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                {hybridModeEnabled && (
                  <div className="space-y-2 animate-fade-in pl-2 border-l-2 border-emerald-500">
                    <label className="text-xs font-bold text-[#1D1D1F]">하루 무료 제공 GPT 횟수 (Daily Quota)</label>
                    <input type="number" min="0" value={dailyGptQuota} onChange={e => setDailyGptQuota(parseInt(e.target.value))} className="w-full p-2 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-xs focus:border-emerald-400 focus:outline-none" />
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                <button type="button" onClick={handleTestSettingsConnection} disabled={testingConnection} className="px-4 py-2 bg-white border border-[#EAE6DF] hover:bg-[#FAF9F6] rounded-xl text-xs font-semibold text-[#5C5B57] transition-colors">
                  {testingConnection ? "연결 테스트 중..." : "연결 테스트"}
                </button>
                <button type="submit" className="px-5 py-2 bg-[#1D1D1F] hover:bg-black text-white rounded-xl text-xs font-semibold transition-colors shadow-md">
                  설정 저장
                </button>
              </div>
              {testMessage && <p className="text-[10px] text-indigo-600 font-mono mt-2">{testMessage}</p>}
            </form>
          </div>
        </div>
      )}

    </div>
  );
}