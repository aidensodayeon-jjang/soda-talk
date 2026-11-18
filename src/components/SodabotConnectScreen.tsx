import { sodabotTransport } from '../utils/sodabotTransport';
import React, { useState, useRef, useEffect } from 'react';
import { 
  Bluetooth, BluetoothSearching, CheckCircle2, Power, RefreshCw,
  Check, Activity, Smile, Download, Copy, Cpu, ArrowRight, ShieldCheck, ChevronDown
} from 'lucide-react';
import { generateSodabotFirmware } from '../utils/sodabotFirmwareGenerator';

const SERVICE_UUID = '6b8a0001-4f2a-4b3c-9d5e-1a2b3c4d5e6f';
const CHAR_WRITE_UUID = '6b8a0002-4f2a-4b3c-9d5e-1a2b3c4d5e6f';
const CHAR_NOTIFY_UUID = '6b8a0003-4f2a-4b3c-9d5e-1a2b3c4d5e6f';

interface SodabotConnectScreenProps {
  onOpenGreetingSettings?: () => void;
  currentUser?: {
    id: string;
    username: string;
    displayName: string;
    role?: string;
    canAccessChat?: boolean;
    personalApiKey?: string;
  } | null;
}

export default function SodabotConnectScreen({ currentUser, onOpenGreetingSettings }: SodabotConnectScreenProps) {
  const userKey = currentUser?.id || currentUser?.username || 'default';
  const getScopedKey = (key: string) => `sodabot_${userKey}_${key}`;

  const [apiKey, setApiKey] = useState<string>(() => {
    if (currentUser?.personalApiKey) return currentUser.personalApiKey;
    const saved = localStorage.getItem(getScopedKey("api_key"));
    if (saved && saved.startsWith("sk-soda-") && !saved.includes("자동발급중")) return saved;
    return "";
  });
  const [copiedKey, setCopiedKey] = useState(false);

  const [, setStepState] = useState<1 | 2 | 3>(() => {
    if (sodabotTransport.type !== 'none') return 3;
    const savedStep = localStorage.getItem(getScopedKey("connect_step"));
    if (savedStep) {
      const parsed = parseInt(savedStep, 10);
      if (parsed >= 1 && parsed <= 3) return parsed as 1 | 2 | 3;
    }
    return 1;
  });

  const setStep = (newStep: 1 | 2 | 3) => {
    setStepState(newStep);
    localStorage.setItem(getScopedKey("connect_step"), String(newStep));
  };

  const [robotName, setRobotName] = useState(() => {
    const saved = localStorage.getItem(getScopedKey("custom_name"));
    return (saved && /^[a-zA-Z0-9_-]+$/.test(saved)) ? saved : '';
  });
  const [ssid, setSsid] = useState(() => localStorage.getItem(getScopedKey("wifi_ssid")) || '');
  const [password, setPassword] = useState(() => localStorage.getItem(getScopedKey("wifi_password")) || '');
  
  const [isSearching, setIsSearching] = useState(false);
  const [foundDevices, setFoundDevices] = useState<{ id: string; name: string; rssi?: number }[]>([]);
  const [connectedDeviceName, setConnectedDeviceName] = useState<string | null>(() => {
    return localStorage.getItem(getScopedKey("device_name"));
  });
  const [status, setStatus] = useState<'idle' | 'ble_connecting' | 'wifi_connecting' | 'connected' | 'error'>(() => {
    if (sodabotTransport.type !== 'none') return 'connected';
    return 'idle';
  });
  const [robotIp, setRobotIp] = useState<string | null>(() => {
    return localStorage.getItem(getScopedKey("robot_ip")) || localStorage.getItem("sodabot_robot_ip");
  });
  const [copiedCode, setCopiedCode] = useState(false);
  const downloadDialog = useRef<HTMLDialogElement>(null);

  const bleDeviceRef = useRef<any>(null);

  useEffect(() => {
    if (currentUser?.personalApiKey) {
      setApiKey(currentUser.personalApiKey);
      localStorage.setItem(getScopedKey("api_key"), currentUser.personalApiKey);
    } else {
      const token = localStorage.getItem("authSessionId") || "";
      fetch("/api/auth/current-key", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
        .then(res => res.json())
        .then(data => {
          if (data?.apiKey) {
            setApiKey(data.apiKey);
            localStorage.setItem(getScopedKey("api_key"), data.apiKey);
          }
        })
        .catch(() => {});
    }

    const savedName = localStorage.getItem(getScopedKey("custom_name")) || '';
    const savedSsid = localStorage.getItem(getScopedKey("wifi_ssid")) || '';
    const savedPass = localStorage.getItem(getScopedKey("wifi_password")) || '';
    const savedIp = localStorage.getItem(getScopedKey("robot_ip")) || localStorage.getItem("sodabot_robot_ip");
    const savedDev = localStorage.getItem(getScopedKey("device_name"));
    const savedStep = localStorage.getItem(getScopedKey("connect_step"));

    setRobotName(savedName);
    setSsid(savedSsid);
    setPassword(savedPass);
    setRobotIp(savedIp);
    setConnectedDeviceName(savedDev);

    if (sodabotTransport.type !== 'none') {
      setStatus('connected');
      setStepState(3);
    } else if (savedIp) {
      // 저장된 IP가 있으면 완료 표시를 복원하지 말고 실제 WebSocket 재연결부터 확인한다.
      setStatus('wifi_connecting');
      setStepState(2);
      void connectWebSocket(savedIp);
    } else {
      setStatus('idle');
      const restoredStep = savedStep ? parseInt(savedStep, 10) : 1;
      setStepState((restoredStep >= 3 ? 2 : Math.max(1, restoredStep)) as 1 | 2);
    }
  }, [currentUser?.id, currentUser?.username]);

  useEffect(() => {
    const update = () => {
      const savedIp = localStorage.getItem(getScopedKey("robot_ip")) || localStorage.getItem("sodabot_robot_ip");
      const connected = sodabotTransport.type !== 'none';
      setStatus(connected ? 'connected' : 'idle');
      setStepState(previousStep => {
        const nextStep: 1 | 2 | 3 = connected ? 3 : (previousStep === 3 ? 2 : previousStep);
        localStorage.setItem(getScopedKey("connect_step"), String(nextStep));
        return nextStep;
      });
      setRobotIp(savedIp);
      setConnectedDeviceName(localStorage.getItem(getScopedKey("device_name")) || localStorage.getItem("sodabot_device_name"));
    };
    update();
    window.addEventListener('sodabot-status-changed', update);
    return () => window.removeEventListener('sodabot-status-changed', update);
  }, [userKey]);

  // 1. Download Custom .ino Firmware file
  const handleDownloadFirmware = () => {
    const cleanName = robotName.replace(/[^a-zA-Z0-9_-]/g, '') || (currentUser?.displayName ? currentUser.displayName.replace(/[^a-zA-Z0-9_-]/g, '') : 'ROBOT');
    localStorage.setItem(getScopedKey("custom_name"), robotName);
    localStorage.setItem(getScopedKey("wifi_ssid"), ssid);
    localStorage.setItem(getScopedKey("wifi_password"), password);

    const activeApiKey = apiKey || currentUser?.personalApiKey || '';
    const host = (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') ? window.location.hostname : '192.168.0.171';
    const code = generateSodabotFirmware(cleanName, ssid, password, activeApiKey, host);
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
    const cleanName = robotName.replace(/[^a-zA-Z0-9_-]/g, '') || (currentUser?.displayName ? currentUser.displayName.replace(/[^a-zA-Z0-9_-]/g, '') : 'ROBOT');
    localStorage.setItem(getScopedKey("custom_name"), robotName);
    localStorage.setItem(getScopedKey("wifi_ssid"), ssid);
    localStorage.setItem(getScopedKey("wifi_password"), password);

    const activeApiKey = apiKey || currentUser?.personalApiKey || '';
    const host = (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') ? window.location.hostname : '192.168.0.171';
    const code = generateSodabotFirmware(cleanName, ssid, password, activeApiKey, host);
    await navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyApiKey = async () => {
    const activeApiKey = apiKey || currentUser?.personalApiKey || '';
    if (!activeApiKey) return;
    await navigator.clipboard.writeText(activeApiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const writeCharRef = useRef<any>(null);

  // 3. Web Bluetooth Direct One-Click Pairing (자동 캐시 초기화 포함)
  const handleDirectBlePair = async () => {
    if (!(navigator as any).bluetooth) {
      alert("블루투스를 지원하지 않는 브라우저이거나, 안전하지 않은 주소입니다. Chrome 브라우저에서 'localhost:7989'로 접속해 주세요.");
      return;
    }
    
    // Keep requestDevice in the click gesture; do not revoke saved device permissions.
    localStorage.removeItem(getScopedKey("robot_ip"));
    localStorage.removeItem(getScopedKey("device_name"));
    localStorage.removeItem("sodabot_robot_ip");
    localStorage.removeItem("sodabot_connected");
    localStorage.removeItem("sodabot_device_name");

    writeCharRef.current = null;
    bleDeviceRef.current = null;
    setRobotIp(null);
    setConnectedDeviceName(null);

    setIsSearching(true);
    setStatus('ble_connecting');
    try {
      const cleanName = robotName.replace(/[^a-zA-Z0-9_-]/g, '') || 'LUMI';
      const targetBleName = `SODABOT_${cleanName}`;
      
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [SERVICE_UUID]
      });
      
      sodabotTransport.disconnect();
      bleDeviceRef.current = device;
      setFoundDevices([{
        id: device.id,
        name: device.name || targetBleName,
        rssi: -45
      }]);

      if (device.name) {
        localStorage.setItem(getScopedKey("device_name"), device.name);
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
      localStorage.setItem(getScopedKey("robot_ip"), ip);
      setRobotIp(ip); 
      setStatus('connected'); 
      setStep(3);
    } catch (error: any) {
      setStatus(sodabotTransport.type === 'none' ? 'error' : 'connected');
      console.error(error);
      if (sodabotTransport.type === 'none') alert(error.message);
    }
  };

  const handleDisconnect = () => {
    if (confirm("소다봇 연결을 해제하시겠습니까?")) {
      localStorage.removeItem(getScopedKey("robot_ip"));
      localStorage.removeItem(getScopedKey("device_name"));
      localStorage.removeItem(getScopedKey("connect_step"));
      localStorage.removeItem("sodabot_robot_ip");
      localStorage.removeItem("sodabot_connected");
      sodabotTransport.disconnect();
      writeCharRef.current = null;
      bleDeviceRef.current = null;
      setRobotIp(null);
      setConnectedDeviceName(null);
      setStatus('idle');
      setStep(1);
      window.dispatchEvent(new Event("sodabot-status-changed"));
    }
  };

  // Real-time Dynamic Expression Testing
  const sendExpression = (expr: string) => {
    if (status !== 'connected') return;
    window.dispatchEvent(new CustomEvent("sodabot-send-command", {
      detail: { action: "set_expression", value: expr, label: `${expr} 표정 전송` }
    }));
  };

  const connected = status === 'connected';
  const connecting = isSearching || status === 'ble_connecting' || status === 'wifi_connecting';
  const statusLabel = connected ? '연결 완료' : connecting ? '연결 중' : '연결 전';

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 p-4 sm:p-8 overflow-y-auto font-sans">
      <div className="max-w-5xl mx-auto w-full space-y-6 pb-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">내 소다봇</h1>
          <p className="text-sm text-slate-500 mt-2">평소 수업에서는 연결하기만 누르면 돼요. 처음 만들 때는 아래 처음 설정하기를 열어주세요.</p>
        </header>

        <section aria-labelledby="connect-title" className="bg-white border border-indigo-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-indigo-600">평소 수업에서 사용</span>
              <h2 id="connect-title" className="text-2xl font-bold text-slate-900 mt-2">소다봇 연결하기</h2>
              <p className="text-sm text-slate-500 mt-2">내 소다봇을 연결하고 표정과 기능을 실행해 보세요.</p>
            </div>
            <span role="status" aria-live="polite" className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold border ${connected ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : connecting ? 'text-indigo-700 bg-indigo-50 border-indigo-200' : 'text-slate-600 bg-slate-100 border-slate-200'}`}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : connecting ? 'bg-indigo-500 animate-pulse' : 'bg-slate-400'}`} />{statusLabel}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="p-6 sm:p-8 flex flex-col items-center justify-center text-center gap-5 md:border-r border-slate-100">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center ${connected ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                {connected ? <CheckCircle2 size={40} /> : <Bluetooth size={40} />}
              </div>
              {connected ? <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 break-all">{connectedDeviceName || robotName || '소다봇'}</h3>
                <p className="text-sm text-emerald-700">소다봇이 연결됐어요! 표정을 눌러보세요.</p>
                <p className="text-xs text-slate-500">{robotIp || '블루투스로 연결됨'}</p>
                <button onClick={handleDisconnect} className="mt-2 px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2 mx-auto"><Power size={16} />연결 해제</button>
              </div> : <>
                <button onClick={handleDirectBlePair} disabled={connecting} className="w-full max-w-xs min-h-16 px-6 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold flex items-center justify-center gap-3 transition-colors disabled:opacity-60 disabled:cursor-wait focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600">
                  {connecting ? <RefreshCw size={23} className="animate-spin" /> : <BluetoothSearching size={23} />}
                  {connecting ? '소다봇 연결 중…' : '소다봇 연결하기'}
                </button>
                <p className="text-sm text-slate-500 max-w-xs">{connecting ? '소다봇과 연결을 확인하고 있어요.' : '소다봇 전원을 켠 뒤, 목록에서 내 소다봇을 선택하세요.'}</p>
                {status === 'error' && <p role="alert" className="text-sm text-rose-600">연결을 확인하지 못했어요. 소다봇 전원을 확인하고 다시 연결해 주세요.</p>}
              </>}
            </div>
            <div className="p-6 sm:p-8 bg-slate-50/60 border-t md:border-t-0 border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Smile size={21} className="text-indigo-600" />소다봇 표정 바꾸기</h3>
              <p id="expression-help" className="text-sm text-slate-500 mt-2 mb-5">{connected ? '표정을 누르면 소다봇 LCD 화면에 바로 나타나요.' : '소다봇을 연결하면 표정 버튼을 사용할 수 있어요.'}</p>
              <div className="grid grid-cols-3 gap-3" aria-describedby="expression-help">
                {[
                  { id: 'happy', emoji: '😆', label: '행복' },
                  { id: 'heart', emoji: '💖', label: '하트' },
                  { id: 'wink', emoji: '😉', label: '윙크' },
                  { id: 'surprised', emoji: '😲', label: '놀람' },
                  { id: 'angry', emoji: '😡', label: '화남' },
                  { id: 'sleepy', emoji: '😴', label: '졸림' }
                ].map(exp => <button key={exp.id} disabled={!connected} onClick={() => sendExpression(exp.id)} className="min-h-20 p-3 rounded-2xl bg-white border border-slate-200 text-slate-800 hover:bg-indigo-50 hover:border-indigo-300 transition-colors flex flex-col items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-slate-200 focus-visible:outline-2 focus-visible:outline-indigo-600"><span className="text-2xl" aria-hidden="true">{exp.emoji}</span><span className="text-sm font-bold">{exp.label}</span></button>)}
              </div>
              <div className="flex items-center gap-2 mt-5 text-xs text-slate-500"><Activity size={15} /><span>{connected ? '실시간 하드웨어 연결이 활성화되어 있어요.' : '연결 후 소다봇 화면에서 반응을 확인해 보세요.'}</span></div>
            </div>
          </div>
          <details className="mx-6 sm:mx-8 mb-6 rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
            <summary className="cursor-pointer font-bold">연결 목록에 소다봇이 안 보이나요?</summary>
            <div className="mt-3 space-y-2 leading-relaxed">
              <p>Chrome을 완전히 종료한 뒤 다시 실행하고 연결을 시도하세요. Mac에서는 ⌘Q, Windows에서는 Chrome 메뉴 → 종료를 사용하세요.</p>
              <p>Mac에서는 시스템 설정 → 개인정보 보호 및 보안 → Bluetooth에서 Google Chrome의 접근 권한도 확인하세요.</p>
              <p>소다봇 전원을 확인하고 RESET 버튼을 한 번 누른 뒤 SODABOT_으로 시작하는 기기를 찾아보세요. 목록이 비었다고 프로그램을 다시 설치할 필요는 없어요.</p>
            </div>
          </details>
        </section>

        <details className="group bg-white border border-slate-200 rounded-2xl" >
          <summary className="cursor-pointer p-5 sm:p-6 flex items-center justify-between gap-4 list-none [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-indigo-600 rounded-2xl">
            <div><span className="text-xs font-semibold text-slate-500">처음 제작할 때 사용</span><h2 className="text-lg font-bold text-slate-800 mt-1 flex items-center gap-2"><Cpu size={19} className="text-indigo-500" />소다봇 처음 설정하기</h2><p className="text-sm text-slate-500 mt-2">소다봇을 처음 만들거나 다시 설치할 때만 사용합니다.</p><p className="text-sm font-semibold text-indigo-600 mt-1">선생님의 안내에 따라 진행하세요.</p></div>
            <ChevronDown size={22} className="shrink-0 text-slate-400 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="p-5 sm:p-6 border-t border-slate-100">
            <div className="max-w-2xl mx-auto space-y-5">
              {/* 고유 API 키 조회 및 복사 */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-indigo-100 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black text-indigo-950">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>고유 SODA API 키</span>
                  </div>
                  <button 
                    onClick={handleCopyApiKey}
                    className="px-2 py-0.5 bg-white hover:bg-indigo-50 text-[10px] font-bold text-indigo-600 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                    title="API 키 복사"
                  >
                    {copiedKey ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-indigo-500" />}
                    {copiedKey ? '복사완료' : '키 복사'}
                  </button>
                </div>
                
                <div className="font-mono text-[11px] text-indigo-950 font-black bg-white/95 px-3 py-1.5 rounded-xl border border-indigo-200 select-all truncate tracking-tight shadow-inner">
                  {apiKey || currentUser?.personalApiKey || "발급된 키 없음"}
                </div>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label htmlFor="setup-robot-name" className="text-[11px] font-bold text-[#1D1D1F] block mb-1">로봇 이름</label>
                  <input id="setup-robot-name"
                    type="text" 
                    placeholder="예: lumi, SODA_01" 
                    value={robotName} 
                    onChange={e => {
                      const sanitized = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '');
                      setRobotName(sanitized);
                    }} 
                    className="w-full text-xs px-3 py-2 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl focus:outline-none focus:border-indigo-500 font-bold font-mono" 
                  />
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[#86868B]">
                    코드 다운로드·업로드 후 적용됩니다.
                    {status === 'connected' && connectedDeviceName && (
                      <span className="block">최근 페어링 이름: {connectedDeviceName}</span>
                    )}
                  </p>
                </div>
                <div>
                  <label htmlFor="setup-wifi-ssid" className="text-[11px] font-bold text-[#1D1D1F] block mb-1">Wi-Fi 이름 (SSID)</label>
                  <input id="setup-wifi-ssid"
                    type="text" 
                    placeholder="예: MyHome_WiFi (2.4G)" 
                    value={ssid} 
                    onChange={e => setSsid(e.target.value)} 
                    className="w-full text-xs px-3 py-2 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl focus:outline-none focus:border-indigo-500" 
                  />
                </div>
                <div>
                  <label htmlFor="setup-wifi-password" className="text-[11px] font-bold text-[#1D1D1F] block mb-1">Wi-Fi 비밀번호</label>
                  <input id="setup-wifi-password"
                    type="password" 
                    placeholder="와이파이 비밀번호" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className="w-full text-xs px-3 py-2 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl focus:outline-none focus:border-indigo-500" 
                  />
                </div>
              </div>

            {/* Copy & Download Buttons */}
            <div className="pt-4 space-y-2">
              <button 
                onClick={handleCopyCode}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300 ring-4 ring-indigo-50 flex items-center justify-center gap-2 cursor-pointer tracking-tight"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-300 animate-bounce" /> : <Copy className="w-4 h-4 text-indigo-200" />}
                <span>{copiedCode ? '✓ 아두이노 코드 전체 복사 완료!' : '맞춤 코드 복사'}</span>
              </button>
              <button 
                onClick={() => downloadDialog.current?.showModal()}
                className="w-full py-2.5 bg-[#FAF9F6] hover:bg-[#EAE6DF] border border-[#EAE6DF] text-[#5C5B57] hover:text-[#1D1D1F] text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-[#86868B]" />
                <span>맞춤 펌웨어 파일 다운로드 (.ino)</span>
              </button>
              <details className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                <summary className="cursor-pointer font-bold">예전 인사말이나 설정이 남아 있나요?</summary>
                <div className="mt-2 space-y-2 leading-relaxed">
                  <p>Arduino IDE의 도구 → Erase All Flash Before Sketch Upload → Enabled로 설정한 뒤, 새로 다운로드한 맞춤 코드를 업로드하세요.</p>
                  <p>기존 프로그램과 저장된 Wi-Fi·API 키·인사말 등 모든 설정이 삭제됩니다. 새 코드에 포함된 정보는 다시 적용되며, 그 밖의 설정은 다시 지정해야 합니다.</p>
                  <p className="font-bold">초기화 업로드가 끝나면 Disabled로 돌려놓으세요.</p>
                </div>
              </details>
            </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                <h3 className="text-sm font-bold text-slate-800">예제 인사말 설정</h3>
                <p className="text-sm text-slate-500">로봇 설정에서 인사말과 시작할 때의 표정·소리를 바꿀 수 있어요.</p>
                <button type="button" onClick={onOpenGreetingSettings} className="text-sm font-bold text-indigo-600 hover:underline">인사말 설정 열기 <ArrowRight size={15} className="inline" /></button>
              </div>
            </div>
          </div>
        </details>
        <dialog ref={downloadDialog} aria-labelledby="download-title" aria-describedby="download-description" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl p-6 sm:p-8 shadow-xl backdrop:bg-slate-900/40">
          <h2 id="download-title" className="text-xl font-bold text-slate-900">소다봇 프로그램을 다시 설치할까요?</h2>
          <p id="download-description" className="text-sm leading-relaxed text-slate-600 mt-4">이미 소다봇을 사용하고 있다면 다시 설치할 필요가 없습니다. 선생님의 안내를 받은 경우에만 진행하세요.</p>
          <div className="flex justify-end gap-3 mt-6">
            <button autoFocus onClick={() => downloadDialog.current?.close()} className="px-5 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">취소</button>
            <button onClick={() => { downloadDialog.current?.close(); handleDownloadFirmware(); }} className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-bold text-white">계속 진행</button>
          </div>
        </dialog>
      </div>
    </div>
  );
}
