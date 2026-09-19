import { sodabotTransport } from './utils/sodabotTransport';
import { renderTextToBitmapPayload } from './utils/textBitmapRenderer';
import React, { useState, useEffect, useRef } from "react";
import AuthScreen from "./components/AuthScreen";
import SodabotConnectScreen from "./components/SodabotConnectScreen";
import SodabotSettingsScreen from "./components/SodabotSettingsScreen";
import SodaAiLabScreen from "./components/SodaAiLabScreen";
import DevCodeHubScreen from "./components/DevCodeHubScreen";
import AdminCourseManagerModal from "./components/AdminCourseManagerModal";
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
  ChevronRight,
  FileText,
  Zap,
  Users,
  Key,
  PlusCircle,
  Activity,
  Bluetooth,
  Smile,
  CheckCircle2,
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  Image as ImageIcon,
  Library,
  Usb,
  Folder,
  FolderOpen,
  FolderCode,
  FileCode,
  Palette
} from "lucide-react";
import { ChatRoom, Message, LMStudioConfig, CourseContent } from "./types";

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("authSessionId"));
  const [user, setUser] = useState<{ id: string; username: string; displayName: string; role?: string; canAccessChat?: boolean; personalApiKey?: string } | null>(null);

  // Main Navigation Tab: 'dev' (수업 & 펌웨어 개발실) vs 'chat' (소다봇 제어 & AI 코딩)
  const [mainNavTab, setMainNavTab] = useState<'dev' | 'chat'>('dev');

  // Dev Code Hub Tree States
  const [courseContents, setCourseContents] = useState<CourseContent[]>([]);
  const [expandedWeeks, setExpandedWeeks] = useState<number[]>([1]);
  const [selectedDevCodeId, setSelectedDevCodeId] = useState<string>("content-week-1-sound");

  // Load course contents on mount
  useEffect(() => {
    fetch("/api/course-contents")
      .then(res => res.json())
      .then(data => {
        if (data.contents && data.contents.length > 0) {
          setCourseContents(data.contents);
          setSelectedDevCodeId(data.contents[0].id);
        }
      })
      .catch(console.error);
  }, []);

  // Admin Course Manager Modal State
  const [showCourseManager, setShowCourseManager] = useState(false);

  // Core Data States
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'chat' | 'sodabot' | 'settings' | 'sodabot_builder'>('sodabot');
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);

  // Real Hardware Connection States
  const [sodabotIp, setSodabotIp] = useState<string | null>(localStorage.getItem("sodabot_robot_ip"));
  const [connType, setConnType] = useState<'none' | 'wifi' | 'serial' | 'ble'>(sodabotTransport.type);
  const [isVerifying, setIsVerifying] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [serialPort, setSerialPort] = useState<any>(null);
  const [manualIpInput, setManualIpInput] = useState("");
  const [quickExprToast, setQuickExprToast] = useState<string | null>(null);

  const isSodabotConnected = connType !== 'none';

  // 1. Verify WebSocket Live Ping
  const verifyWifiConnection = async (ipToCheck?: string | null) => {
    const ip = ipToCheck || sodabotIp || localStorage.getItem('sodabot_robot_ip');
    if (!ip) return;
    setIsVerifying(true); setConnectionError(null);
    try {
      await sodabotTransport.connectWifi(ip);
      await sodabotTransport.send('get_status');
      setSodabotIp(ip);
    } catch (error: any) { setConnectionError(error.message); }
    finally { setIsVerifying(false); setConnType(sodabotTransport.type); }
  };

  // 2. Connect via Web Serial (Direct USB Cable)
  const connectSerial = async () => {
    if (!("serial" in navigator)) {
      alert("현재 브라우저는 Web Serial을 지원하지 않습니다. Chrome 최신 버전을 사용해 주세요.");
      return;
    }
    try {
      setIsVerifying(true);
      setConnectionError(null);
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      setSerialPort(port);
      void sodabotTransport.attachSerial(port).catch(error => setConnectionError(error.message));
      setConnType('serial');
      setIsVerifying(false);
      setQuickExprToast("USB 시리얼 연결 성공!");
      setTimeout(() => setQuickExprToast(null), 2500);
    } catch (err: any) {
      setIsVerifying(false);
      if (err.name !== "NotFoundError") {
        setConnectionError(`시리얼 연결 실패: ${err.message}`);
      }
    }
  };

  // 3. Send Hardware Command over Active Link (Serial or WebSocket)
  const sendHardwareCommand = async (action: string, value: string, label?: string, extra: Record<string, unknown> = {}) => {
    try {
      await sodabotTransport.send(action, value, extra);
      setConnectionError(null);
      setQuickExprToast(`${label || "명령"} · 소다봇 처리 완료`); setTimeout(() => setQuickExprToast(null), 4000);
    } catch (error: any) {
      setConnectionError(error.message);
      setQuickExprToast(error.message);
      setTimeout(() => setQuickExprToast(null), 5000);
    }
    setConnType(sodabotTransport.type);
  };

  // Global listener for sodabot-send-command
  useEffect(() => {
    const handleCommandEvent = (e: any) => {
      if (e.detail) {
        const { action, value, label, ...extra } = e.detail;
        sendHardwareCommand(action, value, label, extra);
      }
    };
    window.addEventListener("sodabot-send-command", handleCommandEvent);
    return () => {
      window.removeEventListener("sodabot-send-command", handleCommandEvent);
    };
  }, [connType, serialPort, sodabotIp]);

  // 4. Disconnect Sodabot
  const handleDisconnectSodabot = () => {
    if (confirm("소다봇 연결을 해제하시겠습니까?")) {
      sodabotTransport.disconnect();
      setSerialPort(null);
      localStorage.removeItem("sodabot_robot_ip");
      setSodabotIp(null);
      setConnType('none');
      setConnectionError(null);
      window.dispatchEvent(new Event("sodabot-status-changed"));
      setCurrentView('sodabot');
    }
  };

  // 5. Manual IP Direct Connect
  const handleManualIpConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIpInput.trim()) return;
    const ip = manualIpInput.trim();
    setManualIpInput("");
    verifyWifiConnection(ip);
  };

  // Listen for storage / status events
  useEffect(() => {
    const handleStatus = () => {
      const savedIp = localStorage.getItem("sodabot_robot_ip");
      setSodabotIp(savedIp);
      setConnType(sodabotTransport.type);
    };
    window.addEventListener("sodabot-status-changed", handleStatus);
    window.addEventListener("storage", handleStatus);
    handleStatus();
    return () => {
      window.removeEventListener("sodabot-status-changed", handleStatus);
      window.removeEventListener("storage", handleStatus);
    };
  }, [serialPort]);

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

  const handleToggleChatPermission = async (userId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/permission`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ canAccessChat: !currentStatus })
      });
      if (res.ok) {
        fetchAdminUsers();
      }
    } catch (err) {
      console.error("Failed to update permission", err);
    }
  };

  const handleBatchToggleChatPermission = async (canAccessChat: boolean) => {
    try {
      const res = await fetch("/api/admin/users/batch-permission", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ canAccessChat })
      });
      if (res.ok) {
        fetchAdminUsers();
      }
    } catch (err) {
      console.error("Failed to batch update permissions", err);
    }
  };

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
    let interval: any;
    if (user?.username === "admin") {
      fetchAdminChats(); // 최초 1회 실행
      fetchGlobalStats(); // 대시보드 통계 최초 1회 실행
      interval = setInterval(() => {
        fetchAdminChats();
        fetchGlobalStats();
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
      // 일반 학생 유저의 경우 선생님이 권한을 부여했을 때 실시간 반영을 위해 주기적 동기화
      const interval = setInterval(() => {
        verifySession(token);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [token]);

  // 2. Fetch data once logged in
  useEffect(() => {
    if (user) {
      if (user.username === "admin") {
        setMainNavTab("chat");
      } else if (!user.canAccessChat) {
        setMainNavTab("dev");
      }
      fetchChats();
      fetchLMStudioConfig();
    }
  }, [user?.id]);

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
              <button onClick={() => { setMainNavTab("chat"); fetchGlobalStats(); setShowGlobalDashboard(true); }} className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 flex items-center gap-2 transition-colors cursor-pointer">
                <Activity className="w-4 h-4" /> 통합 모니터링
              </button>
              <button onClick={() => setShowAdminPanel(true)} className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-indigo-700 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 flex items-center gap-2 transition-colors cursor-pointer">
                <Users className="w-4 h-4" /> 유저 및 권한 관리
              </button>
              <button onClick={() => setShowCourseManager(true)} className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-200 flex items-center gap-2 transition-colors cursor-pointer">
                <FolderCode className="w-4 h-4 text-blue-600" /> 주차별 컨텐츠 관리
              </button>
              <button onClick={() => setShowSettings(true)} className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-[#5C5B57] hover:bg-white border border-transparent hover:border-[#EAE6DF] flex items-center gap-2 transition-colors cursor-pointer">
                <Settings className="w-4 h-4" /> 서버 설정
              </button>
            </div>

            <div className="space-y-1 pt-4 border-t border-[#EAE6DF]">
              <div className="text-[10px] font-bold text-[#86868B] px-2 mb-2 uppercase tracking-wider">개발 & 하드웨어 도구</div>
              <button
                onClick={() => { setMainNavTab("ide"); }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-indigo-700 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-500" /> Web Arduino IDE
              </button>
              <button
                onClick={() => { setMainNavTab("dev"); }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-[#5C5B57] hover:bg-white border border-transparent hover:border-[#EAE6DF] flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Library className="w-4 h-4 text-indigo-500" /> 수업 자료실 뷰
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

        {/* 2. Admin Center Main (Global Dashboard or Dev Hub) */}
        {mainNavTab === "dev" ? (
          <div className="flex-1 flex flex-col h-screen overflow-hidden">
            <DevCodeHubScreen
              selectedCodeId={selectedDevCodeId}
              onSelectCode={setSelectedDevCodeId}
            />
          </div>
        ) : (
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
        )}

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
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#FAF9F6] shrink-0">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#1D1D1F] flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    운영자 유저 및 실시간 대화 권한 관리
                  </h3>
                  <p className="text-xs text-[#86868B]">수업 진행 시 학생들의 대화 탭 잠금을 해제하거나 개별 권한을 부여할 수 있습니다.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleBatchToggleChatPermission(true)}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    전체 대화 오픈 (ON)
                  </button>
                  <button
                    onClick={() => handleBatchToggleChatPermission(false)}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    전체 대화 잠금 (OFF)
                  </button>
                  <button onClick={() => setShowAdminPanel(false)} className="text-xs text-[#86868B] hover:text-[#1D1D1F] bg-[#FAF9F6] px-3 py-1.5 rounded-full cursor-pointer">닫기 ✕</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto py-4 space-y-6">
                {/* User Table */}
                <div className="border border-[#EAE6DF] rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9F6] text-[#86868B] border-b border-[#EAE6DF]">
                      <tr>
                        <th className="p-3 font-semibold">사용자 정보</th>
                        <th className="p-3 font-semibold text-center">대화 권한 (수업 제어)</th>
                        <th className="p-3 font-semibold">맞춤형 페르소나 설정 (System Prompt)</th>
                        <th className="p-3 font-semibold text-right">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAE6DF]">
                      {adminUsers.map(u => {
                        const isUserAdmin = u.username === "admin" || u.role === "admin";
                        const hasChatAccess = isUserAdmin || Boolean(u.canAccessChat);
                        return (
                          <tr key={u.id} className="hover:bg-indigo-50/30 transition-colors align-top">
                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-[#1D1D1F]">{u.displayName}</span>
                                {isUserAdmin && (
                                  <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">관리자</span>
                                )}
                              </div>
                              <div className="font-mono text-[11px] text-[#86868B]">@{u.username}</div>
                              <div className="font-mono text-[10px] text-[#5C5B57] mt-1 pt-1 border-t border-[#EAE6DF] w-fit">Key: {u.personalApiKey || "발급 안됨"}</div>
                            </td>
                            <td className="p-3 text-center">
                              {isUserAdmin ? (
                                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                                  항상 허용됨
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleToggleChatPermission(u.id, Boolean(u.canAccessChat))}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 mx-auto ${
                                    hasChatAccess
                                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                      : "bg-gray-100 hover:bg-gray-200 text-[#5C5B57] border border-[#EAE6DF]"
                                  }`}
                                >
                                  {hasChatAccess ? (
                                    <>
                                      <Unlock className="w-3 h-3" />
                                      대화 허용됨 (ON)
                                    </>
                                  ) : (
                                    <>
                                      <Lock className="w-3 h-3 text-gray-500" />
                                      잠김 (OFF)
                                    </>
                                  )}
                                </button>
                              )}
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
                                <div className="text-[9px] text-[#86868B]">입력 후 포커스를 해제하면 자동 저장됩니다.</div>
                              </div>
                            </td>
                            <td className="p-3 text-right space-x-2 whitespace-nowrap">
                              <button onClick={() => handleGenerateApiKey(u.id)} className="px-2 py-1 bg-white border border-[#EAE6DF] hover:border-indigo-300 rounded-lg text-[10px] cursor-pointer">Key 재발급</button>
                              {u.id !== "user-1" && (
                                <button onClick={() => handleDeleteUser(u.id)} className="px-2 py-1 bg-white border border-[#EAE6DF] text-rose-500 rounded-lg text-[10px] cursor-pointer">삭제</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
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

        {/* Admin Course Contents Manager Modal */}
        {showCourseManager && (
          <AdminCourseManagerModal
            token={token}
            onClose={() => setShowCourseManager(false)}
          />
        )}

      </div>
    );
  }

  // ===== NORMAL USER LAYOUT =====
  return (
    <div className="flex h-screen bg-[#FAF9F6] text-[#2A2927] overflow-hidden font-sans selection:bg-[#9C282C]/10 selection:text-[#9C282C]">

      {quickExprToast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] max-w-xl rounded-xl bg-slate-900 px-5 py-3 text-sm text-white shadow-lg">
          {quickExprToast}
        </div>
      )}

      {/* 1. Sidebar Panel (Apple/Notion Vibe Left Section) */}
      <aside className="w-80 lg:w-[340px] border-r border-[#EAE6DF] bg-[#FAF9F6] flex flex-col justify-between shrink-0 h-screen select-none z-30">

        {/* Top Header & Main Navigation Tabs */}
        {/* Top Header & Main Navigation Tabs */}
        <div className="p-4 pb-2 flex flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#1D1D1F] tracking-tight">SODABOT STUDIO</h2>
              <p className="text-[10px] text-[#86868B] font-medium">로봇 제작 & AI 코딩 스튜디오</p>
            </div>
          </div>

          {/* Primary Top Tab Switcher (수업/펌웨어 개발실 vs 소다봇 제어 & AI 코딩) */}
          <div className="bg-[#EAE6DF]/70 p-1 rounded-2xl flex flex-col gap-1 shadow-inner mt-0.5">
            <button
              id="tab-btn-dev-code"
              onClick={() => setMainNavTab("dev")}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                mainNavTab === "dev"
                  ? "bg-white text-indigo-700 shadow-sm ring-1 ring-black/5"
                  : "text-[#5C5B57] hover:text-[#1D1D1F] hover:bg-white/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <FolderCode className="w-4 h-4 text-indigo-600" />
                <span>수업 & 펌웨어 개발실</span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-extrabold">
                자료실
              </span>
            </button>

            <button
              id="tab-btn-chat-connect"
              onClick={() => setMainNavTab("chat")}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                mainNavTab === "chat"
                  ? "bg-white text-[#1D1D1F] shadow-sm ring-1 ring-black/5"
                  : "text-[#5C5B57] hover:text-[#1D1D1F] hover:bg-white/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Smile className="w-4 h-4 text-emerald-600" />
                <span>소다봇 제어 & AI 코딩</span>
              </div>
              {user.canAccessChat ? (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-extrabold flex items-center gap-0.5">
                  <Unlock className="w-2.5 h-2.5" />
                  연동 활성
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-extrabold flex items-center gap-0.5 border border-amber-200">
                  <Lock className="w-2.5 h-2.5" />
                  승인 대기
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Sidebar Middle Section */}
        {mainNavTab === "dev" ? (
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-thin">
            {/* Tree View Header */}
            <div className="flex items-center justify-between px-2 py-1.5 text-[10px] font-bold text-[#86868B] uppercase tracking-wider font-mono border-b border-[#EAE6DF] mb-1">
              <span className="flex items-center gap-1.5">
                <FolderCode className="w-3.5 h-3.5 text-indigo-600" />
                주차별 실습 코드 목록
              </span>
              <button
                onClick={() => {
                  const allWeeks = Array.from(new Set(courseContents.map(c => c.week)));
                  if (expandedWeeks.length === allWeeks.length) {
                    setExpandedWeeks([]);
                  } else {
                    setExpandedWeeks(allWeeks);
                  }
                }}
                className="text-[9px] text-[#86868B] hover:text-indigo-600 transition-colors cursor-pointer"
              >
                {expandedWeeks.length > 0 ? "모두 접기" : "모두 펼치기"}
              </button>
            </div>

            {/* Tree View Grouped by Week */}
            {Array.from(new Set(courseContents.map(c => Number(c.week))))
              .sort((a, b) => Number(a) - Number(b))
              .map(weekNum => {
                const weekCodes = courseContents.filter(c => c.week === weekNum);
                const isExpanded = expandedWeeks.includes(weekNum);

                return (
                  <div key={weekNum} className="space-y-0.5">
                    {/* Folder Header Row */}
                    <button
                      onClick={() => {
                        setExpandedWeeks(prev =>
                          prev.includes(weekNum) ? prev.filter(w => w !== weekNum) : [...prev, weekNum]
                        );
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between text-[#1D1D1F] hover:bg-[#EAE6DF]/40 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-[#86868B] shrink-0" />
                        )}
                        <span className="truncate">{weekNum}주차 실습</span>
                      </div>
                      <span className="text-[9px] text-[#86868B] font-mono bg-[#FAF9F6] px-1.5 py-0.5 rounded border border-[#EAE6DF]">
                        {weekCodes.length}개
                      </span>
                    </button>

                    {/* File Children Rows */}
                    {isExpanded && (
                      <div className="pl-4 space-y-0.5 border-l-2 border-indigo-100 ml-3.5 my-1">
                        {weekCodes.map(codeItem => {
                          const isSelected = selectedDevCodeId === codeItem.id && currentView === 'chat';
                          const isCircuit = codeItem.category === 'circuit' || codeItem.title.includes('회로');
                          const isEditor = codeItem.category === 'editor';
                          const ext = codeItem.filename ? (codeItem.filename.split('.').pop() || 'ino') : 'ino';

                          return (
                            <button
                              key={codeItem.id}
                              onClick={() => {
                                setSelectedDevCodeId(codeItem.id);
                                setCurrentView('chat');
                              }}
                              className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                                  : 'text-[#5C5B57] hover:bg-[#EAE6DF]/30 hover:text-[#1D1D1F]'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                <FileCode className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-indigo-500'}`} />
                                <span className="truncate text-xs font-semibold">{codeItem.title}</span>
                              </div>
                              <span className={`text-[8px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                                isSelected
                                  ? isCircuit
                                  ? 'bg-emerald-100 text-emerald-800 font-extrabold'
                                  : isEditor
                                    ? 'bg-purple-100 text-purple-800 font-extrabold'
                                    : 'bg-indigo-100 text-indigo-800 font-extrabold'
                                : isCircuit
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                  : isEditor
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200/60 font-bold'
                                    : 'bg-[#EAE6DF]/60 text-[#86868B]'
                              }`}>
                                {ext}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          <>
            {user.canAccessChat ? (
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5 scrollbar-thin">
                {/* 소다봇 연결 상태 카드 (소다봇 제어 탭일 때만 2개 탭 바로 밑에 표시) */}
                <button
                  onClick={() => setCurrentView('sodabot')}
                  className={`w-full text-left bg-white hover:bg-[#FAF9F6] border rounded-2xl p-2.5 shadow-xs transition-all cursor-pointer group ${
                    currentView === 'sodabot' ? 'border-indigo-500 ring-2 ring-indigo-50 bg-indigo-50/20' : 'border-[#EAE6DF] hover:border-indigo-300'
                  }`}
                  title="클릭하여 소다봇 연결 및 펌웨어 관리 열기"
                >
                  <div className="flex items-center justify-between text-[10px] font-semibold text-[#86868B] font-mono mb-1.5 px-0.5">
                    <span className="group-hover:text-indigo-600 transition-colors flex items-center gap-1">
                      <span>소다봇 상태</span>
                      <ChevronRight className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </span>
                    {isSodabotConnected ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        {connType === 'wifi' ? 'Wi-Fi 온라인' : connType === 'ble' ? 'BLE 온라인' : 'USB 온라인'}
                      </span>
                    ) : (
                      <span className="text-amber-600 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        미연결 (클릭하여 연결)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 ${
                      isSodabotConnected 
                        ? connType === 'serial' ? 'bg-blue-50 border border-blue-200' : 'bg-emerald-50 border border-emerald-200'
                        : 'bg-[#FAF9F6] border border-[#EAE6DF] group-hover:border-indigo-200'
                    }`}>
                      {isSodabotConnected ? '🤖' : '💤'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold text-[#1D1D1F] truncate group-hover:text-indigo-600 transition-colors">
                          {isSodabotConnected 
                            ? (localStorage.getItem("sodabot_device_name") || `SODABOT_${localStorage.getItem("sodabot_custom_name") || 'LUMI'}`)
                            : '소다봇 연결하기'}
                        </h5>
                        {isSodabotConnected && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                      </div>
                      <p className="text-[10px] text-[#86868B] font-mono truncate">
                        {isSodabotConnected 
                          ? (connType === 'serial' ? 'USB @ 115200' : sodabotIp ? `IP: ${sodabotIp}` : 'Bluetooth LE')
                          : '클릭하여 Wi-Fi/BLE 연결'}
                      </p>
                    </div>
                  </div>
                </button>

                {/* 6~11주차 실습 & AI 연동 메뉴 (소다봇 미연결 시 잠금 처리) */}
                <div className="space-y-1 pb-1 pt-1 border-t border-[#EAE6DF]/70">
                  <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold text-[#86868B] uppercase tracking-wider font-mono">
                    <span className="flex items-center gap-1.5">
                      <FolderCode className="w-3 h-3 text-indigo-600" />
                      6~11주차 실습 & 연동
                    </span>
                    {!isSodabotConnected ? (
                      <span className="text-[9px] text-amber-600 font-extrabold flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        <Lock className="w-2.5 h-2.5" /> 연결 필요
                      </span>
                    ) : (
                      <span className="text-[9px] text-emerald-600 font-extrabold flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        <Unlock className="w-2.5 h-2.5" /> 연동됨
                      </span>
                    )}
                  </div>

                  {/* 6주차: 소다봇 설정하기 */}
                  <button
                    onClick={() => {
                      if (!isSodabotConnected) {
                        alert("소다봇이 연결되지 않았습니다. 상단 '소다봇 상태' 카드를 눌러 먼저 기기를 연결해 주세요.");
                        setCurrentView('sodabot');
                        return;
                      }
                      setCurrentView('settings');
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                      !isSodabotConnected
                        ? 'text-[#A1A1A6] hover:bg-amber-50/50 hover:text-amber-800'
                        : currentView === 'settings'
                        ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shadow-2xs'
                        : 'text-[#5C5B57] hover:bg-[#EAE6DF]/20 hover:text-[#1D1D1F]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Settings className={`w-3.5 h-3.5 shrink-0 ${isSodabotConnected ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span className="truncate">6주차: 소다봇 설정하기</span>
                    </div>
                    {!isSodabotConnected ? (
                      <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                    ) : (
                      <span className="text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono font-bold shrink-0">
                        설정
                      </span>
                    )}
                  </button>

                  {/* 7주차: 소다봇 빌더 */}
                  <button
                    onClick={() => {
                      if (!isSodabotConnected) {
                        alert("소다봇이 연결되지 않았습니다. 상단 '소다봇 상태' 카드를 눌러 먼저 기기를 연결해 주세요.");
                        setCurrentView('sodabot');
                        return;
                      }
                      setCurrentView('sodabot_builder');
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                      !isSodabotConnected
                        ? 'text-[#A1A1A6] hover:bg-amber-50/50 hover:text-amber-800'
                        : currentView === 'sodabot_builder'
                        ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shadow-2xs'
                        : 'text-[#5C5B57] hover:bg-[#EAE6DF]/20 hover:text-[#1D1D1F]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles className={`w-3.5 h-3.5 shrink-0 ${isSodabotConnected ? 'text-amber-500' : 'text-slate-400'}`} />
                      <span className="truncate">7주차: 소다봇 빌더</span>
                    </div>
                    {!isSodabotConnected ? (
                      <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                    ) : (
                      <span className="text-[9px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-mono font-bold shrink-0">
                        빌더
                      </span>
                    )}
                  </button>

                  {/* 8주차: 소다와 대화하기 */}
                  <button
                    onClick={() => {
                      if (!isSodabotConnected) {
                        alert("소다봇이 연결되지 않았습니다. 상단 '소다봇 상태' 카드를 눌러 먼저 기기를 연결해 주세요.");
                        setCurrentView('sodabot');
                        return;
                      }
                      setCurrentView('chat');
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                      !isSodabotConnected
                        ? 'text-[#A1A1A6] hover:bg-amber-50/50 hover:text-amber-800'
                        : currentView === 'chat'
                        ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shadow-2xs'
                        : 'text-[#5C5B57] hover:bg-[#EAE6DF]/20 hover:text-[#1D1D1F]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isSodabotConnected ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span className="truncate">8주차: 소다와 대화하기</span>
                    </div>
                    {!isSodabotConnected ? (
                      <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                    ) : (
                      <span className="text-[9px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-mono font-bold shrink-0">
                        AI 대화
                      </span>
                    )}
                  </button>

                  {/* 9주차: 소다봇 시나리오 & 센서 */}
                  <button
                    onClick={() => {
                      if (!isSodabotConnected) {
                        alert("소다봇이 연결되지 않았습니다. 상단 '소다봇 상태' 카드를 눌러 먼저 기기를 연결해 주세요.");
                        setCurrentView('sodabot');
                        return;
                      }
                      alert("9주차: 소다봇 인터랙션 & 센서 제어 기능은 수업 진행에 맞춰 순차 오픈됩니다.");
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium flex items-center justify-between text-[#86868B] hover:bg-[#EAE6DF]/20 transition-all cursor-pointer opacity-80"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Cpu className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">9주차: 시나리오 & 센서</span>
                    </div>
                    <span className="text-[9px] text-[#86868B] bg-[#FAF9F6] border border-[#EAE6DF] px-1.5 py-0.5 rounded font-mono shrink-0">
                      준비중
                    </span>
                  </button>

                  {/* 10주차: 웹 API & 클라우드 연동 */}
                  <button
                    onClick={() => {
                      if (!isSodabotConnected) {
                        alert("소다봇이 연결되지 않았습니다. 상단 '소다봇 상태' 카드를 눌러 먼저 기기를 연결해 주세요.");
                        setCurrentView('sodabot');
                        return;
                      }
                      alert("10주차: 웹 API & 클라우드 연동 실습은 수업 진행에 맞춰 순차 오픈됩니다.");
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium flex items-center justify-between text-[#86868B] hover:bg-[#EAE6DF]/20 transition-all cursor-pointer opacity-80"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Wifi className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">10주차: 웹 API & 클라우드</span>
                    </div>
                    <span className="text-[9px] text-[#86868B] bg-[#FAF9F6] border border-[#EAE6DF] px-1.5 py-0.5 rounded font-mono shrink-0">
                      준비중
                    </span>
                  </button>

                  {/* 11주차: 캡스톤 최종 프로젝트 */}
                  <button
                    onClick={() => {
                      if (!isSodabotConnected) {
                        alert("소다봇이 연결되지 않았습니다. 상단 '소다봇 상태' 카드를 눌러 먼저 기기를 연결해 주세요.");
                        setCurrentView('sodabot');
                        return;
                      }
                      alert("11주차: 나만의 소다봇 캡스톤 프로젝트 발표 실습은 수업 진행에 맞춰 순차 오픈됩니다.");
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium flex items-center justify-between text-[#86868B] hover:bg-[#EAE6DF]/20 transition-all cursor-pointer opacity-80"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">11주차: 캡스톤 프로젝트</span>
                    </div>
                    <span className="text-[9px] text-[#86868B] bg-[#FAF9F6] border border-[#EAE6DF] px-1.5 py-0.5 rounded font-mono shrink-0">
                      준비중
                    </span>
                  </button>
                </div>

                {/* Chat Rooms List when in Chat View & Connected */}
                {currentView === 'chat' && isSodabotConnected && (
                  <div className="pt-2 border-t border-[#EAE6DF] space-y-1.5">
                    <div className="flex items-center justify-between px-1 text-[10px] font-semibold text-[#86868B] uppercase tracking-wider font-mono">
                      <span>대화 기록</span>
                      <button
                        onClick={handleCreateNewChat}
                        className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" /> 새 대화
                      </button>
                    </div>

                    <div className="space-y-1 max-h-[220px] overflow-y-auto">
                      {chats.map(chat => (
                        <button
                          key={chat.id}
                          onClick={() => setActiveChatId(chat.id)}
                          className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            activeChatId === chat.id
                              ? 'bg-indigo-100/70 text-indigo-900 font-bold'
                              : 'text-[#5C5B57] hover:bg-[#EAE6DF]/30'
                          }`}
                        >
                          <span className="truncate">{chat.title || '새로운 대화'}</span>
                          <span className="text-[9px] text-[#86868B] font-mono shrink-0 ml-1">
                            {new Date(chat.createdAt).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 p-4 flex flex-col justify-center items-center text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm">
                  <Lock className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-[#1D1D1F]">대화 기능 권한 대기 중</h4>
                  <p className="text-[10px] text-[#86868B] leading-relaxed">
                    선생님이 승인하면 자동으로 대화 목록과 연결 기능이 활성화됩니다.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Fixed Bottom Guide Card for Dev Tab */}
        {mainNavTab === "dev" && (
          <div className="px-3 pb-2 shrink-0">
            <div className="p-3 bg-white border-2 border-indigo-200/90 rounded-2xl space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-[#1D1D1F]">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>아두이노 IDE 업로드 3단계</span>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-black font-mono">
                  필독 💡
                </span>
              </div>

              {/* 3 Step List with High Contrast Colorful Badges */}
              <div className="space-y-1.5 text-xs">
                {/* Step 1 */}
                <div className="flex items-center gap-2 p-1.5 rounded-xl bg-blue-50/80 border border-blue-200/80">
                  <span className="w-5 h-5 rounded-lg bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                    1
                  </span>
                  <span className="text-[11px] font-bold text-blue-900 truncate">
                    💾 [파일 저장] 또는 [코드 복사]
                  </span>
                </div>

                {/* Step 2 */}
                <div className="flex items-center gap-2 p-1.5 rounded-xl bg-purple-50/80 border border-purple-200/80">
                  <span className="w-5 h-5 rounded-lg bg-purple-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                    2
                  </span>
                  <span className="text-[11px] font-bold text-purple-900 truncate">
                    💻 아두이노 IDE에 붙여넣기
                  </span>
                </div>

                {/* Step 3 (Highlight) */}
                <div className="flex items-center gap-2 p-1.5 rounded-xl bg-emerald-50 border-2 border-emerald-300 shadow-2xs">
                  <span className="w-5 h-5 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shrink-0 animate-pulse">
                    3
                  </span>
                  <span className="text-[11px] font-black text-emerald-900 truncate">
                    ⚡ [ ➔ ] 업로드 버튼 누르기!
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Info & Quick Control Footer */}
        <div className="p-3 border-t border-[#EAE6DF] bg-white space-y-2">
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

      {/* 2. Main Body Area: Renders DevCodeHub or Chat/Connect View */}
      {mainNavTab === "dev" ? (
        <DevCodeHubScreen
          selectedCodeId={selectedDevCodeId}
          onSelectCode={setSelectedDevCodeId}
        />
      ) : !user.canAccessChat ? (
        /* Locked Chat Splash View */
        <main className="flex-1 flex flex-col items-center justify-center h-screen bg-[#FAF9F6] p-6 text-center select-none relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#EAE6DF_1px,transparent_1px),linear-gradient(to_bottom,#EAE6DF_1px,transparent_1px)] bg-[size:5rem_5rem] opacity-25 pointer-events-none" />

          <div className="max-w-md w-full bg-white border border-[#EAE6DF] rounded-3xl p-8 shadow-xl space-y-6 relative z-10 animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto shadow-sm">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                선생님(관리자) 승인 대기 중
              </div>
              <h2 className="text-xl font-extrabold text-[#1D1D1F] tracking-tight">
                소다봇 제어 & AI 코딩 탭이 대기 중입니다
              </h2>
              <p className="text-xs text-[#5C5B57] leading-relaxed">
                현재 수업 커리큘럼에 따라 <strong>수업 & 펌웨어 개발실</strong>이 기본 오픈되어 있습니다.
                회로 조립과 코드를 먼저 학습해 주세요. 선생님이 권한을 승인하면 소다봇 연동 및 코딩 제어가 실시간으로 열립니다.
              </p>
            </div>

            <div className="p-4 bg-[#FAF9F6] border border-[#EAE6DF] rounded-2xl text-left space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#1D1D1F]">
                <span>실시간 권한 감지 중</span>
                <span className="text-[10px] text-emerald-600 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  동기화 활성
                </span>
              </div>
              <p className="text-[11px] text-[#86868B]">
                선생님이 관리자 화면에서 연동 권한을 승인하면 새로고침 없이 즉시 소다봇 제어가 활성화됩니다.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                onClick={() => setMainNavTab("dev")}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FolderCode className="w-4 h-4" />
                수업 & 펌웨어 제작실로 이동
              </button>
              <button
                onClick={() => token && verifySession(token)}
                className="py-2.5 px-4 bg-white hover:bg-[#FAF9F6] border border-[#EAE6DF] text-[#1D1D1F] rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#86868B]" />
                연동 상태 확인
              </button>
            </div>
          </div>
        </main>
      ) : (
        /* Normal Chat / Sodabot Connect / Builder View */
        <main className="flex-1 flex flex-col h-screen overflow-hidden bg-white relative">
          {(!isSodabotConnected && currentView !== 'sodabot') ? (
            /* Connection Required Gate View */
            <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#FAF9F6] p-6 text-center select-none relative overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#EAE6DF_1px,transparent_1px),linear-gradient(to_bottom,#EAE6DF_1px,transparent_1px)] bg-[size:5rem_5rem] opacity-30 pointer-events-none" />

              <div className="max-w-md w-full bg-white border border-[#EAE6DF] rounded-3xl p-8 shadow-xl space-y-6 relative z-10 animate-fade-in">
                <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mx-auto shadow-sm text-3xl">
                  🤖
                </div>

                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    소다봇 연결 필요
                  </div>
                  <h2 className="text-xl font-extrabold text-[#1D1D1F] tracking-tight">
                    소다봇을 먼저 연결해 주세요
                  </h2>
                  <p className="text-xs text-[#5C5B57] leading-relaxed">
                    <strong>AI 코딩 & 인터랙션</strong> 및 <strong>소다봇빌더</strong>를 사용하려면 실제 소다봇 하드웨어와의 연결이 필요합니다.
                  </p>
                </div>

                <div className="p-4 bg-[#FAF9F6] border border-[#EAE6DF] rounded-2xl text-left space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-[#1D1D1F]">
                    <Bluetooth className="w-4 h-4 text-indigo-600" />
                    <span>원클릭 간편 연결 지원</span>
                  </div>
                  <p className="text-[11px] text-[#86868B] leading-relaxed">
                    블루투스로 Wi-Fi를 1회 설정하면 이후 자동으로 실시간 WebSocket 연결이 활성화됩니다.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => setCurrentView('sodabot')}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Bluetooth className="w-4 h-4" />
                    소다봇 연결하러 가기
                  </button>
                  <button
                    onClick={() => setMainNavTab("dev")}
                    className="w-full py-2.5 bg-white hover:bg-[#FAF9F6] border border-[#EAE6DF] text-[#5C5B57] rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FolderCode className="w-3.5 h-3.5" />
                    수업 & 펌웨어 개발실로 이동
                  </button>
                </div>
              </div>
            </div>
          ) : currentView === 'chat' ? (
            <>
              {/* Apple style Minimal Header */}
              <header className="h-14 border-b border-[#EAE6DF] bg-white flex items-center justify-between px-6 shrink-0 z-10 select-none">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight font-mono">
                {activeChat ? activeChat.title : "새로운 대화"}
              </span>
            {user?.username === 'admin' && (
              <>
                <span className="text-[#EAE6DF] text-sm">/</span>
                <div className="flex items-center gap-1.5 text-xs text-[#86868B]">
                  <span className={`w-1.5 h-1.5 rounded-full ${lmStudioConnected ? "bg-emerald-500" : "bg-amber-500"}`} />
                  <span className="font-mono text-[11px] text-[#5C5B57]">
                    {lmStudioConnected ? "AI Engine Connected" : "AI Engine Standby"}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Fallback Mode indicator (Admin only) */}
          {user?.username === 'admin' && (
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${fallbackMode
                  ? "bg-amber-50 border border-amber-100 text-amber-700"
                  : "bg-emerald-50 border border-emerald-100 text-emerald-700"
                }`}>
                {fallbackMode ? "에뮬레이터 대기 상태" : "로컬 Direct 접속 전용"}
              </span>
            </div>
          )}
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
                          {user?.username === 'admin' && msg.modelUsed && <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded ml-2 truncate max-w-[120px]">🤖 {msg.modelUsed}</span>}
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
          </>
        ) : currentView === 'sodabot' ? (
          <SodabotConnectScreen currentUser={user} />
        ) : currentView === 'sodabot_builder' ? (
          <SodaAiLabScreen />
        ) : (
          <SodabotSettingsScreen />
        )}
      </main>
      )}




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
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-[#1D1D1F]">등록된 사용자 목록</h4>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleBatchToggleChatPermission(true)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          전체 대화 오픈 (ON)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBatchToggleChatPermission(false)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <ShieldAlert className="w-3 h-3" />
                          전체 대화 잠금 (OFF)
                        </button>
                      </div>
                    </div>
                    <div className="border border-[#EAE6DF] rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#FAF9F6] text-[#86868B] border-b border-[#EAE6DF]">
                          <tr>
                            <th className="p-3 font-semibold">ID (계정)</th>
                            <th className="p-3 font-semibold">이름</th>
                            <th className="p-3 font-semibold text-center">대화 권한 (수업 제어)</th>
                            <th className="p-3 font-semibold">API Key</th>
                            <th className="p-3 font-semibold text-right">관리 액션</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EAE6DF] text-[#1D1D1F]">
                          {adminUsers.map(u => {
                            const isUserAdmin = u.username === "admin" || u.role === "admin";
                            const hasChatAccess = isUserAdmin || Boolean(u.canAccessChat);
                            return (
                              <tr key={u.id} className="hover:bg-indigo-50/30 transition-colors">
                                <td className="p-3 font-mono text-[11px] font-semibold">
                                  {u.username}
                                  {isUserAdmin && (
                                    <span className="ml-1.5 text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">관리자</span>
                                  )}
                                </td>
                                <td className="p-3 font-medium">{u.displayName}</td>
                                <td className="p-3 text-center">
                                  {isUserAdmin ? (
                                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                                      항상 허용
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleChatPermission(u.id, Boolean(u.canAccessChat))}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                                        hasChatAccess
                                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                          : "bg-gray-100 hover:bg-gray-200 text-[#5C5B57] border border-[#EAE6DF]"
                                      }`}
                                    >
                                      {hasChatAccess ? (
                                        <>
                                          <Unlock className="w-2.5 h-2.5" />
                                          허용됨 (ON)
                                        </>
                                      ) : (
                                        <>
                                          <Lock className="w-2.5 h-2.5 text-gray-500" />
                                          잠김 (OFF)
                                        </>
                                      )}
                                    </button>
                                  )}
                                </td>
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
                            );
                          })}
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