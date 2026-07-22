import React, { useState, useRef, useEffect } from 'react';
import { Bluetooth, BluetoothSearching, CheckCircle2, Wifi, Power, RefreshCw, Smartphone, Check, SmartphoneNfc, RotateCcw, PenSquare, Activity, Smile, Volume2, Lightbulb } from 'lucide-react';

const SERVICE_UUID = '6b8a0001-4f2a-4b3c-9d5e-1a2b3c4d5e6f';
const CHAR_WRITE_UUID = '6b8a0002-4f2a-4b3c-9d5e-1a2b3c4d5e6f';
const CHAR_NOTIFY_UUID = '6b8a0003-4f2a-4b3c-9d5e-1a2b3c4d5e6f';

export default function SodabotConnectScreen() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSearching, setIsSearching] = useState(false);
  const [foundDevices, setFoundDevices] = useState<{ id: string; name: string; rssi?: number }[]>([]);
  const [connectedDeviceName, setConnectedDeviceName] = useState<string | null>(null);
  
  const [ssid, setSsid] = useState(localStorage.getItem("sodabot_wifi_ssid") || '');
  const [password, setPassword] = useState(localStorage.getItem("sodabot_wifi_password") || '');
  const [status, setStatus] = useState<'idle' | 'ble_connecting' | 'wifi_connecting' | 'connected' | 'error'>('idle');
  const [robotIp, setRobotIp] = useState<string | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number>(76);

  const bleDeviceRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const expressionTimeoutRef = useRef<any>(null);
  const [showExpressions, setShowExpressions] = useState(false);

  useEffect(() => {
    const savedIp = localStorage.getItem("sodabot_robot_ip");
    if (savedIp) {
      setRobotIp(savedIp);
      setStep(4);
      setStatus('wifi_connecting');
      connectWebSocket(savedIp);
    }
  }, []);

  const EXPRESSIONS = [
    {id: 'default', label: '기본', emoji: '🤖', color: '#FAF9F6', textColor: '#1D1D1F'},
    {id: 'happy', label: '행복', emoji: '😆', color: '#FEF3C7', textColor: '#D97706'},
    {id: 'angry', label: '화남', emoji: '😡', color: '#FEE2E2', textColor: '#DC2626'},
    {id: 'heart', label: '러블리 하트', emoji: '💖✨', color: '#FCE7F3', textColor: '#EC4899'},
    {id: 'sleepy', label: '졸림', emoji: '😴', color: '#E0E7FF', textColor: '#4F46E5'},
    {id: 'surprised', label: '놀람', emoji: '😲', color: '#E0F2FE', textColor: '#0284C7'},
    {id: 'cat', label: '고양이', emoji: '🐱', color: '#FEF08A', textColor: '#CA8A04'},
  ];

  const handleSearchBle = async () => {
    if (!(navigator as any).bluetooth) {
      alert("블루투스를 지원하지 않는 브라우저이거나, 안전하지 않은 주소(0.0.0.0)로 접속하셨습니다. 주소창에 'localhost:7989'를 입력하여 접속해 주세요.");
      return;
    }
    
    setIsSearching(true);
    setFoundDevices([]);
    try {
      // For Web Bluetooth, we just request the device and the browser shows a popup.
      // So we can't truly "search in background" and show custom list unless we use requestLEScan,
      // which is experimental. We'll use requestDevice which handles the UI, then pretend it's in our list.
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [SERVICE_UUID]
      });
      
      setFoundDevices([{
        id: device.id,
        name: device.name || 'SODABOT-UNKNOWN',
        rssi: -45 // Mock RSSI
      }]);
      bleDeviceRef.current = device;
      setStep(2);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleConnectDevice = async (deviceId: string) => {
    const device = bleDeviceRef.current;
    if (!device) return;

    setStep(3);
    setStatus('ble_connecting');
    try {
      device.addEventListener('gattserverdisconnected', () => {
        setStatus('error');
      });

      setConnectedDeviceName(device.name);
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      
      const writeChar = await service.getCharacteristic(CHAR_WRITE_UUID);
      const notifyChar = await service.getCharacteristic(CHAR_NOTIFY_UUID);

      await notifyChar.startNotifications();
      notifyChar.addEventListener('characteristicvaluechanged', (event: any) => {
        try {
          const value = event.target.value;
          const decoder = new TextDecoder();
          const jsonStr = decoder.decode(value);
          const data = JSON.parse(jsonStr);

          if (data.state === 'success' && data.ip) {
            setRobotIp(data.ip);
            if (bleDeviceRef.current && bleDeviceRef.current.gatt.connected) {
              bleDeviceRef.current.gatt.disconnect();
            }
            connectWebSocket(data.ip);
          } else {
            setStatus('error');
          }
        } catch (err: any) {
          console.error(err);
        }
      });

      if (!ssid) {
        alert("와이파이 이름(SSID)을 입력해주세요.");
        setStatus('error');
        return;
      }

      localStorage.setItem("sodabot_wifi_ssid", ssid);
      localStorage.setItem("sodabot_wifi_password", password);

      const wifiJson = JSON.stringify({ ssid, password });
      const encoder = new TextEncoder();
      const dataArray = encoder.encode(wifiJson);

      await writeChar.writeValue(dataArray);
      setStatus('wifi_connecting');

    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  };

  const connectWebSocket = (ip: string) => {
    localStorage.setItem("sodabot_robot_ip", ip);
    const wsUrl = `ws://${ip}:8080/soda/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      setStep(4);
    };

    ws.onclose = () => {
      setStatus('error');
      wsRef.current = null;
    };

    ws.onerror = () => {
      setStatus('error');
    };
  };

  const sendExpression = (expr: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert('로봇과 연결되어 있지 않습니다.');
      return;
    }

    if (expressionTimeoutRef.current) {
      clearTimeout(expressionTimeoutRef.current);
    }

    const payload = {
      type: "command",
      action: "set_expression",
      value: expr
    };
    wsRef.current.send(JSON.stringify(payload));

    if (expr !== 'sleepy') {
      expressionTimeoutRef.current = setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "command",
            action: "set_expression",
            value: "sleepy"
          }));
        }
      }, 3000);
    }
  };



  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF9F6] p-8 overflow-y-auto font-sans">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-[#1D1D1F]">소다봇 연결</h2>
          <p className="text-[#86868B] text-sm mt-1">소다봇을 연결하고 상태를 확인하세요.</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between relative px-10">
          <div className="absolute left-10 right-10 top-5 h-[1px] bg-[#EAE6DF] -z-10"></div>
          {[
            { num: 1, label: '1. 전원 켜기', icon: Power },
            { num: 2, label: '2. 블루투스 찾기', icon: BluetoothSearching },
            { num: 3, label: '3. 연결하기', icon: Wifi },
            { num: 4, label: '4. 연결 완료', icon: CheckCircle2 }
          ].map((s) => {
            const isActive = step === s.num;
            const isPassed = step > s.num;
            return (
              <div key={s.num} className="flex flex-col items-center gap-3 bg-[#FAF9F6] px-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm
                  ${isActive ? 'bg-indigo-600 text-white shadow-indigo-200' : 
                    isPassed ? 'bg-emerald-500 text-white' : 'bg-white border border-[#EAE6DF] text-[#B0ACA5]'}`}>
                  {isPassed ? <Check className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                </div>
                <span className={`text-xs font-semibold ${isActive ? 'text-indigo-600' : isPassed ? 'text-[#1D1D1F]' : 'text-[#B0ACA5]'}`}>
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
          
          {/* Left Column (Discovery) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* 블루투스 소다봇 찾기 */}
              <div className="bg-white border border-[#EAE6DF] rounded-3xl p-8 flex flex-col items-center text-center shadow-sm">
                <h3 className="text-base font-bold text-[#1D1D1F] w-full text-left mb-1">블루투스 소다봇 찾기</h3>
                <p className="text-xs text-[#86868B] w-full text-left mb-8">주변의 소다봇을 검색 중입니다...</p>
                
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-30"></div>
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center relative z-10 border border-emerald-100">
                    <Bluetooth className="w-8 h-8 text-emerald-600" />
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4 w-full mt-auto">
                  {isSearching ? (
                    <>
                      <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
                      <span className="text-xs font-semibold text-[#5C5B57]">검색 중... 8초</span>
                      <button onClick={() => setIsSearching(false)} className="px-6 py-2.5 bg-white border border-[#EAE6DF] hover:bg-[#FAF9F6] text-[#1D1D1F] text-xs font-bold rounded-xl transition-colors shadow-sm w-full">
                        검색 중지
                      </button>
                    </>
                  ) : (
                    <button onClick={handleSearchBle} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm w-full">
                      블루투스 기기 찾기
                    </button>
                  )}
                </div>
              </div>

              {/* Wi-Fi 및 발견된 기기 */}
              <div className="bg-white border border-[#EAE6DF] rounded-3xl p-6 shadow-sm flex flex-col">
                <h3 className="text-base font-bold text-[#1D1D1F] mb-1">Wi-Fi 설정</h3>
                <p className="text-[10px] text-[#86868B] mb-3">소다봇이 연결할 와이파이를 입력하세요.</p>
                <div className="space-y-2 mb-6">
                  <input type="text" placeholder="와이파이 이름 (SSID)" value={ssid} onChange={e => setSsid(e.target.value)} className="w-full text-xs px-3 py-2 border border-[#EAE6DF] rounded-xl focus:outline-none focus:border-indigo-500" />
                  <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} className="w-full text-xs px-3 py-2 border border-[#EAE6DF] rounded-xl focus:outline-none focus:border-indigo-500" />
                </div>

                <h3 className="text-base font-bold text-[#1D1D1F] mb-1">발견된 기기</h3>
                <p className="text-[10px] text-[#86868B] mb-3">연결할 소다봇을 선택하세요.</p>
                
                <div className="flex-1 overflow-y-auto space-y-3 min-h-[120px]">
                  {foundDevices.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-[#B0ACA5] italic">
                      기기를 검색해주세요.
                    </div>
                  ) : (
                    foundDevices.map(d => (
                      <div key={d.id} className="p-3 border-2 border-emerald-400 bg-emerald-50/30 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-emerald-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-xl border border-emerald-100 flex items-center justify-center">
                            <span className="text-xl">🤖</span>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-[#1D1D1F]">{d.name}</div>
                            <div className="text-[10px] text-[#86868B] mt-0.5">신호 강도: 양호</div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleConnectDevice(d.id)}
                          disabled={status === 'ble_connecting' || status === 'wifi_connecting'}
                          className="px-4 py-1.5 bg-white border border-emerald-500 text-emerald-600 text-xs font-bold rounded-lg hover:bg-emerald-500 hover:text-white transition-colors disabled:opacity-50"
                        >
                          {status === 'ble_connecting' ? 'BLE 연결중...' : status === 'wifi_connecting' ? 'WiFi 연결중...' : '연결'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>



          </div>

          {/* Right Column (Connected Device & Info) */}
          <div className="space-y-6">
            
            {/* Connected Device */}
            <div className="bg-white border border-[#EAE6DF] rounded-3xl p-6 shadow-sm relative overflow-hidden">
              <button className="absolute top-4 right-4 p-2 bg-[#FAF9F6] hover:bg-[#EAE6DF] rounded-lg transition-colors">
                <PenSquare className="w-4 h-4 text-[#86868B]" />
              </button>
              
              <h3 className="text-base font-bold text-[#1D1D1F] mb-4">연결된 소다봇</h3>
              
              <div className="flex flex-col items-center justify-center bg-[#FAF9F6] rounded-2xl py-8 mb-4 border border-[#EAE6DF]">
                {status === 'connected' ? (
                  <>
                    <div className="text-6xl mb-4 animate-bounce">🤖</div>
                    <div className="bg-white px-3 py-1 rounded-full border border-[#EAE6DF] text-[10px] font-bold text-emerald-600 flex items-center gap-1.5 shadow-sm">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      연결됨
                    </div>
                  </>
                ) : (
                  <div className="text-4xl text-[#B0ACA5] opacity-50 mb-4">🤖</div>
                )}
              </div>

              <div className="flex justify-between items-end mb-1">
                <div>
                  <div className="text-sm font-bold text-[#1D1D1F]">{connectedDeviceName || '연결 대기중'}</div>
                  <div className="text-[10px] text-[#86868B]">펌웨어 v1.2.3</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[#86868B] font-bold mb-1">배터리 {status === 'connected' ? batteryLevel : 0}%</div>
                  <div className="w-16 h-1.5 bg-[#EAE6DF] rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${status === 'connected' ? batteryLevel : 0}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Connection Info */}
            <div className="bg-white border border-[#EAE6DF] rounded-3xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#1D1D1F] mb-4">연결 정보</h3>
              <div className="space-y-3">
                {[
                  { label: '연결 방식', value: status === 'connected' ? 'WebSocket (via BLE)' : '-' },
                  { label: 'IP 주소', value: robotIp || '-' },
                  { label: '연결 상태', value: status === 'connected' ? '정상 연결' : '연결 안됨' },
                  { label: '최근 업데이트', value: status === 'connected' ? new Date().toLocaleTimeString() : '-' },
                ].map((info, i) => (
                  <div key={i} className="flex justify-between items-center text-xs">
                    <span className="text-[#86868B] font-medium">{info.label}</span>
                    <span className="text-[#1D1D1F] font-bold font-mono">{info.value}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
