import React from 'react';
import {
  Mic,
  Smile,
  Brain,
  Cpu,
  Sparkles,
  AudioLines,
  Sun,
  Database,
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
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-[#FAF9F6] select-none text-[#20262B] scrollbar-thin">
      <div className="p-6 md:p-8 max-w-[1340px] mx-auto w-full space-y-7 animate-fade-in">
        
        {/* Hero Banner Section (Apple/Muji Warm Minimalism Style) */}
        <div className="relative overflow-hidden rounded-[24px] bg-white border border-[#E9E7E2] shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <div className="relative w-full aspect-[16/8] sm:aspect-[16/8.5] md:aspect-[16/7.5] max-h-[460px] overflow-hidden flex items-center justify-center">
            <img
              src="/images/welcome_sodabot_warm.jpg"
              alt="소다봇 스튜디오 환영 배너"
              className="w-full h-full object-cover object-center"
            />
            
            {/* Dynamic Welcome Heading Overlay */}
            <div className="absolute top-8 left-8 sm:top-10 sm:left-12 md:top-14 md:left-16 z-10 space-y-1.5 md:space-y-2 pointer-events-none">
              <div className="text-3xl sm:text-4xl md:text-[42px] font-bold text-[#20262B] tracking-tight leading-[1.18]">
                안녕하세요,
              </div>
              <div className="text-3xl sm:text-4xl md:text-[42px] font-bold text-[#20262B] tracking-tight leading-[1.18]">
                {displayName}님!
              </div>
              <p className="text-xs sm:text-sm md:text-[15px] font-normal text-[#555B60] pt-2 max-w-md hidden sm:block tracking-tight">
                소다봇과 함께하는 스마트한 피지컬 AI 학습 공간입니다.
              </p>
            </div>
          </div>
        </div>

        {/* Feature Introduction Section (소다봇 주요 특징 소개) */}
        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center text-[#168571]">
              <Sparkles className="w-5 h-5 fill-[#168571]" />
            </div>
            <h2 className="text-lg md:text-[20px] font-semibold text-[#20262B] tracking-tight">
              소다봇(SODABOT) 주요 특징
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 items-stretch">
            
            {/* Feature 1: 실시간 음성 AI */}
            <div className="bg-white border border-[#E9E7E2] rounded-[20px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] warm-card-hover flex flex-col justify-between h-full space-y-5">
              <div className="space-y-3.5">
                <div className="w-12 h-12 rounded-[14px] bg-[#E8F4EF] text-[#168571] flex items-center justify-center shrink-0">
                  <Mic className="w-6 h-6 stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-[#20262B] tracking-tight">
                    실시간 음성 AI 대화
                  </h3>
                  <p className="text-[13px] text-[#858B8D] mt-2 leading-relaxed">
                    I2S 고감도 마이크와 스피커를 통해 자연스럽게 음성을 주고받으며 사람처럼 소통합니다.
                  </p>
                </div>
              </div>
              <div className="pt-3.5 border-t border-[#F0EFEB] flex items-center gap-1.5 text-[12px] font-medium text-[#168571]">
                <AudioLines className="w-3.5 h-3.5" />
                <span>Voice & Audio Chat</span>
              </div>
            </div>

            {/* Feature 2: 감정 표현 LCD */}
            <div className="bg-white border border-[#E9E7E2] rounded-[20px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] warm-card-hover flex flex-col justify-between h-full space-y-5">
              <div className="space-y-3.5">
                <div className="w-12 h-12 rounded-[14px] bg-[#FFF5EA] text-[#E89435] flex items-center justify-center shrink-0">
                  <Smile className="w-6 h-6 stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-[#20262B] tracking-tight">
                    생생한 감정 표현 LCD
                  </h3>
                  <p className="text-[13px] text-[#858B8D] mt-2 leading-relaxed">
                    대화 맥락에 맞춰 행복, 놀람, 윙크 등 다채로운 표정을 100% 실시간 벡터 그래픽으로 표시합니다.
                  </p>
                </div>
              </div>
              <div className="pt-3.5 border-t border-[#F0EFEB] flex items-center gap-1.5 text-[12px] font-medium text-[#E89435]">
                <Sun className="w-3.5 h-3.5" />
                <span>Dynamic Expressions</span>
              </div>
            </div>

            {/* Feature 3: 나만의 AI 친구 & 기억 */}
            <div className="bg-white border border-[#E9E7E2] rounded-[20px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] warm-card-hover flex flex-col justify-between h-full space-y-5">
              <div className="space-y-3.5">
                <div className="w-12 h-12 rounded-[14px] bg-[#E8F4EF] text-[#168571] flex items-center justify-center shrink-0">
                  <Brain className="w-6 h-6 stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-[#20262B] tracking-tight">
                    나만의 AI 친구 & 기억
                  </h3>
                  <p className="text-[13px] text-[#858B8D] mt-2 leading-relaxed">
                    내가 원하는 성격과 호칭, 중요한 3가지 기억을 저장하여 나를 가장 잘 아는 친구가 됩니다.
                  </p>
                </div>
              </div>
              <div className="pt-3.5 border-t border-[#F0EFEB] flex items-center gap-1.5 text-[12px] font-medium text-[#168571]">
                <Database className="w-3.5 h-3.5" />
                <span>Persona & Memory</span>
              </div>
            </div>

            {/* Feature 4: ESP32 피지컬 컴퓨팅 */}
            <div className="bg-white border border-[#E9E7E2] rounded-[20px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] warm-card-hover flex flex-col justify-between h-full space-y-5">
              <div className="space-y-3.5">
                <div className="w-12 h-12 rounded-[14px] bg-[#F4F1FD] text-[#7C3AED] flex items-center justify-center shrink-0">
                  <Cpu className="w-6 h-6 stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-[#20262B] tracking-tight">
                    직접 만드는 하드웨어
                  </h3>
                  <p className="text-[13px] text-[#858B8D] mt-2 leading-relaxed">
                    ESP32 보드와 센서 회로를 직접 배선하고 아두이노 펌웨어를 다운로드하여 완성합니다.
                  </p>
                </div>
              </div>
              <div className="pt-3.5 border-t border-[#F0EFEB] flex items-center gap-1.5 text-[12px] font-medium text-[#7C3AED]">
                <Zap className="w-3.5 h-3.5" />
                <span>ESP32 & Arduino</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
