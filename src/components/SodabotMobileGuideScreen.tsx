import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, Copy, Check } from 'lucide-react';

interface SodabotMobileGuideScreenProps {
  currentUser?: { id: string; username: string; displayName: string } | null;
}

export default function SodabotMobileGuideScreen(_props: SodabotMobileGuideScreenProps) {
  const [url, setUrl] = useState('');
  const [defaultUrl, setDefaultUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    const origin = window.location.origin;
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
    const initialize = async () => {
      try {
        let address = origin;
        if (local) {
          const response = await fetch('/api/server-info');
          if (!response.ok) throw new Error('서버 주소 확인 실패');
          const data = await response.json();
          if (!data.lanUrl) throw new Error('서버 주소 없음');
          address = data.lanUrl;
        }
        if (!disposed) { setUrl(address); setDefaultUrl(address); }
      } catch {
        if (!disposed) setError('접속 주소를 찾지 못했어요. 아래에서 컴퓨터의 접속 주소를 입력해주세요.');
      }
    };
    initialize();
    return () => { disposed = true; };
  }, []);
  let validUrl = '';
  try {
    const parsed = new URL(url);
    if (['http:', 'https:'].includes(parsed.protocol) && !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) validUrl = parsed.href;
  } catch { /* Wait until a complete address has been entered. */ }
  const copy = async () => {
    try { await navigator.clipboard.writeText(validUrl); setCopied(true); }
    catch { setError('주소 복사가 안 되면 아래 접속 주소를 길게 눌러 복사해주세요.'); }
  };
  return (
    <div className="flex-1 h-screen overflow-y-auto bg-[#F8FAFC] text-slate-800">
      <main className="max-w-2xl mx-auto px-5 py-8 md:py-12 space-y-5">
        <header className="flex items-center gap-3">
          <Smartphone className="w-7 h-7 text-blue-600" />
          <h1 className="text-xl font-bold">10-1. 휴대폰으로 소다봇 열기</h1>
        </header>
        <section className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 text-center space-y-5">
          <h2 className="text-2xl font-bold">카메라로 QR을 비춰주세요</h2>
          <p className="text-sm text-slate-600">컴퓨터와 휴대폰을 같은 Wi-Fi에 연결한 뒤,<br />휴대폰 카메라로 스캔하고 뜨는 링크를 누르세요.</p>
          <div className="min-h-64 flex items-center justify-center">
            {validUrl ? <div className="bg-white p-3"><QRCodeSVG value={validUrl} size={224} level="M" includeMargin title="휴대폰 소다봇 접속 QR 코드" /></div>
              : <p className="text-sm text-slate-500">{error ? '접속 주소를 확인해주세요.' : 'QR 코드를 준비하고 있어요…'}</p>}
          </div>
          <p className="font-medium text-sm">화면이 열리면 평소 계정으로 로그인하세요.</p>
          <button type="button" onClick={copy} disabled={!validUrl} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm disabled:opacity-40">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? '주소를 복사했어요' : '접속 주소 복사'}
          </button>
          {error && <p role="alert" className="text-sm text-amber-700">{error}</p>}
        </section>
        <details className="bg-white border border-slate-200 rounded-2xl p-5">
          <summary className="font-semibold cursor-pointer">연결이 안 되나요?</summary>
          <div className="pt-4 space-y-4 text-sm text-slate-600">
            <p>컴퓨터와 휴대폰이 같은 Wi-Fi인지 확인해주세요. 컴퓨터의 소다봇 서버도 켜져 있어야 합니다.</p>
            <p>로봇을 직접 조작하려면 휴대폰 화면의 ‘제어’에서 연결하세요. 여기의 QR은 스튜디오 접속용입니다.</p>
            <label htmlFor="mobile-server-url" className="block font-semibold">접속 주소</label>
            <input id="mobile-server-url" type="url" value={url} onChange={e => { setUrl(e.target.value); setCopied(false); }} placeholder="http://컴퓨터IP:7989" className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs" />
            {url && !validUrl && <p className="text-amber-700">휴대폰에서 열 수 있는 http 또는 https 주소를 입력해주세요. localhost 주소는 사용할 수 없습니다.</p>}
            {defaultUrl && <button type="button" onClick={() => { setUrl(defaultUrl); setCopied(false); setError(''); }} className="text-blue-600 underline">자동으로 찾은 주소 사용</button>}
          </div>
        </details>
        <details className="bg-white border border-slate-200 rounded-2xl p-5">
          <summary className="font-semibold cursor-pointer">휴대폰 홈 화면에 추가하기 (선택)</summary>
          <div className="pt-4 space-y-3 text-sm text-slate-600">
            <p><strong>아이폰:</strong> Safari에서 열기 → 공유 → 홈 화면에 추가</p>
            <p><strong>안드로이드:</strong> Chrome에서 열기 → ⋮ 메뉴 → 홈 화면에 추가</p>
            <p className="text-xs">기종과 브라우저에 따라 메뉴 이름이 다를 수 있습니다.</p>
          </div>
        </details>
      </main>
    </div>
  );
}
