import React, { useState, useRef } from 'react';
import { Bluetooth, Wifi, Smile, Frown, Heart, Moon, Zap, Cat } from 'lucide-react';

const SERVICE_UUID = '6b8a0001-4f2a-4b3c-9d5e-1a2b3c4d5e6f';
const CHAR_WRITE_UUID = '6b8a0002-4f2a-4b3c-9d5e-1a2b3c4d5e6f';
const CHAR_NOTIFY_UUID = '6b8a0003-4f2a-4b3c-9d5e-1a2b3c4d5e6f';

export const BleController: React.FC = () => {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'ble_connecting' | 'wifi_connecting' | 'connected' | 'error'>('idle');
  const [logMessages, setLogMessages] = useState<string[]>(['시스템 준비 완료...']);
  const [robotIp, setRobotIp] = useState<string | null>(null);
  
  const bleDeviceRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const addLog = (msg: string) => {
    setLogMessages(prev => [...prev, msg]);
    console.log(msg);
  };

  const stringToBase64 = (str: string) => btoa(unescape(encodeURIComponent(str)));
  const base64ToString = (b64: string) => decodeURIComponent(escape(atob(b64)));

  const handleConnectBle = async () => {
    if (!ssid) {
      alert('WiFi SSID를 입력해주세요.');
      return;
    }

    try {
      addLog('블루투스 기기 검색 중...');
      setStatus('ble_connecting');
      
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ namePrefix: 'SODABOT' }],
        optionalServices: [SERVICE_UUID]
      });

      bleDeviceRef.current = device;
      
      device.addEventListener('gattserverdisconnected', () => {
        addLog('BLE 연결이 끊어졌습니다.');
      });

      addLog(`기기 선택됨: ${device.name}`);
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      
      const writeChar = await service.getCharacteristic(CHAR_WRITE_UUID);
      const notifyChar = await service.getCharacteristic(CHAR_NOTIFY_UUID);

      await notifyChar.startNotifications();
      notifyChar.addEventListener('characteristicvaluechanged', (event: any) => {
        try {
          const value = event.target.value;
          const decoder = new TextDecoder();
          const b64Received = decoder.decode(value);
          
          addLog(`수신된 Base64 데이터: ${b64Received}`);
          const jsonStr = base64ToString(b64Received);
          const data = JSON.parse(jsonStr);

          if (data.state === 'success' && data.ip) {
            setRobotIp(data.ip);
            addLog(`성공적으로 IP를 획득했습니다: ${data.ip}`);
            
            if (bleDeviceRef.current && bleDeviceRef.current.gatt.connected) {
              bleDeviceRef.current.gatt.disconnect();
            }

            connectWebSocket(data.ip);
          } else {
            addLog('WiFi 연결에 실패했거나 IP가 없습니다.');
            setStatus('error');
          }
        } catch (err: any) {
          addLog(`응답 파싱 오류: ${err.message}`);
        }
      });
      addLog('Notify 리스너 등록 완료. 기기 응답을 대기합니다.');

      const wifiJson = JSON.stringify({ ssid, password });
      const b64Data = stringToBase64(wifiJson);
      
      const encoder = new TextEncoder();
      const dataArray = encoder.encode(b64Data);

      addLog('WiFi 정보 전송 중...');
      await writeChar.writeValue(dataArray);
      addLog('전송 완료. 기기의 IP 할당을 기다립니다...');
      setStatus('wifi_connecting');

    } catch (error: any) {
      addLog(`BLE 오류: ${error.message}`);
      setStatus('error');
    }
  };

  const connectWebSocket = (ip: string) => {
    const wsUrl = `ws://${ip}:8080/soda/ws`;
    addLog(`웹소켓 연결 시도 중... ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      addLog('웹소켓 연결 성공!');
      setStatus('connected');
    };

    ws.onclose = () => {
      addLog('웹소켓 연결이 종료되었습니다.');
      setStatus('error');
      wsRef.current = null;
    };

    ws.onerror = () => {
      addLog(`웹소켓 에러 발생`);
      setStatus('error');
    };
  };

  const sendExpression = (expr: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert('로봇과 연결되어 있지 않습니다.');
      return;
    }
    const payload = {
      type: "command",
      action: "set_expression",
      value: expr
    };
    wsRef.current.send(JSON.stringify(payload));
    addLog(`표정 명령 전송됨: ${expr}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-100">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6 flex items-center justify-center gap-2">
          <Bluetooth className="text-indigo-500" /> 소다봇 컨트롤러
        </h1>
        
        <div className="flex items-center justify-center gap-2 mb-8 font-medium">
          <div className={`w-3 h-3 rounded-full ${status === 'connected' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : status === 'error' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : status === 'idle' ? 'bg-slate-500' : 'bg-amber-500 animate-pulse'}`}></div>
          <span className="text-sm text-slate-300">
            {status === 'idle' && '대기 중'}
            {status === 'ble_connecting' && 'BLE 기기 검색 및 연결 중...'}
            {status === 'wifi_connecting' && 'WiFi 연결 대기 중...'}
            {status === 'connected' && '로봇과 연결됨'}
            {status === 'error' && '연결 실패 / 종료됨'}
          </span>
        </div>

        {status !== 'connected' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">WiFi 이름 (SSID)</label>
              <input 
                type="text" 
                value={ssid}
                onChange={e => setSsid(e.target.value)}
                placeholder="공유기 이름 입력"
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">WiFi 비밀번호</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <button 
              onClick={handleConnectBle}
              disabled={status === 'ble_connecting' || status === 'wifi_connecting'}
              className="w-full py-3 mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Wifi size={18} /> BLE 기기 찾기 및 WiFi 전송
            </button>
          </div>
        ) : (
          <div>
            <label className="block text-center text-sm font-medium text-slate-400 mb-4">표정 명령 보내기</label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => sendExpression('default')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg flex flex-col items-center gap-2 transition-colors">
                <Smile className="text-gray-300" /> Default
              </button>
              <button onClick={() => sendExpression('happy')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg flex flex-col items-center gap-2 transition-colors">
                <Smile className="text-yellow-400" /> Happy
              </button>
              <button onClick={() => sendExpression('angry')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg flex flex-col items-center gap-2 transition-colors">
                <Frown className="text-red-400" /> Angry
              </button>
              <button onClick={() => sendExpression('heart')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg flex flex-col items-center gap-2 transition-colors">
                <Heart className="text-pink-400" /> Lovely Heart
              </button>
              <button onClick={() => sendExpression('sleepy')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg flex flex-col items-center gap-2 transition-colors">
                <Moon className="text-blue-400" /> Sleepy
              </button>
              <button onClick={() => sendExpression('surprised')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg flex flex-col items-center gap-2 transition-colors">
                <Zap className="text-amber-400" /> Surprised
              </button>
              <button onClick={() => sendExpression('cat')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg flex flex-col items-center gap-2 transition-colors">
                <Cat className="text-emerald-400" /> Cat
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 bg-slate-950 p-4 rounded-lg h-32 overflow-y-auto font-mono text-xs text-slate-500 flex flex-col gap-1">
          {logMessages.map((msg, i) => (
            <div key={i}>{msg}</div>
          ))}
        </div>
      </div>
    </div>
  );
};
