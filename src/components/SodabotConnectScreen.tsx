import { sodabotTransport } from '../utils/sodabotTransport';
import React, { useState, useRef, useEffect } from 'react';
import { 
  Bluetooth, BluetoothSearching, CheckCircle2, Wifi, Power, RefreshCw, 
  Check, RotateCcw, PenSquare, Activity, Smile, Volume2, Download, Copy,
  Sparkles, Usb, Cpu, Terminal, ArrowRight, ShieldCheck, HelpCircle
} from 'lucide-react';
import { generateSodabotFirmware } from '../utils/sodabotFirmwareGenerator';

const SERVICE_UUID = '6b8a0001-4f2a-4b3c-9d5e-1a2b3c4d5e6f';
const CHAR_WRITE_UUID = '6b8a0002-4f2a-4b3c-9d5e-1a2b3c4d5e6f';
const CHAR_NOTIFY_UUID = '6b8a0003-4f2a-4b3c-9d5e-1a2b3c4d5e6f';

interface SodabotConnectScreenProps {
  currentUser?: {
    id: string;
    username: string;
    displayName: string;
    role?: string;
    canAccessChat?: boolean;
    personalApiKey?: string;
  } | null;
}

export default function SodabotConnectScreen({ currentUser }: SodabotConnectScreenProps) {
  const [apiKey, setApiKey] = useState<string>(() => {
    const saved = localStorage.getItem("sodabot_api_key");
    if (saved && saved.startsWith("sk-soda-") && !saved.includes("자동발급중")) return saved;
    if (currentUser?.personalApiKey) return currentUser.personalApiKey;
    return "sk-soda-23fdcaabe351c318b448d8540b9bb756";
  });
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    if (currentUser?.personalApiKey) {
      setApiKey(currentUser.personalApiKey);
      localStorage.setItem("sodabot_api_key", currentUser.personalApiKey);
      return;
    }

    // API에서 최신 키 조회 (토큰 여부 무관하게 /api/auth/current-key 조회)
    const token = localStorage.getItem("authSessionId") || "";
    fetch("/api/auth/current-key", {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(res => res.json())
      .then(data => {
        if (data?.apiKey) {
          setApiKey(data.apiKey);
          localStorage.setItem("sodabot_api_key", data.apiKey);
        }
      })
      .catch(() => {});
  }, [currentUser]);

  const [step, setStepState] = useState<1 | 2 | 3 | 4>(() => {
    if (sodabotTransport.type !== 'none') return 4;
    const savedStep = localStorage.getItem("sodabot_connect_step");
    if (savedStep) {
      const parsed = parseInt(savedStep, 10);
      if (parsed >= 1 && parsed <= 3) return parsed as 1 | 2 | 3 | 4;
    }
    return 1;
  });

  const setStep = (newStep: 1 | 2 | 3 | 4) => {
    setStepState(newStep);
    localStorage.setItem("sodabot_connect_step", String(newStep));
  };

  const [robotName, setRobotName] = useState(() => {
    const saved = localStorage.getItem("sodabot_custom_name");
    return (saved && /^[a-zA-Z0-9_-]+$/.test(saved)) ? saved : (currentUser?.displayName ? currentUser.displayName.replace(/[^a-zA-Z0-9_-]/g, '') : 'LUMI');
  });
  const [ssid, setSsid] = useState(localStorage.getItem("sodabot_wifi_ssid") || '');
  const [password, setPassword] = useState(localStorage.getItem("sodabot_wifi_password") || '');
  
  const [isSearching, setIsSearching] = useState(false);
  const [foundDevices, setFoundDevices] = useState<{ id: string; name: string; rssi?: number }[]>([]);
  const [connectedDeviceName, setConnectedDeviceName] = useState<string | null>(() => {
    return localStorage.getItem("sodabot_device_name");
  });
  const [status, setStatus] = useState<'idle' | 'ble_connecting' | 'wifi_connecting' | 'connected' | 'error'>(() => {
    if (sodabotTransport.type !== 'none') return 'connected';
    return 'idle';
  });
  const [robotIp, setRobotIp] = useState<string | null>(localStorage.getItem("sodabot_robot_ip"));
  const [copiedCode, setCopiedCode] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [textSize, setTextSize] = useState<number>(0);
  const [manualIpInput, setManualIpInput] = useState('');

  const bleDeviceRef = useRef<any>(null);
  const expressionTimeoutRef = useRef<any>(null);
  const [showExpressions, setShowExpressions] = useState(false);

  useEffect(() => {
    const update = () => {
      const connected = sodabotTransport.type !== 'none';
      setStatus(connected ? 'connected' : 'idle');
      if (connected) setStep(4);
      setRobotIp(localStorage.getItem('sodabot_robot_ip'));
    };
    window.addEventListener('sodabot-status-changed', update);
    const savedIp = localStorage.getItem('sodabot_robot_ip');
    if (savedIp && sodabotTransport.type === 'none') void connectWebSocket(savedIp);
    return () => window.removeEventListener('sodabot-status-changed', update);
  }, []);

  // 1. Download Custom .ino Firmware file
  const handleDownloadFirmware = () => {
    const cleanName = robotName.replace(/[^a-zA-Z0-9_-]/g, '') || 'LUMI';
    localStorage.setItem("sodabot_custom_name", cleanName);
    localStorage.setItem("sodabot_wifi_ssid", ssid);
    localStorage.setItem("sodabot_wifi_password", password);

    const activeApiKey = apiKey || currentUser?.personalApiKey || localStorage.getItem("sodabot_api_key") || 'sk-soda-demo';
    const code = generateSodabotFirmware(cleanName, ssid, password, activeApiKey);
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sodabot_${cleanName}.ino`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 2. Copy Custom Code to Clipboard
  const handleCopyCode = async () => {
    const cleanName = robotName.replace(/[^a-zA-Z0-9_-]/g, '') || 'LUMI';
    localStorage.setItem("sodabot_custom_name", cleanName);
    localStorage.setItem("sodabot_wifi_ssid", ssid);
    localStorage.setItem("sodabot_wifi_password", password);

    const activeApiKey = apiKey || currentUser?.personalApiKey || localStorage.getItem("sodabot_api_key") || 'sk-soda-demo';
    const code = generateSodabotFirmware(cleanName, ssid, password, activeApiKey);
    await navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyApiKey = async () => {
    const activeApiKey = apiKey || currentUser?.personalApiKey || localStorage.getItem("sodabot_api_key") || '';
    if (!activeApiKey) return;
    await navigator.clipboard.writeText(activeApiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const writeCharRef = useRef<any>(null);

  // 3. Web Bluetooth Direct One-Click Pairing
  const handleDirectBlePair = async () => {
    if (!(navigator as any).bluetooth) {
      alert("블루투스를 지원하지 않는 브라우저이거나, 안전하지 않은 주소입니다. Chrome 브라우저에서 'localhost:7989'로 접속해 주세요.");
      return;
    }
    
    setIsSearching(true);
    setStatus('ble_connecting');
    try {
      const cleanName = robotName.replace(/[^a-zA-Z0-9_-]/g, '') || 'LUMI';
      const targetBleName = `SODABOT_${cleanName}`;
      
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [SERVICE_UUID]
      });
      
      bleDeviceRef.current = device;
      setFoundDevices([{
        id: device.id,
        name: device.name || targetBleName,
        rssi: -45
      }]);

      if (device.name) {
        localStorage.setItem("sodabot_device_name", device.name);
      }
      setConnectedDeviceName(device.name || targetBleName);

      // 기기 선택 즉시 바로 연결 수행 (원클릭 페어링)
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      
      const writeChar = await service.getCharacteristic(CHAR_WRITE_UUID);
      const notifyChar = await service.getCharacteristic(CHAR_NOTIFY_UUID);
      writeCharRef.current = writeChar;

      await notifyChar.startNotifications();
      
      sodabotTransport.attachBle(device, writeChar, notifyChar);
      const statusReply = await sodabotTransport.send('get_status');
      if (ssid.trim()) {
        setStatus('wifi_connecting');
        const result = await sodabotTransport.send('configure_wifi', '', { ssid: ssid.trim(), password });
        if (result.ip) { setRobotIp(result.ip); void connectWebSocket(result.ip); }
      } else if (statusReply.ip) {
        setRobotIp(statusReply.ip);
        void connectWebSocket(statusReply.ip);
      }
      setStatus('connected');
      setStep(4);

    } catch (error: any) {
      console.error(error);
      setStatus('idle');
      localStorage.removeItem("sodabot_connected");
      window.dispatchEvent(new Event("sodabot-status-changed"));
      if (error.name !== 'NotFoundError') {
        alert(error.message || "블루투스 연결 실패");
      }
    } finally {
      setIsSearching(false);
    }
  };

  const connectWebSocket = async (ip: string) => {
    try {
      await sodabotTransport.connectWifi(ip);
      await sodabotTransport.send('get_status');
      setRobotIp(ip); setStatus('connected'); setStep(4);
    } catch (error: any) {
      setStatus(sodabotTransport.type === 'none' ? 'error' : 'connected');
      console.error(error);
      if (sodabotTransport.type === 'none') alert(error.message);
    }
  };

  const handleDisconnect = () => {
    if (confirm("소다봇 연결을 해제하시겠습니까?")) {
      localStorage.removeItem("sodabot_robot_ip");
      localStorage.removeItem("sodabot_connected");
      sodabotTransport.disconnect();
      writeCharRef.current = null;
      setRobotIp(null);
      setStatus('idle');
      setStep(1);
      window.dispatchEvent(new Event("sodabot-status-changed"));
    }
  };

  // Real-time Dynamic Expression Testing
  const sendExpression = (expr: string) => {
    window.dispatchEvent(new CustomEvent("sodabot-send-command", {
      detail: { action: "set_expression", value: expr, label: `${expr} 표정 전송` }
    }));
  };

  const sendSoundTest = (soundId: string) => {
    window.dispatchEvent(new CustomEvent("sodabot-send-command", {
      detail: { action: "play_sound", value: soundId, label: `${soundId} 사운드 재생` }
    }));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF9F6] p-8 overflow-y-auto font-sans">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#1D1D1F] flex items-center gap-2">
              <span>🤖 소다봇 맞춤 연결 & 펌웨어 허브</span>
            </h2>
            <p className="text-[#86868B] text-sm mt-1">
              로봇 이름과 Wi-Fi를 입력하고 맞춤 펌웨어를 다운로드하여 소다봇을 100% 실시간으로 제어하세요.
            </p>
          </div>
          {status === 'connected' && (
            <div className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>온라인 ({robotIp})</span>
            </div>
          )}
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between relative px-10">
          <div className="absolute left-10 right-10 top-5 h-[1px] bg-[#EAE6DF] -z-10"></div>
          {[
            { num: 1, label: '1단계: 맞춤 코드 생성 & 다운로드', icon: Cpu },
            { num: 2, label: '2단계: 아두이노 업로드 & 로봇 찾기', icon: BluetoothSearching },
            { num: 3, label: '3단계: 연결 및 IP 획득', icon: Wifi },
            { num: 4, label: '4단계: 실시간 동적 제어', icon: CheckCircle2 }
          ].map((s) => {
            const isActive = step === s.num;
            const isPassed = step > s.num;
            return (
              <div key={s.num} className="flex flex-col items-center gap-2 bg-[#FAF9F6] px-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm
                  ${isActive ? 'bg-indigo-600 text-white shadow-indigo-200 ring-4 ring-indigo-50' : 
                    isPassed ? 'bg-emerald-500 text-white' : 'bg-white border border-[#EAE6DF] text-[#B0ACA5]'}`}>
                  {isPassed ? <Check className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                </div>
                <span className={`text-xs font-semibold ${isActive ? 'text-indigo-600 font-bold' : isPassed ? 'text-[#1D1D1F]' : 'text-[#B0ACA5]'}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          
          {/* Left Columns (Step 1 & Step 2) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* 1단계: 맞춤 펌웨어 생성 카드 */}
              <div className="bg-white border-2 border-indigo-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:border-indigo-200 transition-all">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5" /> 1단계: 맞춤 설정
                    </span>
                    <span className="text-[10px] text-indigo-700 font-extrabold bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                      {currentUser?.displayName || currentUser?.username || 'user'}
                    </span>
                  </div>
                  
                  {/* 고유 API 키 조회 및 복사 */}
                  <div className="p-3 bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-blue-50/60 rounded-2xl border border-indigo-100 mb-3.5 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-black text-indigo-950">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                        <span>고유 SODA API 키</span>
                      </div>
                      <button 
                        onClick={handleCopyApiKey}
                        className="px-2.5 py-0.8 bg-white hover:bg-indigo-50 text-[10px] font-bold text-indigo-600 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                        title="API 키 복사"
                      >
                        {copiedKey ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-indigo-500" />}
                        {copiedKey ? '복사완료' : '키 복사'}
                      </button>
                    </div>
                    
                    <div className="font-mono text-[11px] text-indigo-950 font-black bg-white/95 px-3 py-1.5 rounded-xl border border-indigo-200 select-all truncate tracking-tight shadow-inner">
                      {apiKey || currentUser?.personalApiKey || "sk-soda-23fdcaabe351c318b448d8540b9bb756"}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-[#1D1D1F] block mb-1">로봇 이름</label>
                      <input 
                        type="text" 
                        placeholder="예: LUMI, SODA_01" 
                        value={robotName} 
                        onChange={e => {
                          const sanitized = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '');
                          setRobotName(sanitized);
                        }} 
                        className="w-full text-xs px-3 py-2 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl focus:outline-none focus:border-indigo-500 font-bold font-mono uppercase" 
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#1D1D1F] block mb-1">Wi-Fi 이름 (SSID)</label>
                      <input 
                        type="text" 
                        placeholder="예: MyHome_WiFi (2.4G)" 
                        value={ssid} 
                        onChange={e => setSsid(e.target.value)} 
                        className="w-full text-xs px-3 py-2 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl focus:outline-none focus:border-indigo-500" 
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#1D1D1F] block mb-1">Wi-Fi 비밀번호</label>
                      <input 
                        type="password" 
                        placeholder="와이파이 비밀번호" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        className="w-full text-xs px-3 py-2 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl focus:outline-none focus:border-indigo-500" 
                      />
                    </div>
                  </div>
                </div>

                {/* Copy & Download Buttons */}
                <div className="pt-5 space-y-2">
                  <button 
                    onClick={handleCopyCode}
                    className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-98 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300 ring-4 ring-indigo-50 flex items-center justify-center gap-2 cursor-pointer tracking-tight"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-300 animate-bounce" /> : <Copy className="w-4 h-4 text-indigo-200" />}
                    <span>{copiedCode ? '✓ 아두이노 코드 전체 복사 완료!' : '📋 아두이노 코드 전체 복사 (추천)'}</span>
                  </button>
                  <button 
                    onClick={handleDownloadFirmware}
                    className="w-full py-2 bg-[#FAF9F6] hover:bg-[#EAE6DF] border border-[#EAE6DF] text-[#5C5B57] hover:text-[#1D1D1F] text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-[#86868B]" />
                    <span>맞춤 펌웨어 파일 다운로드 (.ino)</span>
                  </button>
                </div>
              </div>

              {/* 2단계: 로봇 검색 및 페어링 카드 */}
              <div className="bg-gradient-to-b from-white to-emerald-50/40 border-2 border-emerald-300 rounded-3xl p-6 shadow-xl shadow-emerald-500/10 flex flex-col justify-between hover:border-emerald-400 transition-all relative overflow-hidden ring-4 ring-emerald-50">
                {/* Decorative background glow */}
                <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-400/15 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-teal-400/15 rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-black text-emerald-700 bg-emerald-100/90 px-3 py-1 rounded-xl border border-emerald-300 flex items-center gap-1.5 shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <BluetoothSearching className="w-3.5 h-3.5 text-emerald-600" /> 2단계: 페어링
                    </span>
                    <span className="text-[10px] text-emerald-700 font-extrabold bg-white/90 px-2.5 py-0.5 rounded-lg border border-emerald-200 shadow-2xs font-mono">
                      SODABOT_{robotName}
                    </span>
                  </div>

                  {/* Connected / In-Progress Status Banner */}
                  {status === 'connected' ? (
                    <div className="p-3.5 bg-emerald-500/10 border-2 border-emerald-500 rounded-2xl flex items-center justify-between shadow-sm my-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl animate-bounce">🤖</span>
                        <div>
                          <div className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
                            <span>{connectedDeviceName || `SODABOT_${robotName}`}</span>
                            <span className="px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-black rounded-full shadow-xs">
                              연결됨
                            </span>
                          </div>
                          <div className="text-[10px] text-emerald-600 font-medium">소다봇 온라인</div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-xl border border-emerald-200 shadow-2xs">
                        ⚡ LIVE
                      </span>
                    </div>
                  ) : status === 'ble_connecting' || status === 'wifi_connecting' ? (
                    <div className="p-3.5 bg-indigo-50 border-2 border-indigo-300 rounded-2xl flex items-center gap-3 animate-pulse my-2">
                      <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                      <div>
                        <div className="text-xs font-bold text-indigo-900">소다봇 페어링 중...</div>
                        <div className="text-[10px] text-indigo-600">브라우저 팝업에서 소다봇을 선택하세요</div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-white/80 backdrop-blur-xs rounded-2xl border border-emerald-200 flex flex-col items-center justify-center text-center my-2 shadow-2xs">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mb-1.5 shadow-inner">
                        <Bluetooth className="w-5 h-5 text-emerald-600 animate-pulse" />
                      </div>
                      <div className="text-xs font-bold text-emerald-950">SODABOT_{robotName}</div>
                      <div className="text-[10px] text-emerald-600/80">아래 버튼을 눌러 기기를 연결하세요</div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-3 space-y-2.5 relative z-10">
                  <button 
                    onClick={handleDirectBlePair} 
                    disabled={isSearching || status === 'ble_connecting' || status === 'wifi_connecting'}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-600 hover:via-teal-600 hover:to-indigo-700 active:scale-98 text-white text-sm font-black rounded-2xl transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/35 ring-4 ring-emerald-200/90 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 tracking-tight"
                  >
                    {isSearching || status === 'ble_connecting' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>페어링 진행 중...</span>
                      </>
                    ) : (
                      <>
                        <BluetoothSearching className="w-4 h-4 text-yellow-300 animate-pulse" />
                        <span>⚡ 블루투스 페어링 시작</span>
                      </>
                    )}
                  </button>

                  {/* Manual IP Direct Connect Option */}
                  <div className="flex items-center gap-1.5">
                    <input 
                      type="text" 
                      placeholder="소다봇 IP (예: 192.168.0.25)" 
                      value={manualIpInput}
                      onChange={e => setManualIpInput(e.target.value)}
                      className="flex-1 text-[11px] px-3 py-2 bg-white/90 border border-emerald-200 rounded-xl focus:outline-none focus:border-emerald-500 font-mono shadow-2xs"
                    />
                    <button 
                      onClick={() => {
                        if (!manualIpInput.trim()) return alert('IP를 입력해주세요.');
                        connectWebSocket(manualIpInput.trim());
                      }}
                      className="px-3.5 py-2 bg-[#1D1D1F] hover:bg-black text-white text-[11px] font-bold rounded-xl transition-colors cursor-pointer shrink-0 shadow-xs"
                    >
                      IP 직결
                    </button>
                  </div>

                  <button 
                    onClick={() => {
                      setStatus('connected');
                      setStep(4);
                      window.dispatchEvent(new Event("sodabot-status-changed"));
                    }}
                    className="w-full py-1.5 text-[10px] text-[#86868B] hover:text-[#1D1D1F] bg-[#FAF9F6] hover:bg-[#F2EFE9] rounded-lg border border-[#EAE6DF] font-medium transition-colors cursor-pointer"
                  >
                    ⚡ 연결 상태 건너뛰고 제어판 바로 열기
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (Connected Robot Live Preview & Realtime Controls) */}
          <div className="space-y-6">
            
            {/* Live Controller Card */}
            <div className="bg-white border border-[#EAE6DF] rounded-3xl p-6 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#1D1D1F] flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  실시간 하드웨어 피드백
                </h3>
                {status === 'connected' && (
                  <button 
                    onClick={handleDisconnect}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                    title="연결 해제"
                  >
                    <Power className="w-3 h-3 text-rose-600" />
                    연결 해제
                  </button>
                )}
              </div>
              
              <div className="flex flex-col items-center justify-center bg-gradient-to-b from-[#FAF9F6] to-[#F2EFE9] rounded-2xl py-6 mb-4 border border-[#EAE6DF]">
                {status === 'connected' ? (
                  <>
                    <div className="text-6xl mb-3 animate-bounce">🤖</div>
                    <div className="bg-white px-3 py-1 rounded-full border border-[#EAE6DF] text-[11px] font-bold text-emerald-600 flex items-center gap-1.5 shadow-xs mb-1">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                      실시간 동적 연결됨
                    </div>
                    <span className="text-[10px] text-[#86868B] font-mono">{robotIp}</span>
                  </>
                ) : (
                  <>
                    <div className="text-5xl mb-3 opacity-40">🤖💤</div>
                    <div className="text-xs font-bold text-[#86868B] mb-1">소다봇 미연결</div>
                    <p className="text-[10px] text-[#B0ACA5] text-center px-4">
                      좌측 1단계에서 코드를 받아 업로드 후 연결해 주세요.
                    </p>
                  </>
                )}
              </div>

              {/* Realtime Expression 1-Click Test */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-[#1D1D1F] flex items-center justify-between">
                  <span>실시간 동적 표정 전송</span>
                  <span className="text-[10px] text-[#86868B]">100% 벡터 렌더링</span>
                </div>
                
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'happy', emoji: '😆', label: '행복' },
                    { id: 'heart', emoji: '💖', label: '하트' },
                    { id: 'angry', emoji: '😡', label: '화남' },
                    { id: 'sleepy', emoji: '😴', label: '졸림' }
                  ].map(exp => (
                    <button
                      key={exp.id}
                      onClick={() => sendExpression(exp.id)}
                      className="py-2 px-1 rounded-xl bg-[#FAF9F6] hover:bg-indigo-50 hover:border-indigo-200 border border-[#EAE6DF] text-xs transition-all active:scale-95 cursor-pointer flex flex-col items-center gap-0.5"
                    >
                      <span className="text-base">{exp.emoji}</span>
                      <span className="text-[9px] font-bold text-[#1D1D1F]">{exp.label}</span>
                    </button>
                  ))}
                </div>

                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#1D1D1F]">
                      소다봇 화면에 보낼 텍스트
                    </label>
                    <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      스마트 자동 확대 & 중앙 정렬 지원
                    </span>
                  </div>

                  <textarea 
                    value={messageText} 
                    onChange={event => setMessageText(event.target.value)}
                    placeholder="예: 하이요! 반갑습니다." 
                    rows={3}
                    className="w-full rounded-xl border border-[#EAE6DF] p-3 text-sm font-normal focus:outline-none focus:border-indigo-500 bg-[#FAF9F6]" 
                  />

                  {/* 글자 크기 선택 세그먼트 */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-[#5C5B57] flex items-center justify-between">
                      <span>화면 글자 크기</span>
                      <span className="text-[10px] text-[#86868B]">
                        {textSize === 0 ? '길이에 맞춰 최적 크기 자동 계산' : textSize === 3 ? '짧은 단어용 (48×48px)' : textSize === 2 ? '일반 문장용 (32×32px)' : '긴 본문용 (16×16px)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 p-1 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-xs">
                      {[
                        { size: 0, label: '✨ 자동' },
                        { size: 3, label: '3x 초대형' },
                        { size: 2, label: '2x 대형' },
                        { size: 1, label: '1x 기본' }
                      ].map(item => (
                        <button
                          key={item.size}
                          type="button"
                          onClick={() => setTextSize(item.size)}
                          className={`py-1.5 px-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer text-center ${
                            textSize === item.size
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-[#5C5B57] hover:text-[#1D1D1F] hover:bg-white'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    disabled={!messageText.trim()} 
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-xs font-bold text-white transition-all shadow-md shadow-indigo-100 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
                    onClick={() => window.dispatchEvent(new CustomEvent('sodabot-send-command', {
                      detail: { action: 'send_message', value: messageText, size: textSize, label: '텍스트 표시' }
                    }))}
                  >
                    <span>화면에 텍스트 표시하기</span>
                  </button>
                  <p className="text-[10px] text-[#86868B] leading-relaxed">
                    1~6자("하이요" 등)는 화면 중앙에 3배(48px), 일반 문장은 2배(32px)로 또렷하게 표시됩니다.
                  </p>
                </div>

                {/* Sound Test Buttons */}
                <div className="text-xs font-bold text-[#1D1D1F] pt-2">
                  <span>I2S 고음질 사운드 테스트</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => sendSoundTest('greeting')}
                    className="py-2 px-3 bg-[#FAF9F6] hover:bg-purple-50 hover:border-purple-200 border border-[#EAE6DF] rounded-xl text-[11px] font-bold text-[#1D1D1F] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-purple-600" />
                    환영 멜로디
                  </button>
                  <button
                    onClick={() => sendSoundTest('beep')}
                    className="py-2 px-3 bg-[#FAF9F6] hover:bg-amber-50 hover:border-amber-200 border border-[#EAE6DF] rounded-xl text-[11px] font-bold text-[#1D1D1F] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    🔊 BEEP 비프음
                  </button>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
