import React from 'react';
import {
  Wrench,
  Cpu,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Info,
  ArrowRight
} from 'lucide-react';

interface SodabotAssemblyScreenProps {
  onBackToFirmware?: () => void;
}

export default function SodabotAssemblyScreen({ onBackToFirmware }: SodabotAssemblyScreenProps) {
  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-[#F8FAFC] select-none text-[#1D1D1F] scrollbar-thin">
      <div className="p-6 md:p-10 max-w-[1200px] mx-auto w-full space-y-8 animate-fade-in pb-16">
        
        {/* 1. Header Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl px-6 py-4 shadow-xs">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                <Wrench className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold text-[#1E293B] tracking-tight">
                9-2. 소다봇 조립하기
              </h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href="/images/sodabot_assembly_guide.jpg"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs text-decoration-none"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>조립도 크게보기</span>
              </a>
            </div>
          </div>
        </div>

        {/* 2. Main Assembly Image Showcase */}
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-black text-[#1E293B]">
                소다봇 모듈별 분해도 및 단계별 조립도
              </h2>
            </div>
            <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
              📐 STEP 1 ~ STEP 5
            </span>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center group">
            <img
              src="/images/sodabot_assembly_guide.jpg"
              alt="소다봇 조립 가이드"
              className="w-full h-auto max-h-[600px] object-contain transition-transform duration-300 group-hover:scale-[1.01]"
            />
            <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-xs text-white text-[11px] px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5">
              <span>🔍 이미지를 클릭하면 새 창에서 고해상도로 볼 수 있습니다.</span>
            </div>
          </div>
        </div>

        {/* 3. Step by Step Assembly Instructions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Step 1 */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs space-y-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm">
              1
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              하단 베이스 및 아크릴 프레임 결합
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              로봇 하단 지지대와 측면 아크릴 프레임을 전용 볼트/너트로 조립하여 단단한 외골격을 완성합니다.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs space-y-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm">
              2
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              ESP32 메인보드 및 배터리 안착
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              ESP32 Super Mini 컨트롤러와 배터리를 내부 가이드 슬롯에 장착하고 전원 커넥터를 확인합니다.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs space-y-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-sm">
              3
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              원형 LCD 눈동자 & 마이크/스피커 배선
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              전면 원형 LCD, 원형 I2S 마이크, 소형 스피커를 연결하고 상단 헤드 캡을 닫아 조립을 마무리합니다.
            </p>
          </div>

        </div>

        {/* 4. Caution / Tips */}
        <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-sm">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs md:text-sm font-bold text-amber-950">
              조립 시 주의사항
            </h4>
            <p className="text-xs text-amber-800/90 leading-relaxed">
              전원(3.3V / GND) 극성을 반드시 확인한 후 결선하세요. 아크릴 조립 시 볼트를 너무 세게 조이면 파손될 수 있으니 적당한 힘으로 조여주세요.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
