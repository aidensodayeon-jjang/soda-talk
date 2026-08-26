import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Bot,
  User,
  Brain,
  MessageSquare,
  Clock,
  Calendar,
  CloudSun,
  Calculator,
  Plus,
  Trash2,
  Edit2,
  Check,
  RotateCcw,
  Send,
  Zap,
  Sliders,
  Maximize2,
  Info,
  ChevronRight,
  Eye,
  Settings,
  Layers,
  Terminal,
  Activity,
  CheckSquare,
  Square,
  HelpCircle,
  Play
} from "lucide-react";

// Types
export interface PersonaState {
  name: string;
  intro: string;
  role: string;
  tone: string;
  personality: string;
  callSign: string;
}

export interface ProfileState {
  userName: string;
  school: string;
  hobby: string;
  interests: string;
  goal: string;
  likes: string;
  dislikes: string;
}

export interface MemoryItem {
  id: string;
  content: string;
  createdAt: string;
}

export interface TestMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCall?: {
    name: string;
    label: string;
    result: string;
  };
  timestamp: string;
}

export default function SodaAiLabScreen() {
  // 1. Persona State
  const [persona, setPersona] = useState<PersonaState>(() => {
    const saved = localStorage.getItem("soda_ailab_persona");
    return saved
      ? JSON.parse(saved)
      : {
          name: "루미",
          intro: "언제나 너를 도와주는 든든한 AI 학습 파트너",
          role: "공부친구",
          tone: "친근한 친구말",
          personality: "친절함과 유쾌함",
          callSign: "민준아"
        };
  });

  // 2. Profile State
  const [profile, setProfile] = useState<ProfileState>(() => {
    const saved = localStorage.getItem("soda_ailab_profile");
    return saved
      ? JSON.parse(saved)
      : {
          userName: "김민준",
          school: "소다중학교 1학년",
          hobby: "축구, 파이썬 코딩",
          interests: "인공지능, 우주 탐사",
          goal: "과학고 진학 및 AI 개발자 되기",
          likes: "민트초코, 로봇 제작",
          dislikes: "잔소리, 매운 음식"
        };
  });

  // 3. Context Length Config (Max turns to keep)
  const [contextLimit, setContextLimit] = useState<number>(() => {
    const saved = localStorage.getItem("soda_ailab_context_limit");
    return saved ? parseInt(saved, 10) : 6; // default 6 turns
  });

  // 4. Memory List State
  const [memories, setMemories] = useState<MemoryItem[]>(() => {
    const saved = localStorage.getItem("soda_ailab_memories");
    return saved
      ? JSON.parse(saved)
      : [
          { id: "mem_1", content: "민준이는 축구와 코딩을 좋아한다.", createdAt: "08:00" },
          { id: "mem_2", content: "강아지 이름은 초코 (푸들종).", createdAt: "08:05" },
          { id: "mem_3", content: "목표는 과학고 진학 및 소다봇 완성하기.", createdAt: "08:10" }
        ];
  });
  const [newMemoryText, setNewMemoryText] = useState("");
  const [editingMemId, setEditingMemId] = useState<string | null>(null);
  const [editingMemText, setEditingMemText] = useState("");

  // 5. Tool Enabled Switch & Capabilities
  const [toolsEnabled, setToolsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("soda_ailab_tools_enabled");
    return saved ? JSON.parse(saved) : true;
  });

  // 6. Test Chat History
  const [messages, setMessages] = useState<TestMessage[]>(() => {
    const saved = localStorage.getItem("soda_ailab_chat_history");
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: "msg_1",
            role: "user",
            content: "안녕! 너에 대해 소개해주고, 내 목표가 뭔지 기억하고 있어?",
            timestamp: "08:12"
          },
          {
            id: "msg_2",
            role: "assistant",
            content: "안녕 민준아! 나는 너의 공부친구 루미야! 😉 물론 기억하고 있지. 민준이 목표는 과학고 진학하고 멋진 AI 개발자가 되는 거잖아! 언제나 응원하고 있어!",
            timestamp: "08:12"
          }
        ];
  });
  const [inputQuestion, setInputQuestion] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [toolLogs, setToolLogs] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Active Tab for Left Sidebar Settings
  const [sidebarTab, setSidebarTab] = useState<"persona" | "profile" | "memory" | "tool">("persona");

  // Save changes to LocalStorage
  useEffect(() => {
    localStorage.setItem("soda_ailab_persona", JSON.stringify(persona));
  }, [persona]);

  useEffect(() => {
    localStorage.setItem("soda_ailab_profile", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem("soda_ailab_context_limit", contextLimit.toString());
  }, [contextLimit]);

  useEffect(() => {
    localStorage.setItem("soda_ailab_memories", JSON.stringify(memories));
  }, [memories]);

  useEffect(() => {
    localStorage.setItem("soda_ailab_tools_enabled", JSON.stringify(toolsEnabled));
  }, [toolsEnabled]);

  useEffect(() => {
    localStorage.setItem("soda_ailab_chat_history", JSON.stringify(messages));
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Memory Handlers
  const handleAddMemory = () => {
    if (!newMemoryText.trim()) return;
    const newItem: MemoryItem = {
      id: `mem_${Date.now()}`,
      content: newMemoryText.trim(),
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    setMemories([...memories, newItem]);
    setNewMemoryText("");
  };

  const handleDeleteMemory = (id: string) => {
    setMemories(memories.filter((m) => m.id !== id));
  };

  const handleStartEditMemory = (m: MemoryItem) => {
    setEditingMemId(m.id);
    setEditingMemText(m.content);
  };

  const handleSaveEditMemory = (id: string) => {
    if (!editingMemText.trim()) return;
    setMemories(memories.map((m) => (m.id === id ? { ...m, content: editingMemText.trim() } : m)));
    setEditingMemId(null);
    setEditingMemText("");
  };

  // Glass Box Prompt Assembly Logic (Real-time dynamic string creation)
  const assemblePromptParts = () => {
    const systemPart = `[SYSTEM PROMPT]
당신은 SODA AI LAB에서 학생들이 설계한 Glass Box AI 친구입니다.
전달받은 PERSONA, PROFILE, MEMORY, CONTEXT 규칙을 철저히 준수하여 응답하세요.`;

    const personaPart = `[PERSONA (AI 페르소나 설정)]
• 이름: ${persona.name}
• 한줄소개: ${persona.intro}
• 역할: ${persona.role}
• 말투: ${persona.tone}
• 성격: ${persona.personality}
• 사용자 부르는 호칭: ${persona.callSign}`;

    const profilePart = `[PROFILE (사용자 영구 프로필)]
• 이름: ${profile.userName}
• 학교: ${profile.school}
• 취미: ${profile.hobby}
• 관심사: ${profile.interests}
• 목표: ${profile.goal}
• 좋아하는 것: ${profile.likes}
• 싫어하는 것: ${profile.dislikes}`;

    const memoryPart = `[MEMORY (장기 기억 목록)]
${
  memories.length > 0
    ? memories.map((m, idx) => `${idx + 1}. ${m.content}`).join("\n")
    : "(저장된 기억이 없습니다)"
}`;

    // Context slicing based on limit
    const activeMessages = messages.slice(-contextLimit);
    const contextPart = `[RECENT CONTEXT (최근 ${contextLimit}개 대화 턴 유지)]
${
  activeMessages.length > 0
    ? activeMessages
        .map(
          (m) =>
            `${m.role === "user" ? profile.userName : persona.name}: ${m.content}`
        )
        .join("\n")
    : "(이전 대화 없음)"
}`;

    return {
      systemPart,
      personaPart,
      profilePart,
      memoryPart,
      contextPart,
      activeMessagesCount: activeMessages.length,
      evictedMessages: messages.slice(0, Math.max(0, messages.length - contextLimit))
    };
  };

  const promptParts = assemblePromptParts();

  // Simulated Tool Execution & AI Response Handler
  const handleSendMessage = async () => {
    if (!inputQuestion.trim() || isAiThinking) return;

    const userMsg: TestMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: inputQuestion.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    const newChatHistory = [...messages, userMsg];
    setMessages(newChatHistory);
    const currentQuery = inputQuestion.trim();
    setInputQuestion("");
    setIsAiThinking(true);
    setToolLogs([]);

    // Tool Detection Logic
    let usedTool: { name: string; label: string; result: string } | null = null;

    if (toolsEnabled) {
      if (currentQuery.includes("시간") || currentQuery.includes("몇 시")) {
        setToolLogs(["잠시만요...", "현재 시간을 확인하고 있습니다."]);
        await new Promise((r) => setTimeout(r, 900));
        const now = new Date();
        const timeStr = `${now.getHours()}시 ${now.getMinutes()}분 ${now.getSeconds()}초`;
        usedTool = {
          name: "get_current_time",
          label: "현재시간 확인 Tool",
          result: timeStr
        };
      } else if (currentQuery.includes("날짜") || currentQuery.includes("오늘")) {
        setToolLogs(["잠시만요...", "오늘 날짜를 조회하고 있습니다."]);
        await new Promise((r) => setTimeout(r, 900));
        const today = new Date().toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "long"
        });
        usedTool = {
          name: "get_today_date",
          label: "오늘날짜 조회 Tool",
          result: today
        };
      } else if (currentQuery.includes("날씨")) {
        setToolLogs(["잠시만요...", "기상청 신호를 수신하여 맑은 날씨 정보를 받아오는 중입니다."]);
        await new Promise((r) => setTimeout(r, 1000));
        usedTool = {
          name: "get_weather",
          label: "날씨 조회 Tool",
          result: "현재 서울 섭씨 24도, 맑음 (습도 45%, 미세먼지 좋음)"
        };
      } else if (currentQuery.includes("계산") || /\d+\s*[\+\-\*\/]\s*\d+/.test(currentQuery)) {
        setToolLogs(["잠시만요...", "수식 연산을 실행하고 있습니다."]);
        await new Promise((r) => setTimeout(r, 800));
        let calcRes = "42";
        try {
          const mathMatch = currentQuery.match(/(\d+)\s*([\+\-\*\/])\s*(\d+)/);
          if (mathMatch) {
            const a = parseFloat(mathMatch[1]);
            const op = mathMatch[2];
            const b = parseFloat(mathMatch[3]);
            if (op === "+") calcRes = (a + b).toString();
            else if (op === "-") calcRes = (a - b).toString();
            else if (op === "*") calcRes = (a * b).toString();
            else if (op === "/") calcRes = (a / b).toString();
          }
        } catch (e) {
          calcRes = "계산 오류";
        }
        usedTool = {
          name: "calculate",
          label: "계산기 Tool",
          result: `연산 결과: ${calcRes}`
        };
      } else {
        await new Promise((r) => setTimeout(r, 600));
      }
    } else {
      await new Promise((r) => setTimeout(r, 600));
    }

    // AI Response Generator based on Persona & Tool Result
    let aiResponseContent = "";
    if (usedTool) {
      if (usedTool.name === "get_current_time") {
        aiResponseContent = `${persona.callSign}! 확인해보니 지금 시간은 **${usedTool.result}**이야!`;
      } else if (usedTool.name === "get_today_date") {
        aiResponseContent = `오늘 날짜를 가져왔어! 오늘은 **${usedTool.result}**란다.`;
      } else if (usedTool.name === "get_weather") {
        aiResponseContent = `오늘 날씨를 확인했어 ☀️ **${usedTool.result}**! 산책하기 딱 좋은 날씨지?`;
      } else if (usedTool.name === "calculate") {
        aiResponseContent = `물어본 계산 문제 정답은 **${usedTool.result}**이야! 또 궁금한 계산이 있으면 말해줘!`;
      }
    } else {
      if (currentQuery.includes("기억") || currentQuery.includes("강아지") || currentQuery.includes("취미")) {
        aiResponseContent = `${persona.callSign}의 기억 목록을 보면: ${memories.map((m) => m.content).join(", ")} 정보를 완벽히 알고 있어!`;
      } else {
        aiResponseContent = `네! ${persona.callSign}, 말씀하신 내용("${currentQuery}")에 대해 ${persona.personality} 성격과 ${persona.tone}로 언제든 같이 대화해줄게!`;
      }
    }

    const aiMsg: TestMessage = {
      id: `msg_${Date.now() + 1}`,
      role: "assistant",
      content: aiResponseContent,
      toolCall: usedTool || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages([...newChatHistory, aiMsg]);
    setIsAiThinking(false);
    setToolLogs([]);
  };

  const handleResetChat = () => {
    setMessages([]);
    localStorage.removeItem("soda_ailab_chat_history");
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF9F6] text-[#1D1D1F] font-sans antialiased overflow-hidden select-none">
      {/* ── Top Header Toolbar ── */}
      <header className="h-14 px-6 border-b border-[#EAE6DF] bg-white flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#1D1D1F] text-white rounded-xl shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-[#1D1D1F]">
                소다봇빌더
              </h1>
              <span className="text-[10px] font-extrabold tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full uppercase">
                SODA AI LAB 6주차 · Glass Box MVP
              </span>
            </div>
            <p className="text-[11px] text-[#86868B]">
              AI의 속마음(Prompt, Memory, Context, Tool)을 눈으로 보며 투명하게 설계하는 실험실
            </p>
          </div>
        </div>

        {/* AI Quick Status Pill */}
        <div className="flex items-center gap-2 bg-[#F5F4F0] px-3 py-1.5 rounded-full border border-[#EAE6DF] text-xs font-medium text-[#5C5B57]">
          <span className="flex items-center gap-1">
            <Bot className="w-3.5 h-3.5 text-indigo-600" />
            <strong className="text-[#1D1D1F]">{persona.name}</strong> ({persona.role})
          </span>
          <span className="text-[#C7C6C1]">|</span>
          <span className="flex items-center gap-1">
            <Brain className="w-3.5 h-3.5 text-amber-600" />
            기억 {memories.length}개
          </span>
          <span className="text-[#C7C6C1]">|</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            Context {contextLimit}턴
          </span>
          <span className="text-[#C7C6C1]">|</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${toolsEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>
            Tool {toolsEnabled ? "ON" : "OFF"}
          </span>
        </div>
      </header>

      {/* ── Main 3-Column Glass Box Workspace ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ========================================================================= */}
        {/* COLUMN 1: LEFT SIDEBAR - AI SETTINGS (Persona, Profile, Memory, Tool)    */}
        {/* ========================================================================= */}
        <aside className="w-[340px] border-r border-[#EAE6DF] bg-white flex flex-col shrink-0">
          {/* Sub-tabs */}
          <div className="p-2 grid grid-cols-4 gap-1 bg-[#F5F4F0] border-b border-[#EAE6DF]">
            <button
              onClick={() => setSidebarTab("persona")}
              className={`py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all ${
                sidebarTab === "persona"
                  ? "bg-white text-[#1D1D1F] shadow-2xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              <Bot className="w-3.5 h-3.5" /> 친구
            </button>
            <button
              onClick={() => setSidebarTab("profile")}
              className={`py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all ${
                sidebarTab === "profile"
                  ? "bg-white text-[#1D1D1F] shadow-2xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              <User className="w-3.5 h-3.5" /> 프로필
            </button>
            <button
              onClick={() => setSidebarTab("memory")}
              className={`py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all relative ${
                sidebarTab === "memory"
                  ? "bg-white text-[#1D1D1F] shadow-2xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              <Brain className="w-3.5 h-3.5" /> 기억
              {memories.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 absolute top-1 right-1" />
              )}
            </button>
            <button
              onClick={() => setSidebarTab("tool")}
              className={`py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all ${
                sidebarTab === "tool"
                  ? "bg-white text-[#1D1D1F] shadow-2xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              <Zap className="w-3.5 h-3.5" /> 툴/설정
            </button>
          </div>

          {/* Form Content Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* 1. Persona Tab */}
            {sidebarTab === "persona" && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-[#EAE6DF]">
                  <div>
                    <h3 className="text-xs font-bold text-[#1D1D1F] uppercase tracking-wider">
                      1. AI 친구 (Persona)
                    </h3>
                    <p className="text-[11px] text-[#86868B]">
                      AI의 이름과 성격, 역할을 정의해요.
                    </p>
                  </div>
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5C5B57] mb-1">
                    AI 이름
                  </label>
                  <input
                    type="text"
                    value={persona.name}
                    onChange={(e) => setPersona({ ...persona, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-medium"
                    placeholder="예) 루미"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5C5B57] mb-1">
                    한줄 소개
                  </label>
                  <input
                    type="text"
                    value={persona.intro}
                    onChange={(e) => setPersona({ ...persona, intro: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl focus:bg-white focus:border-indigo-500 outline-none transition-all"
                    placeholder="예) 공부를 도와주는 친근한 소다봇"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5C5B57] mb-1">
                    역할 선택
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {["공부친구", "코딩친구", "응원친구", "상담친구"].map((role) => (
                      <button
                        key={role}
                        onClick={() => setPersona({ ...persona, role })}
                        className={`px-2.5 py-1.5 text-xs rounded-xl border text-left font-medium transition-all ${
                          persona.role === role
                            ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold"
                            : "bg-[#FAF9F6] border-[#EAE6DF] text-[#5C5B57] hover:bg-white"
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5C5B57] mb-1">
                    말투
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {["존댓말", "친근한 친구말", "선생님 말투"].map((tone) => (
                      <button
                        key={tone}
                        onClick={() => setPersona({ ...persona, tone })}
                        className={`px-2 py-1.5 text-[11px] rounded-xl border text-center font-medium transition-all ${
                          persona.tone === tone
                            ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold"
                            : "bg-[#FAF9F6] border-[#EAE6DF] text-[#5C5B57] hover:bg-white"
                        }`}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5C5B57] mb-1">
                    성격
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {["친절함", "차분함", "유쾌함", "논리적"].map((personality) => (
                      <button
                        key={personality}
                        onClick={() => setPersona({ ...persona, personality })}
                        className={`px-2.5 py-1.5 text-xs rounded-xl border text-left font-medium transition-all ${
                          persona.personality === personality
                            ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold"
                            : "bg-[#FAF9F6] border-[#EAE6DF] text-[#5C5B57] hover:bg-white"
                        }`}
                      >
                        {personality}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5C5B57] mb-1">
                    나를 부르는 호칭
                  </label>
                  <input
                    type="text"
                    value={persona.callSign}
                    onChange={(e) => setPersona({ ...persona, callSign: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-medium"
                    placeholder="예) 민준아, 학생님"
                  />
                </div>
              </div>
            )}

            {/* 2. Profile Tab */}
            {sidebarTab === "profile" && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-[#EAE6DF]">
                  <div>
                    <h3 className="text-xs font-bold text-[#1D1D1F] uppercase tracking-wider">
                      2. Profile (학생 영구 정보)
                    </h3>
                    <p className="text-[11px] text-[#86868B]">
                      항상 Prompt 앞부분에 자동으로 주입됩니다.
                    </p>
                  </div>
                  <User className="w-4 h-4 text-emerald-600" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5C5B57] mb-1">
                    내 이름
                  </label>
                  <input
                    type="text"
                    value={profile.userName}
                    onChange={(e) => setProfile({ ...profile, userName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl focus:bg-white focus:border-emerald-500 outline-none transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5C5B57] mb-1">
                    학교
                  </label>
                  <input
                    type="text"
                    value={profile.school}
                    onChange={(e) => setProfile({ ...profile, school: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl focus:bg-white focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5C5B57] mb-1">
                    취미
                  </label>
                  <input
                    type="text"
                    value={profile.hobby}
                    onChange={(e) => setProfile({ ...profile, hobby: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl focus:bg-white focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5C5B57] mb-1">
                    관심사
                  </label>
                  <input
                    type="text"
                    value={profile.interests}
                    onChange={(e) => setProfile({ ...profile, interests: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl focus:bg-white focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5C5B57] mb-1">
                    목표
                  </label>
                  <input
                    type="text"
                    value={profile.goal}
                    onChange={(e) => setProfile({ ...profile, goal: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl focus:bg-white focus:border-emerald-500 outline-none transition-all font-medium text-emerald-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5C5B57] mb-1">
                    좋아하는 것
                  </label>
                  <input
                    type="text"
                    value={profile.likes}
                    onChange={(e) => setProfile({ ...profile, likes: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl focus:bg-white focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5C5B57] mb-1">
                    싫어하는 것
                  </label>
                  <input
                    type="text"
                    value={profile.dislikes}
                    onChange={(e) => setProfile({ ...profile, dislikes: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl focus:bg-white focus:border-emerald-500 outline-none transition-all text-red-600"
                  />
                </div>
              </div>
            )}

            {/* 3. Memory Tab */}
            {sidebarTab === "memory" && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-[#EAE6DF]">
                  <div>
                    <h3 className="text-xs font-bold text-[#1D1D1F] uppercase tracking-wider">
                      4 & 5. Memory UI (직접 기억 관리)
                    </h3>
                    <p className="text-[11px] text-[#86868B]">
                      학생이 직접 입력한 정보를 DB와 프롬프트에 저장합니다.
                    </p>
                  </div>
                  <Brain className="w-4 h-4 text-amber-600" />
                </div>

                {/* Add Memory Input */}
                <div className="p-3 bg-amber-50/50 border border-amber-200/80 rounded-2xl space-y-2">
                  <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> 새 기억 저장하기
                  </span>
                  <input
                    type="text"
                    value={newMemoryText}
                    onChange={(e) => setNewMemoryText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddMemory()}
                    placeholder="예) 내 강아지 이름은 초코야."
                    className="w-full px-3 py-2 text-xs bg-white border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    onClick={handleAddMemory}
                    className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
                  >
                    [기억하기] DB 저장
                  </button>
                </div>

                {/* Memory List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#5C5B57]">
                      AI가 기억하고 있는 내용 ({memories.length}개)
                    </span>
                  </div>

                  {memories.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-[#EAE6DF] rounded-2xl text-xs text-[#86868B]">
                      저장된 기억이 없습니다.
                    </div>
                  ) : (
                    memories.map((m) => (
                      <div
                        key={m.id}
                        className="p-3 bg-[#FAF9F6] border border-[#EAE6DF] hover:border-amber-300 rounded-2xl transition-all space-y-1 group"
                      >
                        {editingMemId === m.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingMemText}
                              onChange={(e) => setEditingMemText(e.target.value)}
                              className="flex-1 px-2 py-1 text-xs bg-white border border-amber-300 rounded-lg outline-none"
                            />
                            <button
                              onClick={() => handleSaveEditMemory(m.id)}
                              className="p-1.5 bg-amber-500 text-white rounded-lg"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <CheckSquare className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                              <p className="text-xs font-medium text-[#1D1D1F] leading-snug">
                                {m.content}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleStartEditMemory(m)}
                                className="p-1 text-[#86868B] hover:text-amber-600"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteMemory(m.id)}
                                className="p-1 text-[#86868B] hover:text-red-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                        <span className="text-[10px] font-mono text-[#86868B] block pt-0.5">
                          저장시간: {m.createdAt}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 4. Tool & Context Settings Tab */}
            {sidebarTab === "tool" && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-[#EAE6DF]">
                  <div>
                    <h3 className="text-xs font-bold text-[#1D1D1F] uppercase tracking-wider">
                      3 & 7. Context & Tool 설정
                    </h3>
                    <p className="text-[11px] text-[#86868B]">
                      대화 유지 길이 및 교육용 Tool 사용 여부 조절
                    </p>
                  </div>
                  <Sliders className="w-4 h-4 text-indigo-600" />
                </div>

                {/* Context Slider */}
                <div className="p-3 bg-[#FAF9F6] border border-[#EAE6DF] rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#1D1D1F] flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-indigo-600" /> Context 유지 길이
                    </label>
                    <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                      최대 {contextLimit}턴
                    </span>
                  </div>
                  <p className="text-[11px] text-[#86868B] leading-normal">
                    설정한 턴 수를 초과한 오래된 대화는 AI가 잊어버리게 됩니다.
                  </p>
                  <input
                    type="range"
                    min={2}
                    max={20}
                    step={2}
                    value={contextLimit}
                    onChange={(e) => setContextLimit(parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-[#86868B]">
                    <span>2턴 (금방 잊음)</span>
                    <span>10턴 (기본)</span>
                    <span>20턴 (오래 기억)</span>
                  </div>
                </div>

                {/* Tool Enable Switch */}
                <div className="p-3 bg-[#FAF9F6] border border-[#EAE6DF] rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <div>
                        <h4 className="text-xs font-bold text-[#1D1D1F]">
                          교육용 Tool 사용
                        </h4>
                        <p className="text-[10px] text-[#86868B]">
                          현재시간/오늘날짜/날씨/계산기
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setToolsEnabled(!toolsEnabled)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-all ${
                        toolsEnabled ? "bg-emerald-500 justify-end" : "bg-gray-300 justify-start"
                      }`}
                    >
                      <div className="w-4 h-4 bg-white rounded-full shadow-md" />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-[#EAE6DF] space-y-1.5 text-[11px] text-[#5C5B57]">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      <span>현재시간 (get_current_time)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-purple-500" />
                      <span>오늘날짜 (get_today_date)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CloudSun className="w-3.5 h-3.5 text-amber-500" />
                      <span>날씨 정보 (get_weather)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calculator className="w-3.5 h-3.5 text-emerald-500" />
                      <span>계산기 (calculate)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* COLUMN 2: CENTER - GLASS BOX PROMPT VIEWER                                */}
        {/* ========================================================================= */}
        <main className="flex-1 flex flex-col border-r border-[#EAE6DF] bg-white overflow-hidden">
          <div className="h-10 px-4 border-b border-[#EAE6DF] bg-[#FAF9F6] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-600" />
              <h2 className="text-xs font-bold text-[#1D1D1F] uppercase tracking-wider">
                8. Prompt Viewer (Glass Box 프롬프트 실시간 시각화)
              </h2>
            </div>
            <span className="text-[10px] font-mono text-[#86868B] bg-white px-2 py-0.5 rounded-md border border-[#EAE6DF]">
              읽기 전용 (Live Code)
            </span>
          </div>

          {/* Prompt Viewer Content */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FAF9F6]">
            {/* System Block */}
            <div className="bg-white border border-gray-200 rounded-2xl p-3 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold font-mono text-gray-500 border-b border-gray-100 pb-1">
                <span className="flex items-center gap-1 text-gray-700">
                  <Terminal className="w-3 h-3 text-gray-600" /> 1. SYSTEM
                </span>
                <span>기본 작동 지침</span>
              </div>
              <pre className="text-xs font-mono text-[#1D1D1F] whitespace-pre-wrap leading-relaxed">
                {promptParts.systemPart}
              </pre>
            </div>

            {/* Persona Block */}
            <div className="bg-indigo-50/40 border border-indigo-200/70 rounded-2xl p-3 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold font-mono text-indigo-700 border-b border-indigo-100 pb-1">
                <span className="flex items-center gap-1 text-indigo-800">
                  <Bot className="w-3 h-3 text-indigo-600" /> 2. PERSONA
                </span>
                <span>{persona.name}의 역할/성격</span>
              </div>
              <pre className="text-xs font-mono text-indigo-950 whitespace-pre-wrap leading-relaxed">
                {promptParts.personaPart}
              </pre>
            </div>

            {/* Profile Block */}
            <div className="bg-emerald-50/40 border border-emerald-200/70 rounded-2xl p-3 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold font-mono text-emerald-700 border-b border-emerald-100 pb-1">
                <span className="flex items-center gap-1 text-emerald-800">
                  <User className="w-3 h-3 text-emerald-600" /> 3. PROFILE
                </span>
                <span>{profile.userName} 학생 정보</span>
              </div>
              <pre className="text-xs font-mono text-emerald-950 whitespace-pre-wrap leading-relaxed">
                {promptParts.profilePart}
              </pre>
            </div>

            {/* Memory Block */}
            <div className="bg-amber-50/40 border border-amber-200/70 rounded-2xl p-3 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold font-mono text-amber-700 border-b border-amber-100 pb-1">
                <span className="flex items-center gap-1 text-amber-800">
                  <Brain className="w-3 h-3 text-amber-600" /> 4. MEMORY
                </span>
                <span>기억 ({memories.length}개)</span>
              </div>
              <pre className="text-xs font-mono text-amber-950 whitespace-pre-wrap leading-relaxed">
                {promptParts.memoryPart}
              </pre>
            </div>

            {/* Context Block */}
            <div className="bg-blue-50/40 border border-blue-200/70 rounded-2xl p-3 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold font-mono text-blue-700 border-b border-blue-100 pb-1">
                <span className="flex items-center gap-1 text-blue-800">
                  <Clock className="w-3 h-3 text-blue-600" /> 5. CONTEXT
                </span>
                <span>최근 {promptParts.activeMessagesCount}개 대화 턴</span>
              </div>
              <pre className="text-xs font-mono text-blue-950 whitespace-pre-wrap leading-relaxed">
                {promptParts.contextPart}
              </pre>
            </div>
          </div>
        </main>

        {/* ========================================================================= */}
        {/* COLUMN 3: RIGHT - AI TEST CHAT SIMULATOR                                  */}
        {/* ========================================================================= */}
        <section className="w-[380px] bg-white flex flex-col shrink-0">
          <div className="h-10 px-4 border-b border-[#EAE6DF] bg-[#FAF9F6] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <h2 className="text-xs font-bold text-[#1D1D1F] uppercase tracking-wider">
                6. AI TEST (실시간 시뮬레이션)
              </h2>
            </div>
            <button
              onClick={handleResetChat}
              title="대화 초기화"
              className="p-1 text-[#86868B] hover:text-[#1D1D1F] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FAF9F6]">
            {messages.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <div className="w-10 h-10 mx-auto rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Bot className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-[#1D1D1F]">
                  질문을 입력하여 테스트를 시작하세요!
                </p>
                <p className="text-[11px] text-[#86868B]">
                  좌측 설정을 변경한 뒤 질문을 던지면 즉시 다른 응답을 합니다.
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    m.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[10px] font-bold text-[#86868B]">
                      {m.role === "user" ? profile.userName : persona.name}
                    </span>
                    <span className="text-[9px] text-[#C7C6C1]">{m.timestamp}</span>
                  </div>

                  {/* Tool Call Log Display if executed */}
                  {m.toolCall && (
                    <div className="mb-1.5 max-w-[85%] p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
                      <div className="flex items-center gap-1 font-bold text-amber-800">
                        <Zap className="w-3 h-3 text-amber-600" /> Tool 실행됨: {m.toolCall.label}
                      </div>
                      <div className="font-mono text-[10px] bg-white/80 px-1.5 py-0.5 rounded border border-amber-200">
                        Result: {m.toolCall.result}
                      </div>
                    </div>
                  )}

                  <div
                    className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-2xs ${
                      m.role === "user"
                        ? "bg-[#1D1D1F] text-white rounded-tr-xs"
                        : "bg-white border border-[#EAE6DF] text-[#1D1D1F] rounded-tl-xs"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}

            {/* AI Thinking Animation with Tool Logs */}
            {isAiThinking && (
              <div className="flex flex-col items-start space-y-1">
                <div className="flex items-center gap-2 px-3 py-2 bg-white border border-indigo-200 rounded-2xl shadow-2xs text-xs text-indigo-700 animate-pulse">
                  <Bot className="w-3.5 h-3.5 animate-spin" />
                  <span>{persona.name} 생각 중...</span>
                </div>
                {toolLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md"
                  >
                    AI: &quot;{log}&quot;
                  </div>
                ))}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Test Input Area */}
          <div className="p-3 border-t border-[#EAE6DF] bg-white space-y-2">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="질문을 입력하세요... (예: 지금 몇 시야?)"
                className="flex-1 px-3 py-2 text-xs bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl focus:bg-white focus:border-indigo-500 outline-none transition-all"
              />
              <button
                onClick={handleSendMessage}
                disabled={isAiThinking || !inputQuestion.trim()}
                className="p-2 bg-[#1D1D1F] hover:bg-black disabled:bg-gray-300 text-white rounded-xl transition-all shadow-xs"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between text-[10px] text-[#86868B] px-1">
              <span>테스트 질문 → 응답 → Prompt 수정 무한 반복 가능</span>
              <span className="text-indigo-600 font-medium">Glass Box AI</span>
            </div>
          </div>
        </section>
      </div>

      {/* ── Bottom Section: 9. Context Viewer & 10. AI Status Bar ── */}
      <footer className="h-32 border-t border-[#EAE6DF] bg-white flex shrink-0">
        {/* Context Viewer */}
        <div className="flex-1 p-3 border-r border-[#EAE6DF] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-[#EAE6DF]">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <h3 className="text-xs font-bold text-[#1D1D1F]">
                9. Context Viewer (최근 대화버퍼 & 잊혀진 대화)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              최대 {contextLimit}턴 유지
            </span>
          </div>

          <div className="flex-1 flex gap-3 overflow-x-auto text-xs py-1">
            {/* Active Context Buffer */}
            <div className="flex-1 min-w-[240px] bg-blue-50/50 border border-blue-200/80 rounded-xl p-2 flex flex-col">
              <span className="text-[10px] font-bold text-blue-800 mb-1 flex items-center gap-1">
                <Check className="w-3 h-3 text-blue-600" /> AI가 지니고 있는 활성 대화 (
                {promptParts.activeMessagesCount}개)
              </span>
              <div className="flex-1 overflow-y-auto space-y-1 text-[11px] font-mono">
                {messages.slice(-contextLimit).map((m) => (
                  <div key={m.id} className="text-[#1D1D1F] truncate">
                    <strong className="text-blue-700">{m.role}:</strong> {m.content}
                  </div>
                ))}
              </div>
            </div>

            {/* Evicted Context */}
            <div className="w-64 bg-gray-50 border border-gray-200 rounded-xl p-2 flex flex-col">
              <span className="text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1">
                <RotateCcw className="w-3 h-3 text-gray-400" /> 잊혀진 대화 (Evicted)
              </span>
              <div className="flex-1 overflow-y-auto space-y-1 text-[10px] font-mono text-gray-400">
                {promptParts.evictedMessages.length === 0 ? (
                  <span className="text-gray-300">Context 제한 미초과 (잊혀진 대화 없음)</span>
                ) : (
                  promptParts.evictedMessages.map((m) => (
                    <div key={m.id} className="line-through truncate">
                      {m.role}: {m.content}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AI Status Dashboard */}
        <div className="w-[320px] p-3 bg-[#FAF9F6] flex flex-col justify-between">
          <div className="flex items-center gap-1.5 pb-1 border-b border-[#EAE6DF]">
            <Activity className="w-3.5 h-3.5 text-indigo-600" />
            <h3 className="text-xs font-bold text-[#1D1D1F]">10. AI 상태 대시보드</h3>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-white p-2 rounded-xl border border-[#EAE6DF]">
              <span className="text-[#86868B] block text-[10px]">Persona</span>
              <strong className="text-[#1D1D1F] truncate block">{persona.name} ({persona.role})</strong>
            </div>
            <div className="bg-white p-2 rounded-xl border border-[#EAE6DF]">
              <span className="text-[#86868B] block text-[10px]">Profile</span>
              <strong className="text-[#1D1D1F] truncate block">{profile.userName} ({profile.school})</strong>
            </div>
            <div className="bg-white p-2 rounded-xl border border-[#EAE6DF]">
              <span className="text-[#86868B] block text-[10px]">Memory 항목</span>
              <strong className="text-amber-700 font-mono block">{memories.length}개 저장됨</strong>
            </div>
            <div className="bg-white p-2 rounded-xl border border-[#EAE6DF]">
              <span className="text-[#86868B] block text-[10px]">Tool 상태</span>
              <strong className={toolsEnabled ? "text-emerald-600 font-mono block" : "text-gray-400 font-mono block"}>
                {toolsEnabled ? "4개 툴 활성화" : "비활성화"}
              </strong>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
