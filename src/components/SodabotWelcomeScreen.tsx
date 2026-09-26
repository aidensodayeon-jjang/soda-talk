import React from 'react';
import {
  Mic,
  Smile,
  Brain,
  Cpu,
  Sparkles,
  Volume2,
  Heart,
  Zap
} from 'lucide-react';

interface SodabotWelcomeScreenProps {
  currentUser?: {
    id: string;
    username: string;
    displayName: string;
    role?: string;
    canAccessChat?: boolean;
    personalApiKey?: string;
  } | null;
}

export default function SodabotWelcomeScreen({ currentUser }: SodabotWelcomeScreenProps) {
  const displayName = currentUser?.displayName || currentUser?.username || '소다봇 친구';

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-[#F8FAFC] select-none text-[#1D1D1F] scrollbar-thin">
      <div className="p-6 md:p-8 max-w-[1300px] mx-auto w-full space-y-8 animate-fade-in">
        
        {/* Hero Banner Section (이미지 + 환영 텍스트) */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-500/10 via-sky-500/5 to-white border border-[#E2E8F0] shadow-sm">
          <div className="relative w-full aspect-[16/9] max-h-[440px] md:max-h-[480px] bg-slate-100 overflow-hidden flex items-center justify-center">
            <img
              src="/images/welcome_sodabot.png"
              alt="소다봇 환영 화면"
              className="w-full h-full object-cover object-center"
            />
            
            {/* Dynamic Welcome Heading Overlay */}
            <div className="absolute top-6 left-6 md:top-12 md:left-14 z-10 space-y-1 md:space-y-2 pointer-events-none drop-shadow-xs">
              <div className="text-2xl sm:text-3xl md:text-5xl font-black text-[#3B82F6] tracking-tight leading-tight">
                안녕하세요,
              </div>
              <div className="text-2xl sm:text-3xl md:text-5xl font-black text-[#1E40AF] tracking-tight leading-tight">
                {displayName}님!
              </div>
              <p className="text-xs sm:text-sm md:text-base font-bold text-slate-700/80 pt-1 md:pt-2 max-w-md hidden sm:block">
                소다봇과 함께하는 스마트한 피지컬 AI 학습 공간입니다.
              </p>
            </div>

            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
          </div>
        </div>

        {/* Feature Introduction Section (소다봇 주요 특징 소개) */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg md:text-xl font-black text-[#1E293B]">
              소다봇(SODABOT) 주요 특징
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
            
            {/* Feature 1: 실시간 음성 AI */}
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-xs flex flex-col justify-between h-full space-y-4">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
                  <Mic className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B]">
                    실시간 음성 AI 대화
                  </h3>
                  <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
                    I2S 고감도 마이크와 스피커를 통해 자연스럽게 음성을 주고받으며 사람처럼 소통합니다.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-blue-600">
                <span>🎙️ Voice & Audio Chat</span>
              </div>
            </div>

            {/* Feature 2: 감정 표현 LCD */}
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-xs flex flex-col justify-between h-full space-y-4">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0 shadow-2xs">
                  <Smile className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B]">
                    생생한 감정 표현 LCD
                  </h3>
                  <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
                    대화 맥락에 맞춰 행복, 놀람, 윙크 등 다채로운 표정을 100% 실시간 벡터 그래픽으로 표시합니다.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-amber-600">
                <span>✨ Dynamic Expressions</span>
              </div>
            </div>

            {/* Feature 3: 나만의 AI 친구 & 기억 */}
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-xs flex flex-col justify-between h-full space-y-4">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
                  <Brain className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B]">
                    나만의 AI 친구 & 기억
                  </h3>
                  <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
                    내가 원하는 성격과 호칭, 중요한 3가지 기억을 저장하여 나를 가장 잘 아는 친구가 됩니다.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                <span>🧠 Persona & Memory</span>
              </div>
            </div>

            {/* Feature 4: ESP32 피지컬 컴퓨팅 */}
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-xs flex flex-col justify-between h-full space-y-4">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 shadow-2xs">
                  <Cpu className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B]">
                    직접 만드는 하드웨어
                  </h3>
                  <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
                    ESP32 보드와 센서 회로를 직접 배선하고 아두이노 펌웨어를 다운로드하여 완성합니다.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-purple-600">
                <span>⚡ ESP32 & Arduino</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
