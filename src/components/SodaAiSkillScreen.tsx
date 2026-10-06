import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Languages,
  Code2,
  GraduationCap,
  HeartHandshake,
  Mic,
  Plus,
  CheckCircle2,
  Sliders,
  Play,
  Send,
  Save,
  RotateCcw,
  BookOpen,
  FileText,
  Copy,
  Printer,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  HelpCircle,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Cpu,
  RefreshCw,
  Sparkle,
  Image as ImageIcon,
  Trash2,
  History,
  GitCompare,
  Eye,
  Check,
  Zap,
  Info
} from 'lucide-react';
import {
  AiSkillConfig,
  AiSkillType,
  AiSkillTestLog,
  AiSkillVersionSnapshot,
  AiSkillProjectReport,
  User,
  Message
} from '../types';
import {
  DEFAULT_AI_SKILL_TEMPLATES,
  compileAiSkillPrompt,
  generateInitialReport,
  generateSkillSimulatedReply
} from '../utils/aiSkillUtils';

interface SodaAiSkillScreenProps {
  currentUser?: User | null;
  onNavigateToChat?: () => void;
  isSodabotConnected?: boolean;
}

type StepType = 'select' | 'configure' | 'test' | 'logs' | 'improve' | 'report';

export default function SodaAiSkillScreen({
  currentUser,
  onNavigateToChat,
  isSodabotConnected = false
}: SodaAiSkillScreenProps) {
  const userKey = currentUser?.id || currentUser?.username || 'default';
  const getScopedKey = (key: string) => `sodabot_${userKey}_${key}`;

  // 현재 스텝
  const [currentStep, setCurrentStep] = useState<StepType>('select');

  // 스킬 목록 & 활성 스킬
  const [skills, setSkills] = useState<AiSkillConfig[]>(() => {
    try {
      const saved = localStorage.getItem(getScopedKey('ai_skills'));
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_AI_SKILL_TEMPLATES;
  });

  const [activeSkillId, setActiveSkillId] = useState<string>(() => {
    return localStorage.getItem(getScopedKey('active_skill_id')) || 'skill-english-buddy';
  });

  // 현재 편집/조회 중인 스킬
  const [selectedSkillId, setSelectedSkillId] = useState<string>('skill-english-buddy');

  // 테스트 채팅 메시지
  const [testMessages, setTestMessages] = useState<Message[]>([
    {
      id: 'init-msg',
      sender: 'assistant',
      text: '안녕! 나는 네가 설정한 AI 스킬을 장착한 소다봇이야 🤖 무엇이든 물어보거나 테스트해봐!',
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // 활용/테스트 기록
  const [testLogs, setTestLogs] = useState<AiSkillTestLog[]>(() => {
    try {
      const saved = localStorage.getItem(getScopedKey('ai_skill_logs'));
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // 기록 추가 모달 / 폼 상태
  const [logForm, setLogForm] = useState<{
    situation: string;
    userQuestion: string;
    aiResponse: string;
    goodPoints: string;
    badPoints: string;
    modifications: string;
  }>({
    situation: '',
    userQuestion: '',
    aiResponse: '',
    goodPoints: '',
    badPoints: '',
    modifications: ''
  });
  const [showLogModal, setShowLogModal] = useState(false);

  // 버전 스냅샷 (개선 전/후 비교)
  const [versionSnapshots, setVersionSnapshots] = useState<AiSkillVersionSnapshot[]>(() => {
    try {
      const saved = localStorage.getItem(getScopedKey('ai_skill_snapshots'));
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // 프로젝트 보고서
  const [report, setReport] = useState<AiSkillProjectReport>(() => {
    const active = skills.find(s => s.id === activeSkillId) || skills[0] || DEFAULT_AI_SKILL_TEMPLATES[0];
    try {
      const saved = localStorage.getItem(getScopedKey('ai_skill_report'));
      if (saved) return JSON.parse(saved);
    } catch {}
    return generateInitialReport(currentUser?.displayName || '소다학생', '루미봇', active, []);
  });

  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // 현재 선택된 스킬 객체
  const currentSkill = skills.find(s => s.id === selectedSkillId) || skills[0] || DEFAULT_AI_SKILL_TEMPLATES[0];

  // 로컬 스토리지 & 서버 동기화
  useEffect(() => {
    localStorage.setItem(getScopedKey('ai_skills'), JSON.stringify(skills));
    localStorage.setItem(getScopedKey('active_skill_id'), activeSkillId);
    localStorage.setItem(getScopedKey('ai_skill_logs'), JSON.stringify(testLogs));
    localStorage.setItem(getScopedKey('ai_skill_snapshots'), JSON.stringify(versionSnapshots));
    localStorage.setItem(getScopedKey('ai_skill_report'), JSON.stringify(report));

    // 서버로 백업 동기화
    const token = localStorage.getItem('soda_token') || currentUser?.personalApiKey;
    if (token) {
      fetch('/api/user/ai-skills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          activeSkillId,
          skills,
          testLogs,
          versionSnapshots,
          report
        })
      }).catch(err => console.warn('AI Skill cloud sync failed:', err));
    }
  }, [skills, activeSkillId, testLogs, versionSnapshots, report]);

  // 컴포넌트 마운트 시 서버에서 데이터 불러오기
  useEffect(() => {
    const token = localStorage.getItem('soda_token') || currentUser?.personalApiKey;
    if (token) {
      fetch('/api/user/ai-skills', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.aiSkillState) {
            const state = data.aiSkillState;
            if (state.skills && state.skills.length > 0) setSkills(state.skills);
            if (state.activeSkillId) setActiveSkillId(state.activeSkillId);
            if (state.testLogs) setTestLogs(state.testLogs);
            if (state.versionSnapshots) setVersionSnapshots(state.versionSnapshots);
            if (state.report) setReport(state.report);
          }
        })
        .catch(err => console.warn('Failed to load remote AI skill state:', err));
    }
  }, []);

  // 채팅 스크롤 자동 이동
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [testMessages, isGenerating]);

  // 토스트 메시지
  const triggerToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3000);
  };

  // 스킬 업데이트 헬퍼
  const updateCurrentSkill = (updater: (prev: AiSkillConfig) => AiSkillConfig) => {
    setSkills(prev =>
      prev.map(s => {
        if (s.id === selectedSkillId) {
          const updated = updater(s);
          return {
            ...updated,
            updatedAt: new Date().toISOString()
          };
        }
        return s;
      })
    );
  };

  // 스킬 활성화 (내 소다봇에 적용)
  const handleActivateSkill = (skillId: string) => {
    setActiveSkillId(skillId);
    setSkills(prev =>
      prev.map(s => ({
        ...s,
        isActive: s.id === skillId
      }))
    );
    const token = localStorage.getItem('soda_token') || currentUser?.personalApiKey;
    if (token) {
      fetch('/api/user/ai-skills/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ skillId })
      }).catch(console.error);
    }
    const target = skills.find(s => s.id === skillId);
    triggerToast(`✨ '${target?.name || 'AI 스킬'}'이(가) 내 소다봇에 즉시 적용되었습니다! (펌웨어 수정 불필요)`);
  };

  // 테스트 메시지 전송
  const handleSendTestMessage = async () => {
    if (!inputQuery.trim() || isGenerating) return;

    const userText = inputQuery.trim();
    setInputQuery('');

    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toISOString()
    };

    const nextHistory = [...testMessages, userMsg];
    setTestMessages(nextHistory);
    setIsGenerating(true);

    try {
      const token = localStorage.getItem('soda_token') || currentUser?.personalApiKey;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let reply = "";

      // 1. AI 스킬 테스트 전용 엔드포인트 호출
      try {
        const res = await fetch('/api/ai-skills/test-chat', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            text: userText,
            skill: currentSkill,
            history: nextHistory.map(m => ({ sender: m.sender, text: m.text }))
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.reply) reply = data.reply;
        }
      } catch (netErr) {
        console.warn('Backend test chat call failed, falling back to instant client simulator:', netErr);
      }

      // 2. 서버가 응답하지 않거나 오프라인인 경우에도 완벽한 지능형 시뮬레이션 응답 즉시 생성
      if (!reply) {
        reply = generateSkillSimulatedReply(currentSkill, userText, currentUser?.displayName || '친구');
      }

      const assistantMsg: Message = {
        id: `msg-${Date.now()}-bot`,
        sender: 'assistant',
        text: reply,
        timestamp: new Date().toISOString()
      };

      setTestMessages(prev => [...prev, assistantMsg]);

      // 원클릭 기록 추가 폼 자동 채움 준비
      setLogForm({
        situation: `${currentSkill.name} V${currentSkill.version} 대화 테스트`,
        userQuestion: userText,
        aiResponse: reply,
        goodPoints: '',
        badPoints: '',
        modifications: ''
      });
    } catch (err: any) {
      console.error('Test chat error:', err);
      const fallbackReply = generateSkillSimulatedReply(currentSkill, userText, currentUser?.displayName || '친구');
      setTestMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now()}-bot`,
          sender: 'assistant',
          text: fallbackReply,
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  // 기록 저장
  const handleSaveLog = () => {
    if (!logForm.userQuestion || !logForm.aiResponse) {
      alert('질문과 답변 내용이 필요합니다.');
      return;
    }

    const newLog: AiSkillTestLog = {
      id: `log-${Date.now()}`,
      skillId: currentSkill.id,
      skillName: currentSkill.name,
      version: currentSkill.version,
      situation: logForm.situation || '일상 대화 테스트',
      userQuestion: logForm.userQuestion,
      aiResponse: logForm.aiResponse,
      timestamp: new Date().toISOString(),
      goodPoints: logForm.goodPoints,
      badPoints: logForm.badPoints,
      modifications: logForm.modifications,
      source: 'web'
    };

    setTestLogs(prev => [newLog, ...prev]);
    setShowLogModal(false);
    triggerToast('📝 프로젝트 활용 기록에 성공적으로 저장되었습니다!');

    // 보고서 자동 업데이트
    setReport(prev => ({
      ...prev,
      actualLogs: [newLog, ...(prev.actualLogs || [])].slice(0, 8),
      goodPoints: newLog.goodPoints ? newLog.goodPoints : prev.goodPoints,
      painPoints: newLog.badPoints ? newLog.badPoints : prev.painPoints,
      modifications: newLog.modifications ? newLog.modifications : prev.modifications
    }));
  };

  // 새 버전으로 개선 (Version 1 -> Version 2 등)
  const handleCreateNewVersion = () => {
    const currentVer = currentSkill.version || 1;
    const newVer = currentVer + 1;

    // 1. 현재 버전을 스냅샷으로 백업
    const snapshot: AiSkillVersionSnapshot = {
      id: `snap-${Date.now()}`,
      skillId: currentSkill.id,
      version: currentVer,
      config: JSON.parse(JSON.stringify(currentSkill)),
      notes: `V${currentVer} 설정 백업`,
      sampleQuestion: testMessages.filter(m => m.sender === 'user').slice(-1)[0]?.text,
      sampleResponse: testMessages.filter(m => m.sender === 'assistant').slice(-1)[0]?.text,
      createdAt: new Date().toISOString()
    };

    setVersionSnapshots(prev => [snapshot, ...prev]);

    // 2. 현재 스킬의 버전을 올림
    updateCurrentSkill(s => ({
      ...s,
      version: newVer
    }));

    triggerToast(`🎉 스킬이 VERSION ${newVer}(으)로 업그레이드되었습니다! 설정을 다듬고 다시 테스트해보세요.`);
    setCurrentStep('configure');
  };

  // 보고서 자동 완성 생성
  const handleAutoGenerateReport = () => {
    const generated = generateInitialReport(
      currentUser?.displayName || '소다학생',
      '루미봇',
      currentSkill,
      testLogs
    );
    setReport(generated);
    triggerToast('📊 10대 항목 프로젝트 보고서가 자동으로 구성되었습니다!');
  };

  // 스킬 아이콘 렌더러
  const renderSkillIcon = (iconName: string, className: string = 'w-5 h-5') => {
    switch (iconName) {
      case 'Languages': return <Languages className={className} />;
      case 'Code2': return <Code2 className={className} />;
      case 'GraduationCap': return <GraduationCap className={className} />;
      case 'HeartHandshake': return <HeartHandshake className={className} />;
      case 'Mic': return <Mic className={className} />;
      case 'Sparkles': return <Sparkles className={className} />;
      default: return <Sparkles className={className} />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F5F5F7] overflow-y-auto text-[#1D1D1F]">
      {/* 1. 상단 헤더 & 배너 */}
      <div className="bg-white border-b border-[#EAE6DF] px-6 py-4 sticky top-0 z-20 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                10~11주차 프로젝트
              </span>
              <span className="text-xs text-neutral-500 font-medium flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                펌웨어 변경 없는 서버 AI 즉시 적용
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-[#1D1D1F] flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-blue-600" />
              SODABOT AI 스킬 스튜디오
            </h1>
          </div>

          {/* 현재 장착된 AI 스킬 안내 뱃지 */}
          <div className="flex items-center gap-3">
            <div className="bg-blue-50/80 border border-blue-200/80 px-3.5 py-2 rounded-2xl flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-xs">
                <div className="text-[10px] text-neutral-500">현재 소다봇 활성 스킬</div>
                <div className="font-bold text-blue-900">
                  {skills.find(s => s.id === activeSkillId)?.name || '스킬 선택 안 됨'}
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigateToChat && onNavigateToChat()}
              className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-[#1D1D1F] text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>대화방 가기</span>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
            </button>
          </div>
        </div>

        {/* 2. 단계별 탭 네비게이터 (AI 스킬 -> 설정 -> 테스트 -> 결과 기록 -> 개선 -> 보고서) */}
        <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'select', label: '1. 스킬 선택', icon: Sparkles },
            { id: 'configure', label: '2. 스킬 설정', icon: Sliders },
            { id: 'test', label: '3. 대화 테스트', icon: Play },
            { id: 'logs', label: '4. 결과 기록', icon: BookOpen },
            { id: 'improve', label: '5. 개선 비교', icon: GitCompare },
            { id: 'report', label: '6. 프로젝트 보고서', icon: FileText }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = currentStep === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentStep(tab.id as StepType)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-neutral-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 알림 토스트 */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1D1D1F] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-medium animate-fade-in border border-neutral-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* 메인 컨텐츠 영역 */}
      <div className="flex-1 p-6 max-w-6xl w-full mx-auto space-y-6">

        {/* ========================================================
            STEP 1. AI 스킬 템플릿 선택 화면
            ======================================================== */}
        {currentStep === 'select' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-[#EAE6DF] shadow-xs">
              <div className="max-w-2xl">
                <h2 className="text-lg font-bold text-[#1D1D1F] mb-1">
                  10~11주차: 소다봇에 부여할 AI 스킬을 선택하세요
                </h2>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  소다봇의 하드웨어 펌웨어를 수정하지 않고, 서버의 AI 규칙과 설정을 바꾸어 원하는 전문 역할을 즉시 장착할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {skills.map(skill => {
                const isSelected = selectedSkillId === skill.id;
                const isActive = activeSkillId === skill.id;

                return (
                  <div
                    key={skill.id}
                    onClick={() => {
                      setSelectedSkillId(skill.id);
                    }}
                    className={`bg-white rounded-3xl p-5 border transition-all cursor-pointer relative flex flex-col justify-between hover:shadow-md ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                        : 'border-[#EAE6DF] hover:border-neutral-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className={`p-3 rounded-2xl ${
                          isSelected ? 'bg-blue-50 text-blue-600' : 'bg-neutral-100 text-neutral-700'
                        }`}>
                          {renderSkillIcon(skill.icon, 'w-6 h-6')}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-semibold">
                            v{skill.version}
                          </span>
                          {isActive && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <Check className="w-3 h-3" /> 장착중
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-[#1D1D1F] mb-1">
                        {skill.name}
                      </h3>
                      <p className="text-xs text-neutral-500 leading-relaxed mb-4">
                        {skill.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSkillId(skill.id);
                          setCurrentStep('configure');
                        }}
                        className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Sliders className="w-3 h-3 text-neutral-500" />
                        <span>설정하기</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSkillId(skill.id);
                          handleActivateSkill(skill.id);
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                        }`}
                      >
                        <Zap className="w-3 h-3" />
                        <span>{isActive ? '장착됨' : '소다봇에 적용'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 하단 진행 안내 버튼 */}
            <div className="flex justify-end">
              <button
                onClick={() => setCurrentStep('configure')}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <span>선택한 스킬 옵션 설정하러 가기</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 2. AI 스킬 세부 설정 화면 (템플릿별 옵션 / 직접 만들기)
            ======================================================== */}
        {currentStep === 'configure' && (
          <div className="space-y-6">
            {/* 상단 스킬 요약 카드 */}
            <div className="bg-white p-6 rounded-3xl border border-[#EAE6DF] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl">
                  {renderSkillIcon(currentSkill.icon, 'w-7 h-7')}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                      VERSION {currentSkill.version}
                    </span>
                    <span className="text-xs text-neutral-400">|</span>
                    <span className="text-xs text-neutral-500 font-medium">
                      타입: {currentSkill.type.toUpperCase()}
                    </span>
                  </div>
                  <h2 className="text-lg font-extrabold text-[#1D1D1F]">
                    {currentSkill.name} 설정
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPromptPreview(!showPromptPreview)}
                  className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-neutral-500" />
                  <span>{showPromptPreview ? 'AI 지시문 숨기기' : 'AI 지시문 미리보기'}</span>
                </button>

                <button
                  onClick={() => handleActivateSkill(currentSkill.id)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>소다봇에 적용하기</span>
                </button>
              </div>
            </div>

            {/* AI 지시문 미리보기 (개발자/선생님용 토글) */}
            {showPromptPreview && (
              <div className="bg-neutral-900 text-neutral-200 p-5 rounded-3xl border border-neutral-800 font-mono text-xs space-y-2 animate-fade-in">
                <div className="flex items-center justify-between text-neutral-400 pb-2 border-b border-neutral-800">
                  <span className="flex items-center gap-1 font-bold">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    자동 컴파일된 시스템 프롬프트 (학생 입력 기반 생성)
                  </span>
                  <span className="text-[10px] bg-neutral-800 px-2 py-0.5 rounded">Server Direct</span>
                </div>
                <pre className="whitespace-pre-wrap leading-relaxed select-text">
                  {compileAiSkillPrompt(currentSkill)}
                </pre>
              </div>
            )}

            {/* 템플릿별 상세 옵션 편집 카드 */}
            <div className="bg-white p-6 rounded-3xl border border-[#EAE6DF] shadow-xs space-y-6">
              
              {/* 1) 영어친구 옵션 */}
              {currentSkill.type === 'english' && (
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2 border-b border-neutral-100 pb-3">
                    <Languages className="w-4 h-4 text-blue-600" />
                    영어친구 학습 옵션 설정
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 난이도 */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-700">대화 난이도</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['beginner', 'intermediate', 'advanced'] as const).map(lvl => (
                          <button
                            key={lvl}
                            onClick={() =>
                              updateCurrentSkill(s => ({
                                ...s,
                                englishOptions: {
                                  ...s.englishOptions!,
                                  level: lvl
                                }
                              }))
                            }
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              currentSkill.englishOptions?.level === lvl
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                            }`}
                          >
                            {lvl === 'beginner' ? '초급 (쉬움)' : lvl === 'intermediate' ? '중급 (보통)' : '고급 (유창)'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 영어 사용 비율 슬라이더 */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-neutral-700">영어 사용 비율</span>
                        <span className="font-bold text-blue-600">{currentSkill.englishOptions?.ratio || 50}%</span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="100"
                        step="10"
                        value={currentSkill.englishOptions?.ratio || 50}
                        onChange={e =>
                          updateCurrentSkill(s => ({
                            ...s,
                            englishOptions: {
                              ...s.englishOptions!,
                              ratio: Number(e.target.value)
                            }
                          }))
                        }
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-neutral-400">
                        <span>한국어 위주 (20%)</span>
                        <span>반반 (50%)</span>
                        <span>영어만 (100%)</span>
                      </div>
                    </div>

                    {/* 토글 옵션들 */}
                    <div className="space-y-3 md:col-span-2">
                      <label className="text-xs font-bold text-neutral-700">피드백 및 대화 기능</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <label className="flex items-center gap-2 p-3 rounded-2xl bg-neutral-50 border border-neutral-200/60 cursor-pointer hover:bg-neutral-100/60 transition-colors">
                          <input
                            type="checkbox"
                            checked={currentSkill.englishOptions?.koreanHint ?? true}
                            onChange={e =>
                              updateCurrentSkill(s => ({
                                ...s,
                                englishOptions: {
                                  ...s.englishOptions!,
                                  koreanHint: e.target.checked
                                }
                              }))
                            }
                            className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                          />
                          <span className="text-xs font-medium text-neutral-700">한국어 힌트 표시</span>
                        </label>

                        <label className="flex items-center gap-2 p-3 rounded-2xl bg-neutral-50 border border-neutral-200/60 cursor-pointer hover:bg-neutral-100/60 transition-colors">
                          <input
                            type="checkbox"
                            checked={currentSkill.englishOptions?.grammarCorrection ?? true}
                            onChange={e =>
                              updateCurrentSkill(s => ({
                                ...s,
                                englishOptions: {
                                  ...s.englishOptions!,
                                  grammarCorrection: e.target.checked
                                }
                              }))
                            }
                            className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                          />
                          <span className="text-xs font-medium text-neutral-700">문장 교정 피드백</span>
                        </label>

                        <label className="flex items-center gap-2 p-3 rounded-2xl bg-neutral-50 border border-neutral-200/60 cursor-pointer hover:bg-neutral-100/60 transition-colors">
                          <input
                            type="checkbox"
                            checked={currentSkill.englishOptions?.wordQuiz ?? false}
                            onChange={e =>
                              updateCurrentSkill(s => ({
                                ...s,
                                englishOptions: {
                                  ...s.englishOptions!,
                                  wordQuiz: e.target.checked
                                }
                              }))
                            }
                            className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                          />
                          <span className="text-xs font-medium text-neutral-700">단어 퀴즈 출제</span>
                        </label>

                        <label className="flex items-center gap-2 p-3 rounded-2xl bg-neutral-50 border border-neutral-200/60 cursor-pointer hover:bg-neutral-100/60 transition-colors">
                          <input
                            type="checkbox"
                            checked={currentSkill.englishOptions?.roleplay ?? false}
                            onChange={e =>
                              updateCurrentSkill(s => ({
                                ...s,
                                englishOptions: {
                                  ...s.englishOptions!,
                                  roleplay: e.target.checked
                                }
                              }))
                            }
                            className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                          />
                          <span className="text-xs font-medium text-neutral-700">역할극 상황극 모드</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2) 코딩친구 옵션 */}
              {currentSkill.type === 'coding' && (
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2 border-b border-neutral-100 pb-3">
                    <Code2 className="w-4 h-4 text-indigo-600" />
                    코딩친구 교육 옵션 설정
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-700">설명 난이도</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['elementary', 'middle', 'advanced'] as const).map(lvl => (
                          <button
                            key={lvl}
                            onClick={() =>
                              updateCurrentSkill(s => ({
                                ...s,
                                codingOptions: {
                                  ...s.codingOptions!,
                                  level: lvl
                                }
                              }))
                            }
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              currentSkill.codingOptions?.level === lvl
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                            }`}
                          >
                            {lvl === 'elementary' ? '초등/입문' : lvl === 'middle' ? '중등/기초' : '실전 심화'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-700">코드 제공 방식</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['hint', 'step_by_step', 'direct'] as const).map(mode => (
                          <button
                            key={mode}
                            onClick={() =>
                              updateCurrentSkill(s => ({
                                ...s,
                                codingOptions: {
                                  ...s.codingOptions!,
                                  codeGenMode: mode
                                }
                              }))
                            }
                            className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              currentSkill.codingOptions?.codeGenMode === mode
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                            }`}
                          >
                            {mode === 'hint' ? '💡 힌트 위주' : mode === 'step_by_step' ? '🪜 단계별' : '💻 직접 코드'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 md:col-span-2">
                      <label className="text-xs font-bold text-neutral-700">보조 기능 설정</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <label className="flex items-center gap-2 p-3 rounded-2xl bg-neutral-50 border border-neutral-200/60 cursor-pointer hover:bg-neutral-100/60 transition-colors">
                          <input
                            type="checkbox"
                            checked={currentSkill.codingOptions?.explainError ?? true}
                            onChange={e =>
                              updateCurrentSkill(s => ({
                                ...s,
                                codingOptions: {
                                  ...s.codingOptions!,
                                  explainError: e.target.checked
                                }
                              }))
                            }
                            className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                          />
                          <span className="text-xs font-medium text-neutral-700">에러 원인 친절 설명</span>
                        </label>

                        <label className="flex items-center gap-2 p-3 rounded-2xl bg-neutral-50 border border-neutral-200/60 cursor-pointer hover:bg-neutral-100/60 transition-colors">
                          <input
                            type="checkbox"
                            checked={currentSkill.codingOptions?.suggestFix ?? true}
                            onChange={e =>
                              updateCurrentSkill(s => ({
                                ...s,
                                codingOptions: {
                                  ...s.codingOptions!,
                                  suggestFix: e.target.checked
                                }
                              }))
                            }
                            className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                          />
                          <span className="text-xs font-medium text-neutral-700">코드 수정 제안</span>
                        </label>

                        <label className="flex items-center gap-2 p-3 rounded-2xl bg-neutral-50 border border-neutral-200/60 cursor-pointer hover:bg-neutral-100/60 transition-colors">
                          <input
                            type="checkbox"
                            checked={currentSkill.codingOptions?.addComments ?? true}
                            onChange={e =>
                              updateCurrentSkill(s => ({
                                ...s,
                                codingOptions: {
                                  ...s.codingOptions!,
                                  addComments: e.target.checked
                                }
                              }))
                            }
                            className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                          />
                          <span className="text-xs font-medium text-neutral-700">한글 설명 주석 추가</span>
                        </label>

                        <label className="flex items-center gap-2 p-3 rounded-2xl bg-indigo-50/60 border border-indigo-200/60 cursor-pointer hover:bg-indigo-100/60 transition-colors">
                          <input
                            type="checkbox"
                            checked={currentSkill.codingOptions?.useHardwareInfo ?? true}
                            onChange={e =>
                              updateCurrentSkill(s => ({
                                ...s,
                                codingOptions: {
                                  ...s.codingOptions!,
                                  useHardwareInfo: e.target.checked
                                }
                              }))
                            }
                            className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                          />
                          <span className="text-xs font-bold text-indigo-900">소다봇 핀맵 연동</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3) 공부도우미 옵션 */}
              {currentSkill.type === 'study' && (
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2 border-b border-neutral-100 pb-3">
                    <GraduationCap className="w-4 h-4 text-emerald-600" />
                    공부도우미 학습 방법 설정
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-700">주요 학습 과목</label>
                      <select
                        value={currentSkill.studyOptions?.subject || 'science'}
                        onChange={e =>
                          updateCurrentSkill(s => ({
                            ...s,
                            studyOptions: {
                              ...s.studyOptions!,
                              subject: e.target.value as any
                            }
                          }))
                        }
                        className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium"
                      >
                        <option value="science">과학 (우주, 물리, 생물 등)</option>
                        <option value="math">수학 (개념 및 논리적 풀이)</option>
                        <option value="social">사회/역사 (일상 상식)</option>
                        <option value="korean">국어 (어휘, 글쓰기)</option>
                        <option value="general">전과목 및 자유 질문</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-700">설명 방식</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['socratic', 'analogy', 'summary'] as const).map(m => (
                          <button
                            key={m}
                            onClick={() =>
                              updateCurrentSkill(s => ({
                                ...s,
                                studyOptions: {
                                  ...s.studyOptions!,
                                  method: m
                                }
                              }))
                            }
                            className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              currentSkill.studyOptions?.method === m
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                            }`}
                          >
                            {m === 'socratic' ? '질문 유도' : m === 'analogy' ? '쉬운 비유' : '핵심 요약'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 md:col-span-2">
                      <label className="text-xs font-bold text-neutral-700">동기부여 및 정리</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="flex items-center gap-2 p-3 rounded-2xl bg-neutral-50 border border-neutral-200/60 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentSkill.studyOptions?.quizMode ?? true}
                            onChange={e =>
                              updateCurrentSkill(s => ({
                                ...s,
                                studyOptions: {
                                  ...s.studyOptions!,
                                  quizMode: e.target.checked
                                }
                              }))
                            }
                            className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                          />
                          <span className="text-xs font-medium text-neutral-700">확인 퀴즈 출제</span>
                        </label>

                        <label className="flex items-center gap-2 p-3 rounded-2xl bg-neutral-50 border border-neutral-200/60 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentSkill.studyOptions?.provideSummaryNotes ?? true}
                            onChange={e =>
                              updateCurrentSkill(s => ({
                                ...s,
                                studyOptions: {
                                  ...s.studyOptions!,
                                  provideSummaryNotes: e.target.checked
                                }
                              }))
                            }
                            className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                          />
                          <span className="text-xs font-medium text-neutral-700">3줄 핵심 요약 제공</span>
                        </label>

                        <label className="flex items-center gap-2 p-3 rounded-2xl bg-neutral-50 border border-neutral-200/60 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentSkill.studyOptions?.cheerLevel === 'high'}
                            onChange={e =>
                              updateCurrentSkill(s => ({
                                ...s,
                                studyOptions: {
                                  ...s.studyOptions!,
                                  cheerLevel: e.target.checked ? 'high' : 'normal'
                                }
                              }))
                            }
                            className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                          />
                          <span className="text-xs font-medium text-neutral-700">칭찬과 응원 듬뿍</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4) 생활친구 옵션 */}
              {currentSkill.type === 'daily' && (
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2 border-b border-neutral-100 pb-3">
                    <HeartHandshake className="w-4 h-4 text-rose-500" />
                    생활친구 감성 & 안전 옵션 설정
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <label className="flex items-center gap-2 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/60 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentSkill.dailyOptions?.checkGreeting ?? true}
                        onChange={e =>
                          updateCurrentSkill(s => ({
                            ...s,
                            dailyOptions: {
                              ...s.dailyOptions!,
                              checkGreeting: e.target.checked
                            }
                          }))
                        }
                        className="w-4 h-4 text-rose-500 rounded cursor-pointer"
                      />
                      <span className="text-xs font-medium text-neutral-700">다정한 안부 대화</span>
                    </label>

                    <label className="flex items-center gap-2 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/60 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentSkill.dailyOptions?.checkSchedule ?? true}
                        onChange={e =>
                          updateCurrentSkill(s => ({
                            ...s,
                            dailyOptions: {
                              ...s.dailyOptions!,
                              checkSchedule: e.target.checked
                            }
                          }))
                        }
                        className="w-4 h-4 text-rose-500 rounded cursor-pointer"
                      />
                      <span className="text-xs font-medium text-neutral-700">오늘 할 일/일정 챙김</span>
                    </label>

                    <label className="flex items-center gap-2 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/60 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentSkill.dailyOptions?.memoryAssist ?? true}
                        onChange={e =>
                          updateCurrentSkill(s => ({
                            ...s,
                            dailyOptions: {
                              ...s.dailyOptions!,
                              memoryAssist: e.target.checked
                            }
                          }))
                        }
                        className="w-4 h-4 text-rose-500 rounded cursor-pointer"
                      />
                      <span className="text-xs font-medium text-neutral-700">친구 기억/취미 언급</span>
                    </label>

                    <label className="flex items-center gap-2 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/60 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentSkill.dailyOptions?.shortReply ?? true}
                        onChange={e =>
                          updateCurrentSkill(s => ({
                            ...s,
                            dailyOptions: {
                              ...s.dailyOptions!,
                              shortReply: e.target.checked
                            }
                          }))
                        }
                        className="w-4 h-4 text-rose-500 rounded cursor-pointer"
                      />
                      <span className="text-xs font-medium text-neutral-700">짧고 귀여운 답변</span>
                    </label>

                    <label className="flex items-center gap-2 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/60 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentSkill.dailyOptions?.easyExpression ?? true}
                        onChange={e =>
                          updateCurrentSkill(s => ({
                            ...s,
                            dailyOptions: {
                              ...s.dailyOptions!,
                              easyExpression: e.target.checked
                            }
                          }))
                        }
                        className="w-4 h-4 text-rose-500 rounded cursor-pointer"
                      />
                      <span className="text-xs font-medium text-neutral-700">쉬운 우리말과 이모지</span>
                    </label>

                    {/* 안전 규칙 배너 */}
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2 sm:col-span-2 md:col-span-3">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed">
                        <span className="font-bold">안전 규칙 기본 탑재:</span> 의학 판단, 위험한 행동 유도, 유해 발언을 차단하고 부모님/전문가 상담을 권유하는 안전 가이드라인이 상시 작동합니다.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 5) 발표연습 옵션 */}
              {currentSkill.type === 'presentation' && (
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2 border-b border-neutral-100 pb-3">
                    <Mic className="w-4 h-4 text-purple-600" />
                    발표연습 코칭 옵션 설정
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-700">발표 주제</label>
                      <input
                        type="text"
                        value={currentSkill.presentationOptions?.topic || ''}
                        onChange={e =>
                          updateCurrentSkill(s => ({
                            ...s,
                            presentationOptions: {
                              ...s.presentationOptions!,
                              topic: e.target.value
                            }
                          }))
                        }
                        placeholder="예: 내가 만든 소다봇 프로젝트 소개"
                        className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-700">예상 청중 (듣는 사람)</label>
                      <input
                        type="text"
                        value={currentSkill.presentationOptions?.targetAudience || ''}
                        onChange={e =>
                          updateCurrentSkill(s => ({
                            ...s,
                            presentationOptions: {
                              ...s.presentationOptions!,
                              targetAudience: e.target.value
                            }
                          }))
                        }
                        placeholder="예: 반 친구들과 선생님"
                        className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs"
                      />
                    </div>

                    <div className="space-y-3 md:col-span-2">
                      <label className="text-xs font-bold text-neutral-700">코칭 기능</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 p-3 rounded-2xl bg-neutral-50 border border-neutral-200/60 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentSkill.presentationOptions?.mockQa ?? true}
                            onChange={e =>
                              updateCurrentSkill(s => ({
                                ...s,
                                presentationOptions: {
                                  ...s.presentationOptions!,
                                  mockQa: e.target.checked
                                }
                              }))
                            }
                            className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                          />
                          <span className="text-xs font-medium text-neutral-700">청중 예상 질문(Q&A) 연습</span>
                        </label>

                        <label className="flex items-center gap-2 p-3 rounded-2xl bg-neutral-50 border border-neutral-200/60 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentSkill.presentationOptions?.timeManagementTips ?? true}
                            onChange={e =>
                              updateCurrentSkill(s => ({
                                ...s,
                                presentationOptions: {
                                  ...s.presentationOptions!,
                                  timeManagementTips: e.target.checked
                                }
                              }))
                            }
                            className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                          />
                          <span className="text-xs font-medium text-neutral-700">스피치 톤 & 시간 조절 팁</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 6) 직접 만들기 (간편 입력 폼) */}
              {currentSkill.type === 'custom' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                    <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      학생 맞춤형 AI 스킬 간편 만들기
                    </h3>
                    <span className="text-[10px] text-neutral-500 font-medium bg-neutral-100 px-2 py-0.5 rounded-full">
                      프롬프트 작성 필요 없음
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700 flex items-center gap-1">
                        <span>1. 스킬 이름</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={currentSkill.customInputs?.skillName || ''}
                        onChange={e =>
                          updateCurrentSkill(s => ({
                            ...s,
                            name: e.target.value || '나만의 AI 스킬',
                            customInputs: {
                              ...s.customInputs!,
                              skillName: e.target.value
                            }
                          }))
                        }
                        placeholder="예: 퀴즈대장 소다, 게임 친구"
                        className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700">2. 누구를 위한 것인가요? (대상)</label>
                      <input
                        type="text"
                        value={currentSkill.customInputs?.forWhom || ''}
                        onChange={e =>
                          updateCurrentSkill(s => ({
                            ...s,
                            customInputs: {
                              ...s.customInputs!,
                              forWhom: e.target.value
                            }
                          }))
                        }
                        placeholder="예: 초등학교 저학년 친구들, 우리 가족"
                        className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-bold text-neutral-700">3. 어떤 문제를 도와주나요? (해결 목적)</label>
                      <input
                        type="text"
                        value={currentSkill.customInputs?.targetProblem || ''}
                        onChange={e =>
                          updateCurrentSkill(s => ({
                            ...s,
                            customInputs: {
                              ...s.customInputs!,
                              targetProblem: e.target.value
                            }
                          }))
                        }
                        placeholder="예: 지루할 때 재미있는 끝말잇기와 넌센스 퀴즈로 즐겁게 놀아줍니다."
                        className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>4. 반드시 해야 하는 행동 (DO)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={currentSkill.customInputs?.mustDo || ''}
                        onChange={e =>
                          updateCurrentSkill(s => ({
                            ...s,
                            customInputs: {
                              ...s.customInputs!,
                              mustDo: e.target.value
                            }
                          }))
                        }
                        placeholder="예: 항상 밝은 이모지와 유쾌한 칭찬으로 답변하기"
                        className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs resize-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-rose-700 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>5. 하지 말아야 하는 행동 (DON'T)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={currentSkill.customInputs?.mustNotDo || ''}
                        onChange={e =>
                          updateCurrentSkill(s => ({
                            ...s,
                            customInputs: {
                              ...s.customInputs!,
                              mustNotDo: e.target.value
                            }
                          }))
                        }
                        placeholder="예: 너무 길거나 어려운 어휘 쓰지 않기"
                        className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs resize-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700">6. 사용할 기억 연동</label>
                      <input
                        type="text"
                        value={currentSkill.customInputs?.memoriesToUse || ''}
                        onChange={e =>
                          updateCurrentSkill(s => ({
                            ...s,
                            customInputs: {
                              ...s.customInputs!,
                              memoriesToUse: e.target.value
                            }
                          }))
                        }
                        placeholder="예: 친구의 취미와 좋아하는 음식을 기억하여 대화하기"
                        className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700">7. 답변 방식</label>
                      <input
                        type="text"
                        value={currentSkill.customInputs?.responseStyle || ''}
                        onChange={e =>
                          updateCurrentSkill(s => ({
                            ...s,
                            customInputs: {
                              ...s.customInputs!,
                              responseStyle: e.target.value
                            }
                          }))
                        }
                        placeholder="예: 친근한 반말 구어체, 2문장 이내"
                        className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 하단 버튼 바 */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentStep('select')}
                className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-2xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>스킬 다시 선택</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleActivateSkill(currentSkill.id);
                    setCurrentStep('test');
                  }}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  <span>설정 완료하고 테스트하기</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 3. 대화 테스트 화면 (웹 + 실물 소다봇 동일 적용)
            ======================================================== */}
        {currentStep === 'test' && (
          <div className="space-y-6">
            {/* 상단 테스트 환경 안내 */}
            <div className="bg-white p-4 rounded-3xl border border-[#EAE6DF] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Play className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#1D1D1F]">
                      {currentSkill.name} (V{currentSkill.version}) 실시간 테스트
                    </span>
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                      친구설정+기억 융합 적용
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    아래 채팅창에서 질문을 던져보고 소다봇의 반응을 실시간으로 확인하세요.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setTestMessages([
                      {
                        id: 'init-msg',
                        sender: 'assistant',
                        text: `안녕! '${currentSkill.name}' 스킬로 새롭게 테스트를 시작해보자! ✨`,
                        timestamp: new Date().toISOString()
                      }
                    ]);
                  }}
                  className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-xs font-medium rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>대화 초기화</span>
                </button>

                <button
                  onClick={() => setCurrentStep('configure')}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Sliders className="w-3 h-3" />
                  <span>옵션 재수정</span>
                </button>
              </div>
            </div>

            {/* 대화 박스 & 입력창 */}
            <div className="bg-white rounded-3xl border border-[#EAE6DF] shadow-sm overflow-hidden flex flex-col h-[480px]">
              {/* 메시지 리스트 */}
              <div
                ref={chatScrollRef}
                className="flex-1 p-5 overflow-y-auto space-y-4 bg-neutral-50/50"
              >
                {testMessages.map(msg => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          {renderSkillIcon(currentSkill.icon, 'w-4 h-4')}
                        </div>
                      )}

                      <div className="max-w-[75%] space-y-1">
                        <div
                          className={`p-4 rounded-2xl text-xs leading-relaxed ${
                            isUser
                              ? 'bg-blue-600 text-white rounded-tr-none'
                              : 'bg-white text-[#1D1D1F] border border-[#EAE6DF] shadow-2xs rounded-tl-none'
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{msg.text}</div>
                        </div>

                        {/* 봇 답변인 경우 원클릭 결과 기록 버튼 제공 */}
                        {!isUser && msg.id !== 'init-msg' && (
                          <div className="flex justify-end pt-0.5">
                            <button
                              onClick={() => {
                                // 직전 유저 질문 찾기
                                const idx = testMessages.findIndex(m => m.id === msg.id);
                                const prevUserMsg = testMessages[idx - 1]?.text || '';
                                setLogForm({
                                  situation: `${currentSkill.name} V${currentSkill.version} 대화 테스트`,
                                  userQuestion: prevUserMsg,
                                  aiResponse: msg.text,
                                  goodPoints: '',
                                  badPoints: '',
                                  modifications: ''
                                });
                                setShowLogModal(true);
                              }}
                              className="text-[10px] text-blue-600 hover:text-blue-800 font-bold bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <BookOpen className="w-3 h-3" />
                              <span>이 답변을 프로젝트 기록에 저장</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isGenerating && (
                  <div className="flex gap-3 items-center text-xs text-neutral-400 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 animate-spin" />
                    </div>
                    <span>소다봇이 스킬 규칙에 맞춰 답변을 생각하고 있어요...</span>
                  </div>
                )}
              </div>

              {/* 입력창 */}
              <div className="p-3 bg-white border-t border-[#EAE6DF] flex items-center gap-2">
                <input
                  type="text"
                  value={inputQuery}
                  onChange={e => setInputQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendTestMessage();
                    }
                  }}
                  placeholder={`소다봇 (${currentSkill.name})에게 말을 걸어보세요...`}
                  className="flex-1 px-4 py-2.5 bg-neutral-100 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl text-xs transition-all outline-none"
                />
                <button
                  onClick={handleSendTestMessage}
                  disabled={!inputQuery.trim() || isGenerating}
                  className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-2xl transition-all cursor-pointer shadow-xs"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 하단 스텝 전환 바 */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentStep('configure')}
                className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-2xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>설정으로 돌아가기</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentStep('logs')}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>활용 기록 보러가기 ({testLogs.length}건)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 4. 활용 기록 화면 (학생 입력 최소화 & 자동 저장)
            ======================================================== */}
        {currentStep === 'logs' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-[#EAE6DF] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#1D1D1F] flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  프로젝트 활용 및 테스트 기록 ({testLogs.length}개)
                </h2>
                <p className="text-xs text-neutral-500 mt-1">
                  소다봇과 나눈 테스트 대화에서 잘된 점과 아쉬운 점을 기록하여 보고서와 개선에 활용합니다.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setLogForm({
                      situation: '',
                      userQuestion: '',
                      aiResponse: '',
                      goodPoints: '',
                      badPoints: '',
                      modifications: ''
                    });
                    setShowLogModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>직접 기록 추가</span>
                </button>
              </div>
            </div>

            {testLogs.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-[#EAE6DF] text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-neutral-800">아직 저장된 테스트 기록이 없습니다</h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  [3. 대화 테스트] 화면에서 소다봇에게 질문한 뒤 '기록에 저장' 버튼을 누르면 자동으로 등록됩니다.
                </p>
                <button
                  onClick={() => setCurrentStep('test')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer mt-2"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>테스트하러 가기</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {testLogs.map(log => (
                  <div
                    key={log.id}
                    className="bg-white p-5 rounded-3xl border border-[#EAE6DF] shadow-2xs space-y-4 hover:border-neutral-300 transition-all"
                  >
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {log.skillName} (V{log.version})
                        </span>
                        <span className="text-xs font-bold text-[#1D1D1F]">
                          {log.situation || '대화 테스트'}
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {new Date(log.timestamp).toLocaleString('ko-KR')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1.5 bg-neutral-50 p-3.5 rounded-2xl">
                        <div className="text-[10px] font-bold text-neutral-500">🙋 내 질문</div>
                        <div className="font-medium text-neutral-800">{log.userQuestion}</div>
                      </div>

                      <div className="space-y-1.5 bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100/60">
                        <div className="text-[10px] font-bold text-blue-700">🤖 AI 소다봇 답변</div>
                        <div className="font-medium text-neutral-800 whitespace-pre-wrap">{log.aiResponse}</div>
                      </div>
                    </div>

                    {(log.goodPoints || log.badPoints || log.modifications) && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                        {log.goodPoints && (
                          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/60">
                            <div className="font-bold text-emerald-800 text-[11px] mb-0.5 flex items-center gap-1">
                              <ThumbsUp className="w-3 h-3" /> 잘된 점
                            </div>
                            <div className="text-neutral-700">{log.goodPoints}</div>
                          </div>
                        )}
                        {log.badPoints && (
                          <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200/60">
                            <div className="font-bold text-rose-800 text-[11px] mb-0.5 flex items-center gap-1">
                              <ThumbsDown className="w-3 h-3" /> 아쉬운 점
                            </div>
                            <div className="text-neutral-700">{log.badPoints}</div>
                          </div>
                        )}
                        {log.modifications && (
                          <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60">
                            <div className="font-bold text-amber-800 text-[11px] mb-0.5 flex items-center gap-1">
                              <Sliders className="w-3 h-3" /> 수정한 내용
                            </div>
                            <div className="text-neutral-700">{log.modifications}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 하단 네비게이션 */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentStep('test')}
                className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-2xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>테스트로 돌아가기</span>
              </button>

              <button
                onClick={() => setCurrentStep('improve')}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <span>버전 개선 및 비교하러 가기 (V1 vs V2)</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 5. 개선 및 비교 화면 (VERSION 1 vs VERSION 2)
            ======================================================== */}
        {currentStep === 'improve' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-[#EAE6DF] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#1D1D1F] flex items-center gap-2">
                  <GitCompare className="w-5 h-5 text-blue-600" />
                  스킬 개선 및 버전 비교 (VERSION 1 vs VERSION 2)
                </h2>
                <p className="text-xs text-neutral-500 mt-1">
                  설정을 수정하고 같은 상황을 다시 테스트하여, 개선 전과 후의 AI 답변 변화를 비교합니다.
                </p>
              </div>

              <button
                onClick={handleCreateNewVersion}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>새 버전(V{currentSkill.version + 1})으로 개선하기</span>
              </button>
            </div>

            {/* 나란히 비교 (Side-by-Side Comparison) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* VERSION 1 (개선 전) */}
              <div className="bg-white p-5 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-neutral-100 text-neutral-700">
                    VERSION 1 (초기 설정)
                  </span>
                  <span className="text-[10px] text-neutral-400">기준 버전</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-neutral-50 rounded-2xl">
                    <div className="font-bold text-neutral-500 text-[10px] mb-1">초기 문제점 / 아쉬웠던 점</div>
                    <p className="text-neutral-700 leading-relaxed">
                      {report.painPoints || '초기 설정에서는 답변이 다소 길거나 구체적인 힌트가 부족했습니다.'}
                    </p>
                  </div>

                  <div className="p-3 bg-neutral-50 rounded-2xl">
                    <div className="font-bold text-neutral-500 text-[10px] mb-1">V1 AI 답변 예시</div>
                    <p className="text-neutral-700 leading-relaxed font-mono">
                      {testLogs.filter(l => l.version === 1)[0]?.aiResponse || 'V1 테스트 답변 기록이 표시됩니다.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* VERSION 2 (개선 후) */}
              <div className="bg-white p-5 rounded-3xl border border-blue-300 shadow-sm space-y-4 ring-1 ring-blue-500/20">
                <div className="flex items-center justify-between border-b border-blue-50 pb-3">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-600 text-white">
                    VERSION {currentSkill.version > 1 ? currentSkill.version : 2} (개선된 설정)
                  </span>
                  <span className="text-[10px] text-blue-600 font-bold">현재 적용중</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100">
                    <div className="font-bold text-blue-700 text-[10px] mb-1">수정한 규칙 및 개선점</div>
                    <p className="text-neutral-800 leading-relaxed">
                      {report.modifications || '스킬 세부 옵션을 조율하여 힌트 제공 규칙과 간결한 어조를 적용했습니다.'}
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100">
                    <div className="font-bold text-blue-700 text-[10px] mb-1">V2 개선된 AI 답변 예시</div>
                    <p className="text-neutral-800 leading-relaxed font-mono">
                      {testLogs.filter(l => l.version >= 2)[0]?.aiResponse || 'V2 개선 답변 기록이 표시됩니다.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 하단 네비게이션 */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentStep('logs')}
                className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-2xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>기록으로 돌아가기</span>
              </button>

              <button
                onClick={() => setCurrentStep('report')}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>최종 프로젝트 보고서 확인하기</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 6. 10~11주차 최종 프로젝트 보고서 화면
            ======================================================== */}
        {currentStep === 'report' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-[#EAE6DF] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="px-2.5 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                  10~11주차 프로젝트 산출물
                </span>
                <h2 className="text-lg font-bold text-[#1D1D1F] mt-1 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  SODABOT AI 스킬 프로젝트 최종 보고서
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAutoGenerateReport}
                  className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-neutral-500" />
                  <span>기록 기반 자동 채우기</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>보고서 인쇄 / PDF</span>
                </button>
              </div>
            </div>

            {/* 보고서 10대 항목 문서 카드 */}
            <div className="bg-white p-8 rounded-3xl border border-[#EAE6DF] shadow-sm space-y-6 select-text print:p-0 print:border-none">
              <div className="border-b border-neutral-200 pb-4">
                <h1 className="text-xl font-extrabold text-[#1D1D1F] mb-1">
                  {report.title}
                </h1>
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span>작성자: {currentUser?.displayName || '소다봇 개발자'}</span>
                  <span>|</span>
                  <span>작성일: {new Date(report.createdAt).toLocaleDateString('ko-KR')}</span>
                </div>
              </div>

              {/* 10대 항목 목록 */}
              <div className="grid grid-cols-1 gap-5 text-xs">
                {/* 1. 내 소다봇 소개 */}
                <div className="space-y-1.5 p-4 rounded-2xl bg-neutral-50 border border-neutral-200/60">
                  <label className="font-bold text-neutral-800 text-xs flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[10px]">1</span>
                    내 소다봇 소개
                  </label>
                  <textarea
                    rows={2}
                    value={report.sodabotIntro}
                    onChange={e => setReport(prev => ({ ...prev, sodabotIntro: e.target.value }))}
                    className="w-full bg-white p-2.5 rounded-xl border border-neutral-200 text-xs resize-none"
                  />
                </div>

                {/* 2. 해결하고 싶은 문제 */}
                <div className="space-y-1.5 p-4 rounded-2xl bg-neutral-50 border border-neutral-200/60">
                  <label className="font-bold text-neutral-800 text-xs flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[10px]">2</span>
                    해결하고 싶은 문제
                  </label>
                  <textarea
                    rows={2}
                    value={report.targetProblem}
                    onChange={e => setReport(prev => ({ ...prev, targetProblem: e.target.value }))}
                    className="w-full bg-white p-2.5 rounded-xl border border-neutral-200 text-xs resize-none"
                  />
                </div>

                {/* 3. 선택한 AI 스킬 */}
                <div className="space-y-1.5 p-4 rounded-2xl bg-neutral-50 border border-neutral-200/60">
                  <label className="font-bold text-neutral-800 text-xs flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[10px]">3</span>
                    선택한 AI 스킬
                  </label>
                  <input
                    type="text"
                    value={report.selectedSkill}
                    onChange={e => setReport(prev => ({ ...prev, selectedSkill: e.target.value }))}
                    className="w-full bg-white p-2.5 rounded-xl border border-neutral-200 text-xs"
                  />
                </div>

                {/* 4. 사용 시나리오 */}
                <div className="space-y-1.5 p-4 rounded-2xl bg-neutral-50 border border-neutral-200/60">
                  <label className="font-bold text-neutral-800 text-xs flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[10px]">4</span>
                    사용 시나리오
                  </label>
                  <textarea
                    rows={2}
                    value={report.usageScenario}
                    onChange={e => setReport(prev => ({ ...prev, usageScenario: e.target.value }))}
                    className="w-full bg-white p-2.5 rounded-xl border border-neutral-200 text-xs resize-none"
                  />
                </div>

                {/* 5. 실제 사용 기록 */}
                <div className="space-y-1.5 p-4 rounded-2xl bg-neutral-50 border border-neutral-200/60">
                  <label className="font-bold text-neutral-800 text-xs flex items-center gap-1.5 mb-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[10px]">5</span>
                    실제 사용 및 대화 기록
                  </label>
                  <div className="space-y-2">
                    {(report.actualLogs || []).map((log, idx) => (
                      <div key={idx} className="p-3 bg-white rounded-xl border border-neutral-200 text-xs space-y-1">
                        <div className="font-bold text-blue-700">Q: {log.userQuestion}</div>
                        <div className="text-neutral-700">A: {log.aiResponse}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 6. 잘된 점 & 7. 문제점 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/60">
                    <label className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center text-[10px]">6</span>
                      잘된 점
                    </label>
                    <textarea
                      rows={3}
                      value={report.goodPoints}
                      onChange={e => setReport(prev => ({ ...prev, goodPoints: e.target.value }))}
                      className="w-full bg-white p-2.5 rounded-xl border border-emerald-200 text-xs resize-none"
                    />
                  </div>

                  <div className="space-y-1.5 p-4 rounded-2xl bg-rose-50/50 border border-rose-200/60">
                    <label className="font-bold text-rose-900 text-xs flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-rose-600 text-white inline-flex items-center justify-center text-[10px]">7</span>
                      문제점 / 아쉬웠던 점
                    </label>
                    <textarea
                      rows={3}
                      value={report.painPoints}
                      onChange={e => setReport(prev => ({ ...prev, painPoints: e.target.value }))}
                      className="w-full bg-white p-2.5 rounded-xl border border-rose-200 text-xs resize-none"
                    />
                  </div>
                </div>

                {/* 8. 수정한 내용 */}
                <div className="space-y-1.5 p-4 rounded-2xl bg-neutral-50 border border-neutral-200/60">
                  <label className="font-bold text-neutral-800 text-xs flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[10px]">8</span>
                    수정한 내용 (프롬프트/옵션 변경점)
                  </label>
                  <textarea
                    rows={2}
                    value={report.modifications}
                    onChange={e => setReport(prev => ({ ...prev, modifications: e.target.value }))}
                    className="w-full bg-white p-2.5 rounded-xl border border-neutral-200 text-xs resize-none"
                  />
                </div>

                {/* 9. 개선 전 / 개선 후 */}
                <div className="space-y-1.5 p-4 rounded-2xl bg-neutral-50 border border-neutral-200/60">
                  <label className="font-bold text-neutral-800 text-xs flex items-center gap-1.5 mb-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[10px]">9</span>
                    개선 전 (V1) vs 개선 후 (V2) 비교
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-white rounded-xl border border-neutral-200 space-y-1">
                      <div className="font-bold text-neutral-500">개선 전 (V1)</div>
                      <div className="text-neutral-700 text-[11px]">{report.comparisonV1V2?.v1Response}</div>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-blue-200 space-y-1">
                      <div className="font-bold text-blue-700">개선 후 (V2)</div>
                      <div className="text-neutral-700 text-[11px]">{report.comparisonV1V2?.v2Response}</div>
                    </div>
                  </div>
                </div>

                {/* 10. 앞으로 추가하고 싶은 기능 */}
                <div className="space-y-1.5 p-4 rounded-2xl bg-neutral-50 border border-neutral-200/60">
                  <label className="font-bold text-neutral-800 text-xs flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[10px]">10</span>
                    앞으로 추가하고 싶은 기능 및 소감
                  </label>
                  <textarea
                    rows={2}
                    value={report.futureFeatures}
                    onChange={e => setReport(prev => ({ ...prev, futureFeatures: e.target.value }))}
                    className="w-full bg-white p-2.5 rounded-xl border border-neutral-200 text-xs resize-none"
                  />
                </div>
              </div>
            </div>

            {/* 하단 저장 안내 바 */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentStep('improve')}
                className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-2xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>개선 비교로 돌아가기</span>
              </button>

              <button
                onClick={() => {
                  triggerToast('💾 10~11주차 프로젝트 보고서가 안전하게 저장되었습니다!');
                }}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>보고서 최종 저장</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* 기록 추가 모달 */}
      {showLogModal && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-[#EAE6DF] animate-scale-up">
            <h3 className="text-base font-bold text-[#1D1D1F] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              프로젝트 활용 기록 작성
            </h3>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-neutral-700">사용 상황 (시나리오)</label>
                <input
                  type="text"
                  value={logForm.situation}
                  onChange={e => setLogForm({ ...logForm, situation: e.target.value })}
                  placeholder="예: 영어 회화 첫인사 테스트"
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700">질문 (사용자)</label>
                <input
                  type="text"
                  value={logForm.userQuestion}
                  onChange={e => setLogForm({ ...logForm, userQuestion: e.target.value })}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-700">AI 답변</label>
                <textarea
                  rows={3}
                  value={logForm.aiResponse}
                  onChange={e => setLogForm({ ...logForm, aiResponse: e.target.value })}
                  className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-emerald-700">잘된 점</label>
                  <input
                    type="text"
                    value={logForm.goodPoints}
                    onChange={e => setLogForm({ ...logForm, goodPoints: e.target.value })}
                    placeholder="예: 친절하게 문장을 고쳐줌"
                    className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-rose-700">아쉬운 점</label>
                  <input
                    type="text"
                    value={logForm.badPoints}
                    onChange={e => setLogForm({ ...logForm, badPoints: e.target.value })}
                    placeholder="예: 답변이 조금 길었음"
                    className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowLogModal(false)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleSaveLog}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
