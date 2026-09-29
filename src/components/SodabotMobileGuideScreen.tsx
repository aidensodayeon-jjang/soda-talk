import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Smartphone,
  QrCode,
  Wifi,
  ShieldAlert,
  Download,
  Copy,
  Check,
  Share2,
  PlusSquare,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Info,
  Layers,
  ArrowRight,
  RotateCcw
} from 'lucide-react';

interface SodabotMobileGuideScreenProps {
  currentUser?: {
    id: string;
    username: string;
    displayName: string;
  } | null;
}

export default function SodabotMobileGuideScreen({ currentUser }: SodabotMobileGuideScreenProps) {
  const [copied, setCopied] = useState(false);
  const [activeOsTab, setActiveOsTab] = useState<'ios' | 'android'>('ios');
  const [customServerUrl, setCustomServerUrl] = useState('');
  const [currentOrigin, setCurrentOrigin] = useState('');
  const [detectedLanUrl, setDetectedLanUrl] = useState('');
  const [localIps, setLocalIps] = useState<string[]>([]);

  const userKey = currentUser?.id || currentUser?.username || 'default';
  const getScopedKey = (key: string) => `sodabot_${userKey}_${key}`;

  const [robotIp, setRobotIp] = useState<string>(() => {
    return localStorage.getItem(getScopedKey('robot_ip')) || localStorage.getItem('sodabot_robot_ip') || '192.168.0.177';
  });
  const [copiedRobotIp, setCopiedRobotIp] = useState(false);

  const robotLastOctet = robotIp.includes('.') ? robotIp.split('.').pop() || '' : '';

  const handleCopyRobotIp = () => {
    if (!robotIp) return;
    navigator.clipboard.writeText(robotIp).then(() => {
      setCopiedRobotIp(true);
      setTimeout(() => setCopiedRobotIp(false), 2000);
    });
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      setCurrentOrigin(origin);

      // Fetch actual host LAN IP from server
      fetch('/api/server-info')
        .then((res) => res.json())
        .then((data) => {
          if (data && data.lanUrl) {
            setDetectedLanUrl(data.lanUrl);
            if (Array.isArray(data.localIps)) {
              setLocalIps(data.localIps);
            }
            // If currently on localhost/127.0.0.1, auto-replace with the actual LAN IP for mobile access!
            const isLocalhost =
              window.location.hostname === 'localhost' ||
              window.location.hostname === '127.0.0.1';
            if (isLocalhost) {
              setCustomServerUrl(data.lanUrl);
            } else {
              setCustomServerUrl(origin);
            }
          } else {
            setCustomServerUrl(origin);
          }
        })
        .catch(() => {
          setCustomServerUrl(origin);
        });
    }
  }, []);

  const handleCopyUrl = () => {
    if (!customServerUrl) return;
    navigator.clipboard.writeText(customServerUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleResetUrl = () => {
    setCustomServerUrl(detectedLanUrl || currentOrigin);
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-[#F8FAFC] select-none text-[#1D1D1F] scrollbar-thin">
      <div className="p-6 md:p-10 max-w-[1200px] mx-auto w-full space-y-8 animate-fade-in pb-16">
        
        {/* 1. Header Section */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl px-6 py-4 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shadow-2xs shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-[#1E293B] tracking-tight">
              8-4. 모바일 소다봇 연결 & 홈 화면 추가
            </h1>
          </div>
        </div>

        {/* 2. Main Grid: Left (Large QR Code) & Right (Connection Warnings) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Left: Large QR Code Card (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-3xl p-6 md:p-8 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-3 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold">
                <QrCode className="w-3.5 h-3.5" />
                <span>스마트폰 카메라로 스캔</span>
              </div>
              <h2 className="text-lg font-black text-[#1E293B]">
                모바일 접속 QR 코드
              </h2>
              <p className="text-xs text-[#64748B]">
                스마트폰 기본 카메라로 QR 코드를 비추면 즉시 접속 링크가 열립니다.
              </p>
            </div>

            {/* Big High-Res QR Code Container */}
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-dashed border-indigo-200/80 rounded-2xl relative group">
              <div className="p-4 bg-white rounded-2xl shadow-md border border-slate-100 transition-transform group-hover:scale-105 duration-200">
                <QRCodeSVG
                  value={customServerUrl || currentOrigin || 'http://localhost:7989'}
                  size={220}
                  level="H"
                  includeMargin={true}
                  imageSettings={{
                    src: "/icons/icon.svg",
                    x: undefined,
                    y: undefined,
                    height: 40,
                    width: 40,
                    excavate: true,
                  }}
                />
              </div>
              <div className="mt-4 text-center space-y-1">
                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                  📱 실시간 바로가기 QR
                </span>
              </div>
            </div>

            {/* Server URL Input & Copy */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-[#475569] flex items-center justify-between">
                <span>접속 주소 (서버 URL)</span>
                <button
                  onClick={handleResetUrl}
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> 기본값 리셋
                </button>
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customServerUrl}
                  onChange={(e) => setCustomServerUrl(e.target.value)}
                  placeholder="예: http://192.168.0.171:7989"
                  className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-[#1E293B]"
                />
                <button
                  onClick={handleCopyUrl}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    copied
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '복사됨' : '복사'}</span>
                </button>
              </div>

              {/* Prominently Highlight Sodabot Robot IP */}
              <div className="mt-3 p-4 bg-gradient-to-br from-emerald-50 to-teal-50/60 border border-emerald-200/90 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 -ml-3.5"></span>
                    <span>🤖 내 소다봇 IP 주소</span>
                  </div>
                  {robotIp && (
                    <button
                      onClick={handleCopyRobotIp}
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      {copiedRobotIp ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedRobotIp ? '복사됨' : 'IP 복사'}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between bg-white/90 px-3.5 py-2.5 rounded-xl border border-emerald-200">
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-black font-mono text-emerald-950 tracking-wider">
                      {robotIp || '192.168.0.177'}
                    </span>
                    {robotLastOctet && (
                      <span className="text-[11px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-md font-mono">
                        끝자리: {robotLastOctet}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const newIp = prompt('소다봇의 IP 주소를 입력하세요:', robotIp || '192.168.0.177');
                      if (newIp && newIp.trim()) {
                        setRobotIp(newIp.trim());
                        localStorage.setItem('sodabot_robot_ip', newIp.trim());
                        if (currentUser?.id || currentUser?.username) {
                          localStorage.setItem(`sodabot_${currentUser?.id || currentUser?.username}_robot_ip`, newIp.trim());
                        }
                      }
                    }}
                    className="text-[11px] text-slate-500 hover:text-emerald-700 font-medium underline cursor-pointer"
                  >
                    IP 변경
                  </button>
                </div>

                <p className="text-[11px] text-emerald-800/90 leading-relaxed font-medium">
                  💡 모바일 소다봇 화면에서 <strong>끝자리 ({robotLastOctet || '177'})</strong>만 입력하시면 원터치로 연결됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Connection Notices & Requirements (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-3xl p-6 md:p-8 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>필수 확인 사항</span>
              </div>
              <h2 className="text-lg font-black text-[#1E293B]">
                모바일 소다봇 접속 시 주의사항
              </h2>
              <p className="text-xs text-[#64748B]">
                스마트폰에서 원활하게 소다봇을 제어하고 대화하기 위해 아래 항목을 확인해주세요.
              </p>
            </div>

            <div className="space-y-4">
              
              {/* Notice 1: Same Wi-Fi */}
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-sm">
                  <Wifi className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs md:text-sm font-bold text-blue-950">
                    1. 같은 Wi-Fi(공유기) 네트워크에 접속해주세요
                  </h3>
                  <p className="text-xs text-blue-800/90 leading-relaxed">
                    스마트폰의 LTE/5G 데이터를 끄거나, PC(소다봇 스튜디오 서버)와 스마트폰이 <strong>동일한 Wi-Fi 공유기</strong>에 연결되어 있어야 로컬 IP를 통해 통신이 가능합니다.
                  </p>
                </div>
              </div>

              {/* Notice 2: Localhost vs IP */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-sm">
                  <Info className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs md:text-sm font-bold text-amber-950">
                    2. <code>localhost</code> 대신 PC의 로컬 IP를 사용하세요
                  </h3>
                  <p className="text-xs text-amber-800/90 leading-relaxed">
                    스마트폰에서는 <code>localhost:7989</code>로 접속할 수 없습니다. 상단 주소창의 IP(예: <code>192.168.0.171:7989</code>)로 QR 코드를 생성해 접속해주세요.
                  </p>
                </div>
              </div>

              {/* Notice 3: Bluetooth & Wi-Fi Control */}
              <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200/80 flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs md:text-sm font-bold text-purple-950">
                    3. 실물 소다봇 제어 방식 안내 (BLE & Wi-Fi)
                  </h3>
                  <p className="text-xs text-purple-800/90 leading-relaxed">
                    모바일 화면 하단 <strong>[제어]</strong> 탭에서 소다봇 Wi-Fi IP 입력 또는 블루투스 페어링으로 표정 변경, 스피커 음성 출력(TTS), 효과음을 실시간 전송할 수 있습니다.
                  </p>
                </div>
              </div>

            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">💡 로그인 정보와 친구 설정은 PC와 모바일 간 100% 자동 동기화됩니다.</span>
            </div>
          </div>

        </div>

        {/* 3. OS-Specific PWA "Add to Home Screen" Step-by-Step Guide */}
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold">
                <Download className="w-3.5 h-3.5" />
                <span>PWA 앱 설치 가이드</span>
              </div>
              <h2 className="text-xl font-black text-[#1E293B]">
                기종별 홈 화면 추가 (앱으로 설치하는 방법)
              </h2>
              <p className="text-xs text-[#64748B]">
                홈 화면에 추가하면 브라우저 주소창 없이 100% 전체화면 네이티브 앱으로 동작합니다.
              </p>
            </div>

            {/* OS Switcher Tabs */}
            <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200">
              <button
                onClick={() => setActiveOsTab('ios')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  activeOsTab === 'ios'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🍎 iOS (iPhone / iPad)</span>
              </button>
              <button
                onClick={() => setActiveOsTab('android')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  activeOsTab === 'android'
                    ? 'bg-white text-emerald-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🤖 Android (갤럭시 / Chrome)</span>
              </button>
            </div>
          </div>

          {/* iOS Guide */}
          {activeOsTab === 'ios' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 relative flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    1
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">Safari 브라우저 접속</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    아이폰의 <strong>기본 카메라</strong>로 상단 QR 코드를 스캔하거나, <strong>Safari</strong> 브라우저로 주소에 접속합니다.
                  </p>
                </div>
                <div className="text-[11px] font-semibold text-blue-600 pt-2 border-t border-slate-200/60">
                  ⚠️ Safari 브라우저 권장
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 relative flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    2
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">하단 [공유] 버튼 탭</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    화면 하단 중앙의 <strong>[공유 버튼 (네모에 위쪽 화살표 모양 ⎋)]</strong> 아이콘을 터치합니다.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white p-2 rounded-xl border border-slate-200">
                  <Share2 className="w-4 h-4 text-blue-600" />
                  <span>공유 아이콘 선택</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 relative flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    3
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">[홈 화면에 추가] 선택</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    메뉴를 아래로 스크롤하여 <strong>[홈 화면에 추가 (+)]</strong> 항목을 찾아 선택합니다.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white p-2 rounded-xl border border-slate-200">
                  <PlusSquare className="w-4 h-4 text-emerald-600" />
                  <span>홈 화면에 추가 (+)</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 relative flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    4
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">우측 상단 [추가] 완료</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    이름 확인 후 우측 상단의 <strong>[추가]</strong>를 누르면 아이폰 홈 화면에 소다봇 아이콘이 생성됩니다!
                  </p>
                </div>
                <div className="text-[11px] font-bold text-emerald-600 bg-emerald-50 p-2 rounded-xl border border-emerald-200 text-center">
                  🎉 전체화면 앱으로 실행
                </div>
              </div>
            </div>
          )}

          {/* Android Guide */}
          {activeOsTab === 'android' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 relative flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    1
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">Chrome / 삼성인터넷 접속</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    QR 코드를 스캔하거나 <strong>Chrome</strong> 또는 <strong>삼성 인터넷</strong> 브라우저로 접속합니다.
                  </p>
                </div>
                <div className="text-[11px] font-semibold text-emerald-600 pt-2 border-t border-slate-200/60">
                  ⚡ Chrome 브라우저 권장
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 relative flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    2
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">설치 배너 또는 메뉴 터치</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    화면 상단/하단에 나타나는 <strong>[앱 설치하기]</strong> 배너를 누르거나, 우측 상단 <strong>메뉴 (⋮)</strong>를 터치합니다.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white p-2 rounded-xl border border-slate-200">
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>앱 설치 / 메뉴 (⋮)</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 relative flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    3
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">[홈 화면에 추가] 선택</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    메뉴에서 <strong>[앱 설치]</strong> 또는 <strong>[현재 페이지 추가 &gt; 홈 화면]</strong>을 선택합니다.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white p-2 rounded-xl border border-slate-200">
                  <PlusSquare className="w-4 h-4 text-blue-600" />
                  <span>홈 화면에 추가</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 relative flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    4
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">[설치] 버튼 누르고 완료</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    확인 팝업에서 <strong>[설치]</strong> 또는 <strong>[추가]</strong>를 누르면 스마트폰 앱 서랍과 홈 화면에 앱이 설치됩니다!
                  </p>
                </div>
                <div className="text-[11px] font-bold text-emerald-600 bg-emerald-50 p-2 rounded-xl border border-emerald-200 text-center">
                  🚀 앱 서랍에 바로가기 등록
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Mobile SODABOT Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
              🎮
            </div>
            <h3 className="text-xs font-bold text-slate-800">실시간 원터치 표정 제어</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              행복, 슬픔, 생각 중, 하트 등 7가지 소다봇 표정을 스마트폰으로 원터치 변경할 수 있습니다.
            </p>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
              🎙️
            </div>
            <h3 className="text-xs font-bold text-slate-800">소다봇 스피커 말하기 (TTS)</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              모바일에서 입력한 텍스트를 실물 소다봇의 스피커로 또박또박 음성 출력합니다.
            </p>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm">
              💬
            </div>
            <h3 className="text-xs font-bold text-slate-800">AI 친구 통합 대화</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              웹 채팅과 소다봇 음성 대화 이력이 모바일에서도 하나의 기억으로 매끄럽게 연결됩니다.
            </p>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
              🔊
            </div>
            <h3 className="text-xs font-bold text-slate-800">친구 메시지 소다봇으로 듣기</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              친구들이 보낸 1:1 메시지와 그룹방 소식을 소다봇 스피커로 생생하게 들을 수 있습니다.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
