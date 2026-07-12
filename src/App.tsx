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
  Info
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
  const [lmStudioUrl, setLmStudioUrl] = useState("http://192.168.0.93:1234");
  const [modelName, setModelName] = useState("meta-llama-3-8b-instruct");
  const [fallbackMode, setFallbackMode] = useState(true);
  const [lmStudioConnected, setLmStudioConnected] = useState<boolean | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testMessage, setTestMessage] = useState("");

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
        // Automatically activate first chat if available
        if (data.length > 0 && !activeChatId) {
          setActiveChatId(data[0].id);
        }
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
        setLmStudioUrl(data.lmStudioUrl);
        setModelName(data.modelName);
        setFallbackMode(data.fallbackMode);
        checkConnection(data.lmStudioUrl);
      }
    } catch (err) {
      console.error("Failed to load LM Studio settings", err);
    }
  };

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

  const handleCreateNewChat = async (initialTitle?: string) => {
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: initialTitle || "새로운 대화 ✨" })
      });
      const data = await res.json();
      if (res.ok) {
        setChats(prev => [data, ...prev]);
        setActiveChatId(data.id);
      }
    } catch (err) {
      console.error("New chat creation failed", err);
    }
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

    // Optimistically add user message to local state
    const tempUserMsg: Message = {
      id: "temp-user-msg-" + Date.now(),
      sender: "user",
      text: textToSend,
      timestamp: new Date().toISOString()
    };

    setChats(prev => prev.map(c => {
      if (c.id === targetChatId) {
        return { ...c, messages: [...c.messages, tempUserMsg] };
      }
      return c;
    }));

    try {
      const res = await fetch(`/api/chats/${targetChatId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: textToSend })
      });
      
      const data = await res.json();
      if (res.ok) {
        // Update full message history in local chat state
        setChats(prev => prev.map(c => {
          if (c.id === targetChatId) {
            return {
              ...c,
              title: data.chatTitle || c.title,
              messages: c.messages.filter(m => m.id !== tempUserMsg.id).concat([
                data.userMessage,
                data.assistantMessage
              ])
            };
          }
          return c;
        }));
      } else {
        alert(data.error || "메시지 발송에 실패했습니다.");
      }
    } catch (err) {
      console.error("Message send failure", err);
    } finally {
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
          lmStudioUrl,
          modelName,
          fallbackMode
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
      desc: "무인양품처럼 꾸밈없고 일상에 녹아드는 간결한 문장의 한 줄 광고 기획서.",
      prompt: "가벼운 린넨 이불 제품에 어울리는 무인양품 풍의 담백하고 미니멀한 가을용 카피 3가지만 적어줘."
    },
    {
      title: "따뜻한 맞춤법 교정기 ☕",
      desc: "은어와 띄어쓰기가 뒤섞인 서툰 글을 다정하고 품격 넘치는 정돈된 우리글로 다듬기.",
      prompt: "다음 오탈자 글을 교정해줘: '저번에산 베개 넘나편해서 꿀잠잤음 진짜 고마워요 번창하새요'"
    }
  ];

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
              <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">MUJI AI Chat</h2>
              <span className="text-[10px] text-[#86868B] font-mono tracking-wider">STUDIO CORE v1.0</span>
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

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 py-1 scrollbar-thin">
          <div className="px-3 py-1 text-[10px] font-semibold text-[#86868B] uppercase tracking-wider font-mono">
            최근 대화방 목록 ({chats.length})
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
                  className={`group flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition-all ${
                    isActive 
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

          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            {/* Settings toggler */}
            <button
              id="open-settings-panel-btn"
              onClick={() => setShowSettings(true)}
              className="py-1.5 px-2 bg-[#FAF9F6] hover:bg-[#EAE6DF]/50 border border-[#EAE6DF] rounded-lg text-[10px] font-medium text-[#5C5B57] flex items-center justify-center gap-1 cursor-pointer transition-colors"
            >
              <Settings className="w-3 h-3" />
              서버 설정
            </button>

            {/* Logout button */}
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
                LM Studio {lmStudioUrl.replace("http://", "")}
              </span>
            </div>
          </div>

          {/* Fallback Mode indicator */}
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
              fallbackMode 
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
                    오늘 어떤 깊은 생각이나 질문을 안고 오셨나요? 무인양품의 정갈함과 노션의 담백함으로 정성스럽게 답변해 드릴게요.
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
                      로컬 LM Studio API 호스트(<code className="font-mono text-[#9C282C]">192.168.0.93:1234</code>)가 꺼져 있거나 접근 불가능할 시, 
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
                      <div className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed ${
                        isUser
                          ? "bg-[#2A2927] text-white rounded-tr-sm shadow-sm"
                          : "bg-white border border-[#EAE6DF] text-[#2A2927] rounded-tl-sm shadow-sm space-y-2"
                      }`}>
                        
                        {/* Message Text */}
                        <div className="whitespace-pre-wrap font-sans break-words antialiased">
                          {msg.text}
                        </div>

                        {/* Timestamp or Emulator Info */}
                        <div className="flex items-center justify-between text-[10px] text-[#86868B] font-mono border-t border-[#FAF9F6] pt-1.5 mt-2">
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          
                          {!isUser && (
                            <span className="text-[9px] text-[#9C282C] font-semibold bg-[#FAF9F6] px-1.5 py-0.5 rounded-full border border-[#EAE6DF]">
                              Llama-3 (Virtual)
                            </span>
                          )}
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
              <span>* LM Studio API 포트: http://192.168.0.93:1234 (또는 가상 에뮬레이터 지원)</span>
              <span>입력 완료 후 엔터를 누르면 전송됩니다.</span>
            </div>
          </div>
        </div>
      </main>

      {/* 3. Settings Drawer / Dialog Modal (Apple Visual Overlay) */}
      {showSettings && (
        <div className="fixed inset-0 bg-[#1D1D1F]/40 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in p-4">
          <div className="bg-white border border-[#EAE6DF] rounded-3xl w-full max-w-lg shadow-2xl p-6 relative overflow-hidden space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#FAF9F6]">
              <div className="flex items-center gap-2">
                <Settings className="w-4.5 h-4.5 text-[#9C282C]" />
                <h3 className="text-sm font-semibold text-[#1D1D1F]">LM Studio 연동 파라미터 제어</h3>
              </div>
              <button
                id="close-settings-modal-btn"
                onClick={() => {
                  setShowSettings(false);
                  setTestMessage("");
                }}
                className="text-xs text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer font-semibold"
              >
                닫기 ✕
              </button>
            </div>

            {/* Settings Form */}
            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs text-left">
              
              <div className="space-y-1.5">
                <label className="font-semibold text-[#1D1D1F]">Base API URL 주소</label>
                <input
                  id="modal-settings-url-input"
                  type="url"
                  required
                  value={lmStudioUrl}
                  onChange={(e) => setLmStudioUrl(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF9F6] border border-[#EAE6DF] focus:border-[#2A2927] rounded-xl font-mono focus:outline-none transition-all"
                  placeholder="예: http://192.168.0.93:1234"
                />
                <p className="text-[10px] text-[#86868B]">
                  * 로컬망의 LM Studio Base API 주소입니다. 기본 포트는 <code className="font-bold text-[#9C282C]">1234</code> 입니다.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-[#1D1D1F]">추론 모델 식별자 (Model ID)</label>
                <input
                  id="modal-settings-model-input"
                  type="text"
                  required
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF9F6] border border-[#EAE6DF] focus:border-[#2A2927] rounded-xl font-mono focus:outline-none transition-all"
                  placeholder="예: meta-llama-3-8b-instruct"
                />
                <p className="text-[10px] text-[#86868B]">
                  * LM Studio에 실제 로드된 모델의 정확한 Model ID를 작성하세요.
                </p>
              </div>

              {/* Checkbox Fallback option */}
              <div className="p-3 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl flex items-start gap-2.5">
                <input
                  id="modal-settings-fallback-checkbox"
                  type="checkbox"
                  checked={fallbackMode}
                  onChange={(e) => setFallbackMode(e.target.checked)}
                  className="mt-1 w-4 h-4 text-[#9C282C] border-[#EAE6DF] rounded focus:ring-[#9C282C]"
                />
                <div className="space-y-0.5">
                  <label htmlFor="modal-settings-fallback-checkbox" className="font-semibold text-[#1D1D1F] cursor-pointer">
                    지능형 클라우드 에뮬레이터 자동 전환 권장
                  </label>
                  <p className="text-[10px] text-[#86868B] leading-relaxed">
                    로컬 호스트(192.168.0.93)와 직접 통신되지 않을 때, 고정밀 가상 Llama-3 코어를 자동으로 발동시켜 대화 흐름이 끊기지 않도록 영리하게 돕습니다.
                  </p>
                </div>
              </div>

              {/* Connection Test Diagnostics Block */}
              {testMessage && (
                <div className="p-3 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl font-mono text-[11px] leading-relaxed text-[#5C5B57] flex items-start gap-2">
                  <Info className="w-4 h-4 text-[#9C282C] shrink-0 mt-0.5" />
                  <span>{testMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#FAF9F6] flex justify-between gap-4">
                <button
                  id="modal-test-conn-btn"
                  type="button"
                  disabled={testingConnection}
                  onClick={handleTestSettingsConnection}
                  className="py-2 px-4 bg-white border border-[#EAE6DF] text-[#5C5B57] rounded-xl font-medium cursor-pointer transition-all hover:bg-[#FAF9F6] flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? "animate-spin" : ""}`} />
                  <span>서버 연동 신호 테스트</span>
                </button>

                <button
                  id="modal-save-settings-btn"
                  type="submit"
                  className="py-2 px-6 bg-[#2A2927] hover:bg-[#9C282C] text-white rounded-xl font-medium cursor-pointer transition-all hover:scale-[1.01]"
                >
                  설정 저장 및 적용
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
