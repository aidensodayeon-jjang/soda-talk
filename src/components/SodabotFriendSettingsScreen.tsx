import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  User,
  Coins,
  FileText,
  Save,
  Plus,
  Trash2,
  Check,
  Star,
  Info,
  Sparkles,
  Bot,
  MessageCircle,
  X,
  Edit3
} from 'lucide-react';

export interface PersonaData {
  name: string;
  intro: string;
  role: string;
  tone: string;
  personality: string;
  callSign: string;
}

export interface ProfileData {
  userName: string;
  school: string;
  interests: string[];
  goal: string;
}

export interface MemoryData {
  id: string;
  text: string;
}

interface SodabotFriendSettingsScreenProps {
  currentUser?: {
    id: string;
    username: string;
    displayName: string;
    role?: string;
    canAccessChat?: boolean;
    personalApiKey?: string;
  } | null;
}

const ROLES = ["공부친구", "코딩친구", "응원친구", "상담친구"];
const TONES = ["존댓말", "친근한 친구말", "선생님 말투"];
const PERSONALITIES = ["친절함", "차분함", "유쾌함", "논리적"];

export default function SodabotFriendSettingsScreen({ currentUser }: SodabotFriendSettingsScreenProps) {
  const userKey = currentUser?.id || currentUser?.username || 'default';
  const getScopedKey = (key: string) => `sodabot_${userKey}_${key}`;

  // 1. 친구 설정 State
  const [persona, setPersona] = useState<PersonaData>(() => {
    try {
      const saved = localStorage.getItem(getScopedKey("friend_persona")) || localStorage.getItem("soda_ailab_persona");
      return saved
        ? JSON.parse(saved)
        : {
            name: "루미",
            intro: "언제나 나를 도와주는 든든한 AI 학습 파트너",
            role: "공부친구",
            tone: "친근한 친구말",
            personality: "친절함",
            callSign: currentUser?.displayName || "민준아"
          };
    } catch {
      return {
        name: "루미",
        intro: "언제나 나를 도와주는 든든한 AI 학습 파트너",
        role: "공부친구",
        tone: "친근한 친구말",
        personality: "친절함",
        callSign: currentUser?.displayName || "민준아"
      };
    }
  });

  // 2. 프로필 설정 State
  const [profile, setProfile] = useState<ProfileData>(() => {
    try {
      const saved = localStorage.getItem(getScopedKey("friend_profile")) || localStorage.getItem("soda_ailab_profile");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          userName: parsed.userName || currentUser?.displayName || "김민준",
          school: parsed.school || "소다중학교 1학년",
          interests: Array.isArray(parsed.interests)
            ? parsed.interests
            : typeof parsed.interests === "string" && parsed.interests
            ? parsed.interests.split(",").map((s: string) => s.trim()).filter(Boolean)
            : ["인공지능", "우주", "과학"],
          goal: parsed.goal || "과학과 진학 및 AI 개발자가 되기"
        };
      }
    } catch {}
    return {
      userName: currentUser?.displayName || "김민준",
      school: "소다중학교 1학년",
      interests: ["인공지능", "우주", "과학"],
      goal: "과학과 진학 및 AI 개발자가 되기"
    };
  });

  // 3. 기억 설정 State (최대 3개)
  const [memories, setMemories] = useState<MemoryData[]>(() => {
    try {
      const saved = localStorage.getItem(getScopedKey("friend_memories")) || localStorage.getItem("soda_ailab_memories");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, 3).map((m: any, idx: number) => ({
            id: m.id || `mem_${idx + 1}`,
            text: m.text || m.content || ""
          })).filter(m => m.text);
        }
      }
    } catch {}
    return [
      { id: "mem_1", text: "민준이는 축구와 코딩을 좋아한다." },
      { id: "mem_2", text: "강아지 이름은 초코 (푸들종)." },
      { id: "mem_3", text: "목표는 과학과 진학 및 소다봇 개발자가 되는 것이다." }
    ];
  });

  // UI Local States
  const [newInterestInput, setNewInterestInput] = useState("");
  const [newMemoryInput, setNewMemoryInput] = useState("");
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  // References for scrolling
  const friendCardRef = useRef<HTMLDivElement>(null);
  const profileCardRef = useRef<HTMLDivElement>(null);
  const memoryCardRef = useRef<HTMLDivElement>(null);

  // Synchronize to localStorage whenever changes occur
  const saveAllSettings = () => {
    localStorage.setItem(getScopedKey("friend_persona"), JSON.stringify(persona));
    localStorage.setItem(getScopedKey("friend_profile"), JSON.stringify(profile));
    localStorage.setItem(getScopedKey("friend_memories"), JSON.stringify(memories));

    // Global AI lab sync
    localStorage.setItem("soda_ailab_persona", JSON.stringify(persona));
    localStorage.setItem("soda_ailab_profile", JSON.stringify(profile));
    localStorage.setItem("soda_ailab_memories", JSON.stringify(memories.map(m => ({ id: m.id, content: m.text }))));

    // AI Chat persona sync string
    const personaSummary = `[소다봇 친구설정]\n• 봇 이름: ${persona.name} (${persona.intro})\n• 역할: ${persona.role}, 말투: ${persona.tone}, 성격: ${persona.personality}\n• 사용자: ${profile.userName} (${profile.school})\n• 사용자 호칭: ${persona.callSign}\n• 관심사: ${profile.interests.join(", ")}\n• 목표: ${profile.goal}\n• 기억하고 있는 내용:\n${memories.map((m, idx) => `  ${idx + 1}. ${m.text}`).join("\n")}`;
    localStorage.setItem(getScopedKey("persona_summary"), personaSummary);

    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  };

  const handleAddInterest = () => {
    const trimmed = newInterestInput.trim();
    if (!trimmed) return;
    if (!profile.interests.includes(trimmed)) {
      setProfile(prev => ({ ...prev, interests: [...prev.interests, trimmed] }));
    }
    setNewInterestInput("");
  };

  const handleRemoveInterest = (target: string) => {
    setProfile(prev => ({
      ...prev,
      interests: prev.interests.filter(item => item !== target)
    }));
  };

  const handleAddMemory = () => {
    const trimmed = newMemoryInput.trim();
    if (!trimmed) return;
    if (memories.length >= 3) {
      alert("기억은 최대 3개까지만 저장할 수 있습니다.");
      return;
    }
    setMemories(prev => [
      ...prev,
      { id: `mem_${Date.now()}`, text: trimmed }
    ]);
    setNewMemoryInput("");
    setIsAddingMemory(false);
  };

  const handleRemoveMemory = (id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-[#F8FAFC] select-none text-[#1D1D1F]">
      {/* Toast Alert */}
      {saveToast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 font-bold text-sm animate-fade-in">
          <Check className="w-5 h-5 bg-white/20 rounded-full p-0.5" />
          <span>소다봇 친구 설정이 안전하게 저장되었습니다!</span>
        </div>
      )}

      {/* Main Container */}
      <div className="p-6 md:p-8 max-w-[1520px] mx-auto w-full space-y-6">
        {/* Top Header */}
        <div className="flex items-center gap-3.5 pb-3 border-b border-slate-200/60">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-[#1E293B] tracking-tight">
              소다봇 친구설정
            </h1>
            <p className="text-xs md:text-sm text-[#64748B] font-medium mt-0.5">
              AI 친구의 성격뿐 아니라 프로필과 기억도 함께 설정해보세요.
            </p>
          </div>
        </div>

        {/* 4-Column Grid: 3 Setting Cards + 1 Summary Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
          
          {/* ============================================================ */}
          {/* 1. 친구 설정 카드 */}
          {/* ============================================================ */}
          <div
            ref={friendCardRef}
            className="bg-white rounded-3xl border border-[#E2E8F0] p-6 shadow-sm flex flex-col justify-between h-full space-y-5"
          >
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1E293B]">친구 설정</h2>
                  <p className="text-[11px] text-[#94A3B8]">AI 친구의 이름과 성격을 정해보세요.</p>
                </div>
              </div>

              {/* AI 이름 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#334155] block">AI 이름</label>
                <input
                  type="text"
                  value={persona.name}
                  onChange={e => setPersona(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="예: 루미"
                  className="w-full text-xs px-3.5 py-2.5 bg-[#FAF9F6] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-blue-500 font-semibold transition-all"
                />
              </div>

              {/* 한줄 소개 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#334155] block">한줄 소개</label>
                <input
                  type="text"
                  value={persona.intro}
                  onChange={e => setPersona(prev => ({ ...prev, intro: e.target.value }))}
                  placeholder="예: 언제나 나를 도와주는 든든한 AI 학습 파트너"
                  className="w-full text-xs px-3.5 py-2.5 bg-[#FAF9F6] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-blue-500 font-medium transition-all"
                />
              </div>

              {/* 역할 선택 (2x2 Grid) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#334155] block">역할 선택</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(role => {
                    const isSelected = persona.role === role;
                    return (
                      <button
                        key={role}
                        onClick={() => setPersona(prev => ({ ...prev, role }))}
                        className={`py-2 px-3 rounded-full text-xs font-bold transition-all border text-center cursor-pointer ${
                          isSelected
                            ? "bg-blue-50 border-blue-500 text-blue-600 shadow-2xs"
                            : "bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:bg-slate-100/60"
                        }`}
                      >
                        {role}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 말투 선택 (3 Buttons) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#334155] block">말투 선택</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {TONES.map(tone => {
                    const isSelected = persona.tone === tone;
                    return (
                      <button
                        key={tone}
                        onClick={() => setPersona(prev => ({ ...prev, tone }))}
                        className={`py-2 px-2 rounded-full text-[11px] font-bold transition-all border text-center cursor-pointer truncate ${
                          isSelected
                            ? "bg-blue-50 border-blue-500 text-blue-600 shadow-2xs"
                            : "bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:bg-slate-100/60"
                        }`}
                      >
                        {tone}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 성격 선택 (4 Buttons) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#334155] block">성격 선택</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {PERSONALITIES.map(pers => {
                    const isSelected = persona.personality === pers;
                    return (
                      <button
                        key={pers}
                        onClick={() => setPersona(prev => ({ ...prev, personality: pers }))}
                        className={`py-2 px-1.5 rounded-full text-[11px] font-bold transition-all border text-center cursor-pointer truncate ${
                          isSelected
                            ? "bg-blue-50 border-blue-500 text-blue-600 shadow-2xs"
                            : "bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:bg-slate-100/60"
                        }`}
                      >
                        {pers}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 나를 부르는 호칭 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#334155] block">나를 부르는 호칭</label>
                <input
                  type="text"
                  value={persona.callSign}
                  onChange={e => setPersona(prev => ({ ...prev, callSign: e.target.value }))}
                  placeholder="예: 민준아"
                  className="w-full text-xs px-3.5 py-2.5 bg-[#FAF9F6] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-blue-500 font-semibold transition-all"
                />
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* 2. 프로필 설정 카드 */}
          {/* ============================================================ */}
          <div
            ref={profileCardRef}
            className="bg-white rounded-3xl border border-[#E2E8F0] p-6 shadow-sm flex flex-col justify-between h-full space-y-5"
          >
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1E293B]">프로필 설정</h2>
                  <p className="text-[11px] text-[#94A3B8]">AI 친구가 나를 더 잘 이해할 수 있도록 작성해보세요.</p>
                </div>
              </div>

              {/* 이름 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#334155] block">이름</label>
                <input
                  type="text"
                  value={profile.userName}
                  onChange={e => setProfile(prev => ({ ...prev, userName: e.target.value }))}
                  placeholder="예: 김민준"
                  className="w-full text-xs px-3.5 py-2.5 bg-[#FAF9F6] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-emerald-500 font-semibold transition-all"
                />
              </div>

              {/* 학교 / 학년 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#334155] block">학교 / 학년</label>
                <input
                  type="text"
                  value={profile.school}
                  onChange={e => setProfile(prev => ({ ...prev, school: e.target.value }))}
                  placeholder="예: 소다중학교 1학년"
                  className="w-full text-xs px-3.5 py-2.5 bg-[#FAF9F6] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-emerald-500 font-medium transition-all"
                />
              </div>

              {/* 관심사 (여러 개 입력 가능) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#334155] block">관심사 (여러 개 입력 가능)</label>
                
                {/* 태그 칩 리스트 */}
                <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                  {profile.interests.map(item => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200/80 text-blue-600 rounded-full text-xs font-bold shadow-2xs animate-fade-in"
                    >
                      <span>{item}</span>
                      <button
                        onClick={() => handleRemoveInterest(item)}
                        className="hover:text-red-500 transition-colors cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* 태그 추가 인풋 */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newInterestInput}
                    onChange={e => setNewInterestInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.nativeEvent.isComposing) return;
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddInterest();
                      }
                    }}
                    placeholder="관심사를 추가해보세요."
                    className="flex-1 text-xs px-3.5 py-2 bg-[#FAF9F6] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={handleAddInterest}
                    className="p-2 bg-[#FAF9F6] hover:bg-emerald-50 hover:text-emerald-600 border border-[#E2E8F0] text-[#64748B] rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 목표 (선택) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#334155] block">목표 (선택)</label>
                <textarea
                  value={profile.goal}
                  onChange={e => setProfile(prev => ({ ...prev, goal: e.target.value }))}
                  placeholder="예: 과학과 진학 및 AI 개발자가 되기"
                  rows={3}
                  className="w-full text-xs p-3 bg-[#FAF9F6] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-emerald-500 font-medium resize-none leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* 3. 기억 설정 카드 */}
          {/* ============================================================ */}
          <div
            ref={memoryCardRef}
            className="bg-white rounded-3xl border border-[#E2E8F0] p-6 shadow-sm flex flex-col justify-between h-full space-y-5"
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1E293B]">기억 설정</h2>
                  <p className="text-[11px] text-[#94A3B8]">AI 친구가 기억할 중요한 정보를 저장해보세요.</p>
                </div>
              </div>

              {/* Tip Banner */}
              <div className="p-3.5 bg-gradient-to-r from-amber-50/90 to-yellow-50/60 border border-amber-200/80 rounded-2xl flex items-start gap-2.5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-amber-900">중요한 정보 3개까지 기억해요!</div>
                  <div className="text-[11px] text-amber-700 mt-0.5 leading-snug">
                    저장한 내용은 AI 친구와의 대화에서 활용돼요.
                  </div>
                </div>
              </div>

              {/* 기억 리스트 (최대 3개) */}
              <div className="space-y-2.5">
                {memories.map((mem, idx) => (
                  <div
                    key={mem.id}
                    className="flex items-center justify-between p-3 bg-[#FAF9F6] border border-[#E2E8F0] rounded-2xl gap-2.5 transition-all hover:border-amber-300"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xs text-[#334155] font-medium truncate">
                        {mem.text}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveMemory(mem.id)}
                      className="text-[#94A3B8] hover:text-red-500 transition-colors p-1 cursor-pointer shrink-0"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* 상시 기억 입력창 (3개 미만일 때 항상 노출) */}
                {memories.length < 3 ? (
                  <div className="p-2.5 bg-amber-50/40 border border-amber-200 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newMemoryInput}
                        onChange={e => setNewMemoryInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.nativeEvent.isComposing) return;
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddMemory();
                          }
                        }}
                        placeholder="새로운 기억을 입력하세요 (엔터 또는 추가)"
                        className="flex-1 text-xs px-3 py-2 bg-white border border-amber-200 rounded-xl focus:outline-none focus:border-amber-500"
                      />
                      <button
                        onClick={handleAddMemory}
                        disabled={!newMemoryInput.trim()}
                        className="px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>추가</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-center text-[11px] text-slate-500 font-medium">
                    ✨ 기억 3개가 모두 등록되었습니다.
                  </div>
                )}
              </div>
            </div>

            {/* Gauge & Info Footer */}
            <div className="space-y-1.5 pt-3 border-t border-slate-100">
              <div className="flex justify-between items-center text-xs font-bold text-[#64748B]">
                <span>{memories.length} / 3개 저장됨</span>
              </div>
              <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${(memories.length / 3) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-[#94A3B8] flex items-center gap-1 pt-0.5">
                <Info className="w-3 h-3 text-amber-500 shrink-0" />
                <span>가장 중요한 정보 3개를 선택해서 저장해주세요.</span>
              </p>
            </div>
          </div>

          {/* ============================================================ */}
          {/* 4. 현재 설정 요약 사이드바 */}
          {/* ============================================================ */}
          <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 shadow-sm flex flex-col justify-between h-full space-y-5">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1E293B]">현재 설정 요약</h2>
                  <p className="text-[11px] text-[#94A3B8]">지금까지 설정한 내용을 한눈에 확인하세요.</p>
                </div>
              </div>

              {/* Block 1: 친구 설정 */}
              <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[#1E293B]">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>친구 설정</span>
                  </div>
                  <button
                    onClick={() => scrollToSection(friendCardRef)}
                    className="px-2 py-0.5 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
                  >
                    수정
                  </button>
                </div>
                <div className="grid grid-cols-[55px_1fr] gap-y-1 text-[11px]">
                  <span className="text-[#94A3B8] font-medium">이름</span>
                  <span className="font-bold text-[#334155]">{persona.name || "-"}</span>
                  <span className="text-[#94A3B8] font-medium">한줄 소개</span>
                  <span className="font-medium text-[#334155] leading-snug">{persona.intro || "-"}</span>
                  <span className="text-[#94A3B8] font-medium">역할</span>
                  <span className="font-bold text-blue-600">{persona.role || "-"}</span>
                  <span className="text-[#94A3B8] font-medium">말투</span>
                  <span className="font-medium text-[#334155]">{persona.tone || "-"}</span>
                  <span className="text-[#94A3B8] font-medium">성격</span>
                  <span className="font-medium text-[#334155]">{persona.personality || "-"}</span>
                  <span className="text-[#94A3B8] font-medium">호칭</span>
                  <span className="font-bold text-[#334155]">{persona.callSign || "-"}</span>
                </div>
              </div>

              {/* Block 2: 프로필 설정 */}
              <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[#1E293B]">
                    <User className="w-3.5 h-3.5 text-emerald-600" />
                    <span>프로필 설정</span>
                  </div>
                  <button
                    onClick={() => scrollToSection(profileCardRef)}
                    className="px-2 py-0.5 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
                  >
                    수정
                  </button>
                </div>
                <div className="grid grid-cols-[55px_1fr] gap-y-1 text-[11px]">
                  <span className="text-[#94A3B8] font-medium">이름</span>
                  <span className="font-bold text-[#334155]">{profile.userName || "-"}</span>
                  <span className="text-[#94A3B8] font-medium">학교 / 학년</span>
                  <span className="font-medium text-[#334155]">{profile.school || "-"}</span>
                  <span className="text-[#94A3B8] font-medium">관심사</span>
                  <span className="font-medium text-[#334155]">{profile.interests.join(", ") || "-"}</span>
                  <span className="text-[#94A3B8] font-medium">목표</span>
                  <span className="font-medium text-[#334155] leading-snug">{profile.goal || "-"}</span>
                </div>
              </div>

              {/* Block 3: 기억 설정 */}
              <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[#1E293B]">
                    <Coins className="w-3.5 h-3.5 text-amber-500" />
                    <span>기억 설정</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      {memories.length}개 저장됨
                    </span>
                    <button
                      onClick={() => scrollToSection(memoryCardRef)}
                      className="px-2 py-0.5 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
                    >
                      수정
                    </button>
                  </div>
                </div>
                <div className="space-y-1 text-[11px]">
                  {memories.length === 0 ? (
                    <span className="text-[#94A3B8] text-[11px]">저장된 기억이 없습니다.</span>
                  ) : (
                    memories.map((m, idx) => (
                      <div key={m.id} className="flex items-start gap-1.5 text-[11px] text-[#334155]">
                        <span className="font-bold text-amber-600 shrink-0">{idx + 1}</span>
                        <span className="font-medium leading-snug">{m.text}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Save Action Bar */}
        <div className="bg-white rounded-3xl border border-[#E2E8F0] p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#1E293B]">
                모든 친구 및 프로필 설정 준비 완료
              </div>
              <p className="text-xs text-[#64748B] font-medium">
                저장 버튼을 누르면 AI 친구 성격, 사용자 프로필, 3가지 기억이 소다봇 대화에 즉시 적용됩니다.
              </p>
            </div>
          </div>

          <button
            onClick={saveAllSettings}
            className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2.5 cursor-pointer shrink-0"
          >
            <Save className="w-5 h-5" />
            <span>전체 설정 저장하기</span>
          </button>
        </div>
      </div>
    </div>
  );
}
