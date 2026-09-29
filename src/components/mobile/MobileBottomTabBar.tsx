import React from 'react';
import {
  Home,
  MessageSquare,
  Users,
  Bot,
  Settings
} from 'lucide-react';

export type MobileTab = 'home' | 'chat' | 'friends' | 'control' | 'settings';

interface MobileBottomTabBarProps {
  currentTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  unreadFriendsCount?: number;
  unreadAiCount?: number;
}

export const MobileBottomTabBar: React.FC<MobileBottomTabBarProps> = ({
  currentTab,
  onSelectTab,
  unreadFriendsCount = 0,
  unreadAiCount = 0
}) => {
  const tabs = [
    {
      id: 'home' as MobileTab,
      label: '홈',
      icon: Home,
      badge: 0
    },
    {
      id: 'chat' as MobileTab,
      label: '대화',
      icon: MessageSquare,
      badge: unreadAiCount
    },
    {
      id: 'friends' as MobileTab,
      label: '친구',
      icon: Users,
      badge: unreadFriendsCount
    },
    {
      id: 'control' as MobileTab,
      label: '제어',
      icon: Bot,
      badge: 0
    },
    {
      id: 'settings' as MobileTab,
      label: '설정',
      icon: Settings,
      badge: 0
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-lg select-none">
      <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-200 cursor-pointer relative ${
                isActive
                  ? 'text-blue-600 font-bold scale-105'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <div className="relative">
                <div
                  className={`p-1.5 rounded-xl transition-all ${
                    isActive ? 'bg-blue-50 text-blue-600 shadow-2xs' : 'bg-transparent'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                {tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] mt-0.5 tracking-tight ${
                  isActive ? 'text-blue-600 font-extrabold' : 'text-slate-500'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomTabBar;
