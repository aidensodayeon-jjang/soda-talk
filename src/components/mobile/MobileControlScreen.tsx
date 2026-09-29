import React, { useState } from 'react';
import {
  Bot,
  Volume2,
  Smile,
  Send,
  Sparkles,
  Wifi,
  WifiOff,
  RefreshCw,
  Check,
  AlertCircle,
  Play,
  RotateCcw,
  Zap,
  VolumeX,
  Bluetooth,
  BluetoothSearching,
  Info,
  Power
} from 'lucide-react';
import { sodabotTransport } from '../../utils/sodabotTransport';

const SERVICE_UUID = '6b8a0001-4f2a-4b3c-9d5e-1a2b3c4d5e6f';
const CHAR_WRITE_UUID = '6b8a0002-4f2a-4b3c-9d5e-1a2b3c4d5e6f';
const CHAR_NOTIFY_UUID = '6b8a0003-4f2a-4b3c-9d5e-1a2b3c4d5e6f';

interface MobileControlScreenProps {
  currentUser: {
    id: string;
    username: string;
    displayName: string;
  } | null;
  isSodabotConnected: boolean;
  robotName?: string;
  sodabotIp?: string | null;
  onVerifyConnection?: (ip?: string) => Promise<void>;
  isVerifying?: boolean;
}

const EXPRESSIONS = [
  { id: 'idle', label: '🙂 기본', desc: '평상시 표정', value: 'idle' },
  { id: 'listening', label: '👂 듣는 중', desc: '경청 모드', value: 'listening' },
  { id: 'thinking', label: '❓ 생각 중', desc: '고민 모드', value: 'thinking' },
  { id: 'speaking', label: '💬 답변 중', desc: '말하는 표정', value: 'happy' },
  { id: 'happy', label: '😊 기쁨', desc: '활짝 웃기', value: 'happy' },
  { id: 'sad', label: '😢 슬픔', desc: '눈물 표정', value: 'sad' },
  { id: 'surprised', label: '😮 놀람', desc: '깜짝 놀람', value: 'surprised' },
  { id: 'heart', label: '❤️ 하트', desc: '사랑 모드', value: 'heart' },
];

