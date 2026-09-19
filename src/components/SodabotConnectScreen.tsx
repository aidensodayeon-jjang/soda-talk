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

  const [step, setStepState] = useState<1 | 2 | 3>(() => {
    if (sodabotTransport.type !== 'none') return 3;
    const savedStep = localStorage.getItem("sodabot_connect_step");
    if (savedStep) {
      const parsed = parseInt(savedStep, 10);
      if (parsed >= 1 && parsed <= 3) return parsed as 1 | 2 | 3;
    }
    return 1;
  });

  const setStep = (newStep: 1 | 2 | 3) => {
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

  const bleDeviceRef = useRef<any>(null);

  useEffect(() => {
    const update = () => {
      const connected = sodabotTransport.type !== 'none';
      setStatus(connected ? 'connected' : 'idle');
      if (connected) setStep(3);
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
      setStep(3);

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
      setRobotIp(ip); setStatus('connected'); setStep(3);
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
              <span>온라인 ({robotIp || 'BLE'})</span>
            </div>
          )}
        </div>

        {/* Stepper (3단계까지 표시) */}
        <div className="flex items-center justify-between relative px-10 max-w-4xl mx-auto">
          <div className="absolute left-16 right-16 top-5 h-[1px] bg-[#EAE6DF] -z-10"></div>
          {[
            { num: 1, label: '1단계: 맞춤 코드 생성 & 다운로드', icon: Cpu },
            { num: 2, label: '2단계: 아두이노 업로드 & 로봇 찾기', icon: BluetoothSearching },
            { num: 3, label: '3단계: 연결 및 상태 확인', icon: Wifi }
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

              {/* 2단계: 로봇 검색 및 페어링 카드 (대형 원형 ON/OFF 버튼 중심) */}
              <div className={`rounded-3xl p-6 shadow-xl flex flex-col justify-between transition-all relative overflow-hidden ring-4 ${
                status === 'connected' 
                  ? 'bg-gradient-to-b from-white to-emerald-50/70 border-2 border-emerald-400 ring-emerald-50' 
                  : 'bg-gradient-to-b from-white to-slate-50/60 border-2 border-slate-200 ring-slate-100 hover:border-emerald-300'
              }`}>
                {/* Decorative background glow */}
                <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full blur-2xl pointer-events-none transition-colors ${
                  status === 'connected' ? 'bg-emerald-400/20' : 'bg-indigo-400/10'
                }`} />
                <div className={`absolute -bottom-10 -left-10 w-36 h-36 rounded-full blur-2xl pointer-events-none transition-colors ${
                  status === 'connected' ? 'bg-teal-400/20' : 'bg-blue-400/10'
                }`} />

                <div className="relative z-10 flex flex-col h-full justify-between">
                  
                  {/* Card Header & Status Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-[11px] font-black px-3 py-1 rounded-xl border flex items-center gap-1.5 shadow-xs transition-colors ${
                      status === 'connected'
                        ? 'text-emerald-700 bg-emerald-100 border-emerald-300'
                        : 'text-slate-700 bg-slate-100 border-slate-200'
                    }`}>
                      <BluetoothSearching className={`w-3.5 h-3.5 ${status === 'connected' ? 'text-emerald-600' : 'text-slate-500'}`} />
                      2단계: 페어링
                    </span>
                    
                    {/* ON / OFF Indicator Badge */}
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide border flex items-center gap-1.5 shadow-2xs ${
                        status === 'connected'
                          ? 'bg-emerald-500 text-white border-emerald-600'
                          : 'bg-slate-200 text-slate-600 border-slate-300'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
                        {status === 'connected' ? 'ON (연결됨)' : 'OFF (대기중)'}
                      </span>
                    </div>
                  </div>

                  {/* Robot Device Label */}
                  <div className="text-center my-1">
                    <div className="text-sm font-black text-[#1D1D1F] tracking-wide font-mono">
                      SODABOT_{robotName}
                    </div>
                    <div className="text-[11px] text-[#86868B] mt-0.5">
                      {status === 'connected' ? '소다봇과 실시간 동적 페어링 완료' : '원형 버튼을 눌러 블루투스 페어링을 시작하세요'}
                    </div>
                  </div>

                  {/* Big Circular ON/OFF Button Area */}
                  <div className="my-6 flex flex-col items-center justify-center">
                    {status === 'connected' ? (
                      /* Connected ON State: Large Green Circular Pulse Button */
                      <button
                        onClick={handleDisconnect}
                        className="group relative w-36 h-36 rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 text-white flex flex-col items-center justify-center shadow-2xl shadow-emerald-500/40 ring-8 ring-emerald-100 hover:ring-rose-100 hover:from-rose-500 hover:to-red-600 transition-all cursor-pointer active:scale-95"
                        title="클릭 시 연결 해제 (OFF)"
                      >
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-1 group-hover:bg-white/30 transition-all">
                          <Power className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                        </div>
                        <span className="text-xs font-black tracking-wide group-hover:hidden">연결 완료</span>
                        <span className="text-[10px] font-bold text-emerald-100 group-hover:hidden">ON (클릭시 해제)</span>
                        <span className="text-xs font-black tracking-wide hidden group-hover:inline">연결 해제</span>
                        <span className="text-[10px] font-bold text-rose-100 hidden group-hover:inline">OFF 전환</span>
                      </button>
                    ) : isSearching || status === 'ble_connecting' || status === 'wifi_connecting' ? (
                      /* Connecting State: Large Spinner Circle */
                      <div className="w-36 h-36 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 text-white flex flex-col items-center justify-center shadow-2xl shadow-indigo-500/30 ring-8 ring-indigo-100 animate-pulse">
                        <RefreshCw className="w-8 h-8 text-white animate-spin mb-1.5" />
                        <span className="text-xs font-black tracking-wide">페어링 진행 중</span>
                        <span className="text-[10px] text-indigo-100 font-medium">기기 탐색 중...</span>
                      </div>
                    ) : (
                      /* Disconnected OFF State: Large Standby Circular Action Button */
                      <button
                        onClick={handleDirectBlePair}
                        className="group relative w-36 h-36 rounded-full bg-gradient-to-br from-indigo-600 via-indigo-600 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white flex flex-col items-center justify-center shadow-xl shadow-indigo-500/25 hover:shadow-emerald-500/35 ring-8 ring-indigo-50 hover:ring-emerald-100 transition-all cursor-pointer active:scale-95"
                        title="소다봇 블루투스 페어링 시작 (ON)"
                      >
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-1 group-hover:bg-white/30 group-hover:scale-110 transition-all">
                          <Bluetooth className="w-7 h-7 text-white" />
                        </div>
                        <span className="text-xs font-black tracking-wide">페어링 시작</span>
                        <span className="text-[10px] font-bold text-indigo-100 group-hover:text-emerald-100">TOUCH (ON)</span>
                      </button>
                    )}
                  </div>

                  {/* Bottom Connection State Message */}
                  <div className="pt-2 text-center">
                    <span className={`inline-block text-[11px] font-bold px-3 py-1 rounded-full ${
                      status === 'connected'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {status === 'connected'
                        ? `🤖 ${connectedDeviceName || `SODABOT_${robotName}`} 연결됨 (${robotIp || 'BLE'})`
                        : '🔘 원형 버튼을 클릭하여 블루투스 연결을 활성화하세요'}
                    </span>
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* Right Column (실시간 하드웨어 피드백: 연결 상태 + 간단한 표정 확인만 유지) */}
          <div className="space-y-6">
            
            <div className="bg-white border border-[#EAE6DF] rounded-3xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between h-full">
              <div>
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
                
                {/* Connection Status Box */}
                <div className="flex flex-col items-center justify-center bg-gradient-to-b from-[#FAF9F6] to-[#F2EFE9] rounded-2xl py-6 mb-5 border border-[#EAE6DF]">
                  {status === 'connected' ? (
                    <>
                      <div className="text-6xl mb-3 animate-bounce">🤖</div>
                      <div className="bg-white px-3 py-1 rounded-full border border-[#EAE6DF] text-[11px] font-bold text-emerald-600 flex items-center gap-1.5 shadow-xs mb-1">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                        실시간 동적 연결됨
                      </div>
                      <span className="text-[10px] text-[#86868B] font-mono">{robotIp || connectedDeviceName || 'BLE 직결'}</span>
                    </>
                  ) : (
                    <>
                      <div className="text-5xl mb-3 opacity-40">🤖💤</div>
                      <div className="text-xs font-bold text-[#86868B] mb-1">소다봇 미연결</div>
                      <p className="text-[10px] text-[#B0ACA5] text-center px-4">
                        좌측 2단계에서 원형 버튼을 눌러 소다봇을 연결해 주세요.
                      </p>
                    </>
                  )}
                </div>

                {/* Simple Expression Test Only */}
                <div className="space-y-3">
                  <div className="text-xs font-bold text-[#1D1D1F] flex items-center justify-between">
                    <span>간단한 표정 확인</span>
                    <span className="text-[10px] text-[#86868B]">100% 벡터 렌더링</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'happy', emoji: '😆', label: '행복' },
                      { id: 'heart', emoji: '💖', label: '하트' },
                      { id: 'wink', emoji: '😉', label: '윙크' },
                      { id: 'surprised', emoji: '😲', label: '놀람' },
                      { id: 'angry', emoji: '😡', label: '화남' },
                      { id: 'sleepy', emoji: '😴', label: '졸림' }
                    ].map(exp => (
                      <button
                        key={exp.id}
                        onClick={() => sendExpression(exp.id)}
                        className="py-3 px-2 rounded-2xl bg-[#FAF9F6] hover:bg-indigo-50 hover:border-indigo-200 border border-[#EAE6DF] text-xs transition-all active:scale-95 cursor-pointer flex flex-col items-center gap-1 shadow-2xs hover:shadow-xs"
                      >
                        <span className="text-xl">{exp.emoji}</span>
                        <span className="text-[10px] font-bold text-[#1D1D1F]">{exp.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Help note */}
              <div className="pt-4 border-t border-[#EAE6DF] mt-4 text-center">
                <p className="text-[10px] text-[#86868B]">
                  💡 표정 버튼을 누르면 연결된 소다봇 LCD 화면에 즉시 표시됩니다.
                </p>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
