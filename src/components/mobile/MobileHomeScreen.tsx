import React from 'react';
import {
  Bot,
  MessageSquare,
  Users,
  MessageCircle,
  Settings,
  ChevronRight,
  Wifi,
  WifiOff,
  Sparkles,
  ArrowRight,
  RefreshCw,
  LogOut
} from 'lucide-react';
import { MobileTab } from './MobileBottomTabBar';

interface MobileHomeScreenProps {
  currentUser: {
    id: string;
    username: string;
    displayName: string;
    role?: string;
  } | null;
  isSodabotConnected: boolean;
  robotName?: string;
  sodabotIp?: string | null;
  onNavigateTab: (tab: MobileTab, extra?: { subTab?: string }) => void;
  onLogout?: () => void;
  onQuickReconnect?: () => void;
  isVerifying?: boolean;
}

export const MobileHomeScreen: React.FC<MobileHomeScreenProps> = ({
  currentUser,
  isSodabotConnected,
  robotName = 'SODABOT',
  sodabotIp,
  onNavigateTab,
  onLogout,
  onQuickReconnect,
  isVerifying = false
}) => {
  const displayName = currentUser?.displayName || '소다봇 친구';

  const menuCards = [
    {
      id: 'control',
      tab: 'control' as MobileTab,
      title: '1. 소다봇 제어',
      description: '표정 바꾸기 · 텍스트 말하기 · 기본 동작',
      icon: Bot,
      color: 'bg-blue-50 text-blue-600 border-blue-200/80',
      badge: '원격 제어'
    },
    {
      id: 'chat',
      tab: 'chat' as MobileTab,
      title: '2. 소다와 대화하기',
      description: 'AI 소다봇과 자유로운 음성 & 텍스트 대화',
      icon: MessageSquare,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-200/80',
      badge: 'AI 코딩 챗'
    },
    {
      id: 'friends',
      tab: 'friends' as MobileTab,
      title: '3. 친구',
      description: '친구 목록 확인 · 1:1 메시지 · 소다봇 듣기',
      icon: Users,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200/80',
      badge: '친구 목록'
    },
    {
      id: 'groups',
      tab: 'friends' as MobileTab,
      extra: { subTab: 'groups' },
      title: '4. 그룹 대화',
      description: '반 친구들과 다자간 그룹 채팅방 참여',
      icon: MessageCircle,
      color: 'bg-purple-50 text-purple-600 border-purple-200/80',
      badge: '그룹방'
    },
    {
      id: 'settings',
      tab: 'settings' as MobileTab,
      title: '5. 친구설정',
      description: 'AI 친구 이름 · 말투 · 프로필 · 기억 3가지',
      icon: Settings,
      color: 'bg-amber-50 text-amber-600 border-amber-200/80',
      badge: '페르소나'
    }
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-y-auto pb-24 text-[#1E293B]">
      {/* Header Container */}
      <div className="bg-white border-b border-slate-200/80 p-5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black text-blue-600 tracking-wider uppercase flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              SODABOT STUDIO
            </span>
            <h1 className="text-xl font-extrabold text-[#0F172A] tracking-tight mt-0.5">
              안녕하세요, {displayName}님
            </h1>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
              title="로그아웃"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Live Robot Status Pill */}
        <div className="mt-3.5 flex items-center justify-between p-3 rounded-2xl bg-[#F8FAFC] border border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              {isSodabotConnected ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-300" />
              )}
            </span>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#1E293B]">
                  {isSodabotConnected ? `${robotName}` : '소다봇 연결 안 됨'}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                    isSodabotConnected
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isSodabotConnected ? '온라인' : '오프라인'}
                </span>
              </div>
            </div>
          </div>

          {onQuickReconnect && !isSodabotConnected && (
            <button
              onClick={onQuickReconnect}
              disabled={isVerifying}
              className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer transition-all active:scale-95"
            >
              <RefreshCw className={`w-3 h-3 ${isVerifying ? 'animate-spin' : ''}`} />
              <span>{isVerifying ? '연결 중' : '재연결'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 5 Big Cards */}
      <div className="p-4 space-y-3 max-w-lg mx-auto w-full">
        <p className="text-xs font-bold text-slate-500 px-1">주요 기능</p>

        {menuCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => onNavigateTab(card.tab, card.extra)}
              className="w-full text-left bg-white active:scale-[0.98] border border-slate-200/90 rounded-3xl p-4 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between gap-3 cursor-pointer group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 shadow-2xs ${card.color}`}
                >
                  <Icon className="w-6 h-6" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-[#0F172A] truncate">
                      {card.title}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {card.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                    {card.description}
                  </p>
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-blue-50 text-slate-400 group-hover:text-blue-600 flex items-center justify-center shrink-0 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileHomeScreen;