export const MobileControlScreen: React.FC<MobileControlScreenProps> = ({
  currentUser,
  isSodabotConnected,
  robotName = 'SODABOT',
  sodabotIp,
  onVerifyConnection,
  isVerifying = false
}) => {
  const [speakText, setSpeakText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeExpr, setActiveExpr] = useState<string>('idle');
  const [feedbackToast, setFeedbackToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  // Connection UI States
  const [connectTab, setConnectTab] = useState<'ble' | 'wifi'>('wifi');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [isBleSearching, setIsBleSearching] = useState(false);
  
  // Calculate default subnet prefix and last octet
  const initialSavedIp = sodabotIp || localStorage.getItem('sodabot_robot_ip') || '';
  const detectSubnet = () => {
    if (initialSavedIp && initialSavedIp.includes('.')) {
      const parts = initialSavedIp.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.`;
      }
    }
    if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname.includes('.')) {
      const parts = window.location.hostname.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.`;
      }
    }
    return '192.168.0.';
  };

  const detectLastOctet = () => {
    if (initialSavedIp && initialSavedIp.includes('.')) {
      const parts = initialSavedIp.split('.');
      if (parts.length === 4) {
        return parts[3];
      }
    }
    return '177';
  };

  const [subnetPrefix, setSubnetPrefix] = useState<string>(detectSubnet);
  const [lastOctet, setLastOctet] = useState<string>(detectLastOctet);
  const [manualIp, setManualIp] = useState(initialSavedIp || '192.168.0.177');
  const [isFullIpMode, setIsFullIpMode] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackToast({ text, type });
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  // 1. Web Bluetooth Direct One-Click Pairing
  const handleBlePair = async () => {
    if (!(navigator as any).bluetooth) {
      showToast('현재 브라우저에서는 블루투스(Web BLE)를 지원하지 않습니다. Chrome 브라우저를 이용하거나 Wi-Fi로 연결해 주세요.', 'error');
      return;
    }

    setIsBleSearching(true);
    try {
      sodabotTransport.disconnect();

      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [SERVICE_UUID]
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      const writeChar = await service.getCharacteristic(CHAR_WRITE_UUID);
      const notifyChar = await service.getCharacteristic(CHAR_NOTIFY_UUID);

      await notifyChar.startNotifications();
      sodabotTransport.attachBle(device, writeChar, notifyChar);

      if (device.name) {
        localStorage.setItem('sodabot_device_name', device.name);
      }

      showToast(`블루투스 연결 성공: ${device.name || 'SODABOT'}`);
      setShowConnectModal(false);
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        showToast(`블루투스 연결 실패: ${err.message || '취소됨'}`, 'error');
      }
    } finally {
      setIsBleSearching(false);
    }
  };

  // 2. Wi-Fi IP Connect
  const handleConnectIp = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetIp = isFullIpMode 
      ? manualIp.trim() 
      : `${subnetPrefix}${lastOctet.trim()}`;

    if (!targetIp || !onVerifyConnection) return;
    localStorage.setItem('sodabot_robot_ip', targetIp);
    setManualIp(targetIp);
    try {
      await onVerifyConnection(targetIp);
      showToast(`소다봇 연결 성공: ${targetIp}`);
      setShowConnectModal(false);
    } catch (err: any) {
      showToast(`Wi-Fi 연결 오류: ${err.message}`, 'error');
    }
  };

  // 3. Disconnect
  const handleDisconnect = () => {
    sodabotTransport.disconnect();
    localStorage.removeItem('sodabot_connected');
    showToast('소다봇 연결이 해제되었습니다.');
  };

  // 4. Trigger Expression change
  const handleExpression = async (expr: typeof EXPRESSIONS[0]) => {
    setActiveExpr(expr.id);
    try {
      await sodabotTransport.send('set_expression', expr.value);
      showToast(`${expr.label} 표정으로 변경되었습니다.`);
    } catch (e: any) {
      window.dispatchEvent(
        new CustomEvent('sodabot-send-command', {
          detail: { action: 'set_expression', value: expr.value, label: expr.label }
        })
      );
      showToast(`${expr.label} 표정 전송 완료`);
    }
  };

  // 5. Trigger Speak Text (TTS)
  const handleSpeak = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = speakText.trim();
    if (!text || isSpeaking) return;

    if (sodabotTransport.type === 'none' && !localStorage.getItem('sodabot_robot_ip')) {
      showToast('소다봇을 먼저 Wi-Fi 또는 블루투스로 연결해 주세요.', 'error');
      return;
    }

    setIsSpeaking(true);
    showToast('소다봇으로 음성 전송 중...');

    try {
      // 실물 소다봇 스피커로 TTS 음성 출력만 전송 (화면 글씨 출력 제거)
      await sodabotTransport.send('speak', text);
      showToast(`소다봇 음성 출력 완료: "${text.length > 15 ? text.slice(0, 15) + '...' : text}"`);
      setSpeakText('');
    } catch (err: any) {
      console.error('TTS send error:', err);
      showToast(err.message || '소다봇 음성 전송에 실패했습니다. Wi-Fi 연결을 확인해주세요.', 'error');
    } finally {
      setIsSpeaking(false);
    }
  };

  // 6. Trigger Motion / Sound Actions
  const handleAction = async (action: string, value: string, label: string) => {
    try {
      await sodabotTransport.send(action, value);
      showToast(`${label} 동작이 실행되었습니다.`);
    } catch (e: any) {
      window.dispatchEvent(
        new CustomEvent('sodabot-send-command', {
          detail: { action, value, label }
        })
      );
      showToast(`${label} 명령 전송 완료`);
    }
  };

  const transportType = sodabotTransport.type;

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-y-auto pb-28 text-[#1E293B]">
      {/* Toast Feedback */}
      {feedbackToast && (
        <div
          className={`fixed top-4 left-4 right-4 z-50 max-w-sm mx-auto p-3.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold text-white animate-fade-in ${
            feedbackToast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          {feedbackToast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <Check className="w-4 h-4 shrink-0 bg-white/20 rounded-full p-0.5" />
          )}
          <span className="truncate">{feedbackToast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-200/80 p-5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[#0F172A] tracking-tight">
                소다봇 제어
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                블루투스 / Wi-Fi 연동, 표정 변경 및 음성 말하기
              </p>
            </div>
          </div>
        </div>

        {/* Connection Bar */}
        <div className="mt-4 p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-3 w-3 shrink-0">
              {isSodabotConnected ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-300" />
              )}
            </span>
            <div className="text-xs min-w-0">
              <div className="flex items-center gap-1.5 truncate">
                <span className="font-extrabold text-[#1E293B] truncate">
                  {isSodabotConnected ? robotName : '소다봇 연결 안 됨'}
                </span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                    transportType === 'ble'
                      ? 'bg-blue-100 text-blue-700'
                      : isSodabotConnected
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {transportType === 'ble' ? '🔵 블루투스' : isSodabotConnected ? '🟢 Wi-Fi' : '오프라인'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isSodabotConnected ? (
              <button
                onClick={handleDisconnect}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                title="연결 해제"
              >
                <Power className="w-3 h-3" />
                <span>해제</span>
              </button>
            ) : (
              <button
                onClick={() => setShowConnectModal(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Bluetooth className="w-3.5 h-3.5" />
                <span>연결하기</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Connection Selection Modal / Drawer */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl animate-scale-up text-[#1E293B]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-600" />
                <span>소다봇 연결 방식 선택</span>
              </h3>
              <button
                onClick={() => setShowConnectModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Segmented Mode Toggle: BLE vs Wi-Fi */}
            <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
              <button
                onClick={() => setConnectTab('ble')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  connectTab === 'ble' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600'
                }`}
              >
                <Bluetooth className="w-3.5 h-3.5" />
                <span>블루투스 (BLE)</span>
              </button>
              <button
                onClick={() => setConnectTab('wifi')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  connectTab === 'wifi' ? 'bg-white text-emerald-600 shadow-2xs' : 'text-slate-600'
                }`}
              >
                <Wifi className="w-3.5 h-3.5" />
                <span>Wi-Fi / IP</span>
              </button>
            </div>

            {/* Mode 1: Bluetooth BLE */}
            {connectTab === 'ble' && (
              <div className="space-y-3 animate-fade-in">
                <p className="text-xs text-slate-500 leading-relaxed">
                  소다봇 전원을 켠 후 아래 버튼을 누르면 주변의 <strong>SODABOT</strong> 기기를 검색하여 원클릭으로 페어링합니다.
                </p>

                <button
                  onClick={handleBlePair}
                  disabled={isBleSearching}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 disabled:opacity-50 text-white font-extrabold text-xs rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <BluetoothSearching className={`w-4 h-4 ${isBleSearching ? 'animate-spin' : ''}`} />
                  <span>{isBleSearching ? '소다봇 검색 중...' : '🔵 블루투스로 소다봇 찾기 & 연결'}</span>
                </button>

                <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100 text-[11px] text-blue-800 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-600" />
                  <span>
                    Chrome 및 안드로이드 브라우저에서 지원됩니다. (아이폰 Safari는 Apple 정책상 Wi-Fi 모드를 권장합니다)
                  </span>
                </div>
              </div>
            )}

            {/* Mode 2: Wi-Fi IP */}
            {connectTab === 'wifi' && (
              <form onSubmit={handleConnectIp} className="space-y-4 animate-fade-in">
                <p className="text-xs text-slate-500 leading-relaxed">
                  소다봇의 <strong>IP 끝자리 번호</strong>만 입력하시면 같은 공유기 내의 소다봇에 바로 연결됩니다.
                </p>

                {!isFullIpMode ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">소다봇 IP 끝자리</label>
                      <button
                        type="button"
                        onClick={() => setIsFullIpMode(true)}
                        className="text-[11px] text-blue-600 hover:underline font-semibold cursor-pointer"
                      >
                        전체 IP 직접 입력
                      </button>
                    </div>
                    <div className="flex items-center bg-[#F8FAFC] border-2 border-emerald-500/60 focus-within:border-emerald-600 focus-within:bg-white rounded-2xl p-2.5 px-3.5 shadow-2xs transition-all">
                      <span className="font-mono text-sm font-black text-slate-400 select-none tracking-tight shrink-0">
                        {subnetPrefix}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min="1"
                        max="254"
                        value={lastOctet}
                        onChange={(e) => setLastOctet(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                        placeholder="177"
                        className="flex-1 bg-transparent text-lg font-black font-mono text-emerald-700 outline-none ml-1 placeholder:text-slate-300"
                        autoFocus
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                      <span>예: {subnetPrefix}177 &rarr; <strong>177</strong> 입력</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">소다봇 전체 IP 주소</label>
                      <button
                        type="button"
                        onClick={() => setIsFullIpMode(false)}
                        className="text-[11px] text-emerald-600 hover:underline font-semibold cursor-pointer"
                      >
                        끝자리만 입력 모드로 복귀
                      </button>
                    </div>
                    <input
                      type="text"
                      value={manualIp}
                      onChange={(e) => setManualIp(e.target.value)}
                      placeholder="192.168.0.177"
                      className="w-full bg-[#F8FAFC] border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl p-3 text-xs text-[#1E293B] outline-none font-mono font-bold"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isVerifying || (!isFullIpMode ? !lastOctet.trim() : !manualIp.trim())}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 text-white font-extrabold text-xs rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Wifi className={`w-4 h-4 ${isVerifying ? 'animate-pulse' : ''}`} />
                  <span>
                    {isVerifying
                      ? '소다봇 연결 확인 중...'
                      : `🟢 ${!isFullIpMode ? `${subnetPrefix}${lastOctet || '?'}` : manualIp} 연결하기`}
                  </span>
                </button>
              </form>
            )}

            <button
              onClick={() => setShowConnectModal(false)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="p-4 max-w-lg mx-auto w-full space-y-5">
        {/* 1. Text to Speech Box */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1E293B]">
            <Volume2 className="w-4 h-4 text-blue-600" />
            <span>텍스트 말하기 (TTS)</span>
          </div>

          <form onSubmit={handleSpeak} className="space-y-3">
            <div className="relative">
              <textarea
                value={speakText}
                onChange={(e) => setSpeakText(e.target.value)}
                placeholder="소다봇이 말할 내용을 입력하세요."
                rows={3}
                maxLength={200}
                className="w-full bg-[#F8FAFC] border border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl p-3.5 text-xs text-[#1E293B] outline-none transition-all placeholder:text-slate-400 resize-none"
              />
              <span className="absolute bottom-2.5 right-3 text-[10px] text-slate-400 font-mono">
                {speakText.length}/200
              </span>
            </div>

            <button
              type="submit"
              disabled={!speakText.trim() || isSpeaking}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 text-white font-extrabold text-xs rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-bounce' : ''}`} />
              <span>{isSpeaking ? '소다봇 말하는 중...' : '소다봇으로 말하기'}</span>
            </button>
          </form>
        </div>

        {/* 2. Expression Grid */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1E293B]">
              <Smile className="w-4 h-4 text-amber-500" />
              <span>표정 바꾸기</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">터치 시 즉시 반영</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {EXPRESSIONS.map((expr) => {
              const isSelected = activeExpr === expr.id;
              return (
                <button
                  key={expr.id}
                  onClick={() => handleExpression(expr)}
                  className={`p-3 rounded-2xl border text-left transition-all active:scale-95 cursor-pointer flex flex-col justify-between min-h-[72px] ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-100 shadow-2xs'
                      : 'bg-[#F8FAFC] border-slate-200/80 hover:border-blue-200 hover:bg-white'
                  }`}
                >
                  <span className="text-sm font-extrabold text-[#0F172A]">{expr.label}</span>
                  <span className="text-[10px] text-slate-500 font-medium mt-1">{expr.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Quick Motion & Sound Actions */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1E293B]">
            <Zap className="w-4 h-4 text-indigo-500" />
            <span>기본 동작 & 효과음</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => handleAction('play_sound', 'greeting', '반가운 인사')}
              className="p-3 bg-[#F8FAFC] hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-2xl text-left active:scale-95 transition-all cursor-pointer"
            >
              <span className="text-xs font-bold text-[#1E293B] block">👋 반가운 인사</span>
              <span className="text-[10px] text-slate-500">멜로디와 함께 인사</span>
            </button>

            <button
              onClick={() => handleAction('play_sound', 'beep', '삐약 사운드')}
              className="p-3 bg-[#F8FAFC] hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-2xl text-left active:scale-95 transition-all cursor-pointer"
            >
              <span className="text-xs font-bold text-[#1E293B] block">🎵 삐약 효과음</span>
              <span className="text-[10px] text-slate-500">경쾌한 피에조 음</span>
            </button>

            <button
              onClick={() => handleAction('play_sound', 'power_on', '파워온 사운드')}
              className="p-3 bg-[#F8FAFC] hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-2xl text-left active:scale-95 transition-all cursor-pointer"
            >
              <span className="text-xs font-bold text-[#1E293B] block">💡 파워온 사운드</span>
              <span className="text-[10px] text-slate-500">2단 비프음 재생</span>
            </button>

            <button
              onClick={() => handleAction('set_expression', 'default', '기본 포즈 리셋')}
              className="p-3 bg-[#F8FAFC] hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-2xl text-left active:scale-95 transition-all cursor-pointer"
            >
              <span className="text-xs font-bold text-[#1E293B] block">🔄 상태 리셋</span>
              <span className="text-[10px] text-slate-500">기본 대기 상태로</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileControlScreen;
