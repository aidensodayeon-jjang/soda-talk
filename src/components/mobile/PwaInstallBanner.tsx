import React, { useState, useEffect } from 'react';
import { Download, X, Share2, PlusSquare, Sparkles } from 'lucide-react';

const PWA_DISMISS_KEY = 'sodabot_pwa_banner_dismissed_until';
const DISMISS_DAYS = 7;

export const PwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [isIosSafari, setIsIosSafari] = useState<boolean>(false);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if already running in standalone mode (PWA installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setShowBanner(false);
      return;
    }

    // 2. Check if banner was dismissed recently
    const dismissedUntil = localStorage.getItem(PWA_DISMISS_KEY);
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      return;
    }

    // 3. Detect iOS Safari
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|chrome/.test(ua);

    if (isIos && isSafari) {
      setIsIosSafari(true);
      setShowBanner(true);
      return;
    }

    // 4. Listen for Chrome/Android beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIosGuide(false);
    const expireTime = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(PWA_DISMISS_KEY, expireTime.toString());
  };

  const handleInstallClick = async () => {
    if (isIosSafari) {
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) {
      alert("브라우저 메뉴에서 '홈 화면에 추가'를 선택해 주세요.");
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Floating Install Prompt Banner */}
      <div className="fixed top-4 left-4 right-4 z-40 max-w-md mx-auto animate-fade-in">
        <div className="bg-white/95 backdrop-blur-md border border-blue-200/80 rounded-2xl p-3.5 shadow-xl flex items-center justify-between gap-3 text-[#1D1D1F]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-400 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-[#1E293B] truncate flex items-center gap-1.5">
                <span>SODABOT STUDIO 앱 설치</span>
                <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 text-[10px] rounded-md font-semibold">PWA</span>
              </h4>
              <p className="text-[11px] text-[#64748B] truncate">
                홈 화면에 추가하면 앱처럼 빠르게 실행돼요!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>추가</span>
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              title="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Safari Guide Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-scale-up text-[#1D1D1F]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#1E293B] flex items-center gap-2">
                <Share2 className="w-5 h-5 text-blue-600" />
                <span>홈 화면에 추가하는 방법</span>
              </h3>
              <button
                onClick={() => setShowIosGuide(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#475569] leading-relaxed">
              <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                  1
                </span>
                <p>
                  사파리(Safari) 브라우저 하단의 <strong>공유 버튼 <Share2 className="w-3.5 h-3.5 inline text-blue-600" /></strong> 을 탭하세요.
                </p>
              </div>

              <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                  2
                </span>
                <p>
                  메뉴에서 <strong>'홈 화면에 추가' <PlusSquare className="w-3.5 h-3.5 inline text-blue-600" /></strong> 항목을 선택하세요.
                </p>
              </div>

              <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                  3
                </span>
                <p>
                  우측 상단 <strong>'추가'</strong>를 누르면 바탕화면에 소다봇 앱이 설치됩니다!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl shadow-sm transition-all cursor-pointer"
            >
              확인했어요
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PwaInstallBanner;
