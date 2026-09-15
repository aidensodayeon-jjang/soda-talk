import { sodabotTransport } from '../utils/sodabotTransport';
import React, { useState } from 'react';
import { 
  Bot, Edit3, Save, Smile, Volume2, Sparkles, Sliders, Play, Plus, 
  Wifi, Clock, MapPin, Download, Upload, Share2, Link, RefreshCw, 
  Check, Power, Battery, Cpu, HardDrive, Thermometer, Droplets, Sun, 
  ChevronRight, HelpCircle, MessageCircle, FileText, MoveUp, MoveDown,
  ChevronDown, Layers, ShieldCheck, Zap, Bluetooth, Usb
} from 'lucide-react';

export default function SodabotSettingsScreen() {
  const [connectionType, setConnectionType] = useState(sodabotTransport.type);
  React.useEffect(() => {
    const update = () => setConnectionType(sodabotTransport.type);
    window.addEventListener('sodabot-status-changed', update);
    return () => window.removeEventListener('sodabot-status-changed', update);
  }, []);

  // State variables for interactive UI controls
  const [profileName, setProfileName] = useState('루미');
  const [profileDesc, setProfileDesc] = useState('항상 옆에서 응원해주는 친구');
  const [startupPrompt, setStartupPrompt] = useState(localStorage.getItem("sodabot_startup_prompt") || '소다봇 시작 테스트야. 한 문장으로 짧게 인사해줘.');
  const [exprTab, setExprTab] = useState<'basic' | 'custom'>('basic');
  const [selectedExpr, setSelectedExpr] = useState('happy');
  const exprTimeoutRef = React.useRef<any>(null);
  const sendWsCommand = (action: string, value: string, label?: string) => {
    window.dispatchEvent(new CustomEvent('sodabot-send-command', { detail: { action, value, label } }));
  };

  // Immediate Expression Execution with 3-Second Auto-Reset to Default
  const triggerExpression = (exprId: string, label: string) => {
    // 1. Update preview screen immediately
    setSelectedExpr(exprId);

    // 2. Send command to real hardware instantly
    sendWsCommand("set_expression", exprId, `${label} 표정 전송`);

    showToast(`'${label}' 표정 요청 중…`);

    // 3. Reset to default/idle (happy) after 3 seconds
    if (exprTimeoutRef.current) clearTimeout(exprTimeoutRef.current);
    exprTimeoutRef.current = setTimeout(() => {
      setSelectedExpr('happy');
      // 로봇 펌웨어가 기본 표정으로 복귀하므로 명령을 중복 전송하지 않는다.
    }, 3000);
  };

  // Expression Studio Editor Modal State
  const [showExprEditor, setShowExprEditor] = useState(false);
  const [editorTab, setEditorTab] = useState<'pixel' | 'slider'>('slider');

  // Mode 1: 16x16 Pixel Drawing Grid State
  const [pixelGrid, setPixelGrid] = useState<string[]>(() => Array(256).fill('#090D16'));
  const [isMirror, setIsMirror] = useState(true);
  const [drawColor, setDrawColor] = useState('#22D3EE');
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Mode 2: Fine-Tuning Parameter Sliders State
  const [eyeWidth, setEyeWidth] = useState(48);
  const [eyeHeight, setEyeHeight] = useState(38);
  const [pupilX, setPupilX] = useState(0);
  const [pupilY, setPupilY] = useState(0);
  const [eyebrowTilt, setEyebrowTilt] = useState(0);
  const [eyeRadius, setEyeRadius] = useState(16);
  const [hasSparkle, setHasSparkle] = useState(true);
  const [hasGloss, setHasGloss] = useState(true);

  const [editName, setEditName] = useState('울먹눈');
  const [editEmoji, setEditEmoji] = useState('🥹');
  const [editShape, setEditShape] = useState<'default' | 'happy' | 'angry' | 'sleepy' | 'surprised' | 'wink' | 'heart' | 'cat'>('happy');
  const [editMouth, setEditMouth] = useState<'none' | 'smile' | 'open' | 'cat' | 'tongue'>('smile');
  const [editColor, setEditColor] = useState('#22D3EE');
  const [editEffect, setEditEffect] = useState<'none' | 'pulse' | 'bounce' | 'glow'>('pulse');

  // Real-time Dynamic Hardware Sync
  const syncFaceToHardware = (overrideParams?: any) => {
    const params = {
      type: "render_face",
      eyeWidth,
      eyeHeight,
      pupilX,
      pupilY,
      eyebrowTilt,
      eyeRadius,
      hasSparkle,
      hasGloss,
      shape: editShape,
      mouth: editMouth,
      color: editColor,
      effect: editEffect,
      ...overrideParams
    };
    sendWsCommand("render_face", JSON.stringify(params));
  };

  const syncPixelsToHardware = (grid: string[]) => {
    const payload = JSON.stringify({
      type: "render_pixels",
      pixels: grid
    });
    sendWsCommand("render_pixels", payload);
  };

  // Load base flat expression presets into fine-tuning editor (excluding animations/effects)
  const handleLoadBaseExpression = (exprId: string) => {
    switch (exprId) {
      case 'default':
        setEditName('기본 평면');
        setEditEmoji('🤖');
        setEditShape('default');
        setEyeWidth(84);
        setEyeHeight(68);
        setPupilX(0);
        setPupilY(0);
        setEyebrowTilt(0);
        setEyeRadius(20);
        setHasSparkle(false);
        setHasGloss(false);
        setEditMouth('none');
        setEditColor('#22D3EE');
        setEditEffect('none');
        break;
      case 'happy':
        setEditName('행복 평면');
        setEditEmoji('😆');
        setEditShape('happy');
        setEyeWidth(84);
        setEyeHeight(68);
        setPupilX(0);
        setPupilY(0);
        setEyebrowTilt(0);
        setEyeRadius(20);
        setHasSparkle(false);
        setHasGloss(false);
        setEditMouth('smile');
        setEditColor('#22D3EE');
        setEditEffect('none');
        break;
      case 'angry':
        setEditName('화남 평면');
        setEditEmoji('😡');
        setEditShape('angry');
        setEyeWidth(84);
        setEyeHeight(68);
        setPupilX(0);
        setPupilY(0);
        setEyebrowTilt(-20);
        setEyeRadius(20);
        setHasSparkle(false);
        setHasGloss(false);
        setEditMouth('none');
        setEditColor('#22D3EE');
        setEditEffect('none');
        break;
      case 'sad':
        setEditName('슬픔 평면');
        setEditEmoji('😢');
        setEditShape('sad');
        setEyeWidth(84);
        setEyeHeight(68);
        setPupilX(0);
        setPupilY(0);
        setEyebrowTilt(20);
        setEyeRadius(20);
        setHasSparkle(false);
        setHasGloss(false);
        setEditMouth('none');
        setEditColor('#22D3EE');
        setEditEffect('none');
        break;
      case 'sleepy':
        setEditName('졸림 평면');
        setEditEmoji('😴');
        setEditShape('sleepy');
        setEyeWidth(84);
        setEyeHeight(68);
        setPupilX(0);
        setPupilY(0);
        setEyebrowTilt(0);
        setEyeRadius(20);
        setHasSparkle(false);
        setHasGloss(false);
        setEditMouth('none');
        setEditColor('#22D3EE');
        setEditEffect('none');
        break;
      case 'surprised':
        setEditName('놀람 평면');
        setEditEmoji('😲');
        setEditShape('surprised');
        setEyeWidth(84);
        setEyeHeight(68);
        setPupilX(0);
        setPupilY(0);
        setEyebrowTilt(0);
        setEyeRadius(20);
        setHasSparkle(false);
        setHasGloss(false);
        setEditMouth('open');
        setEditColor('#22D3EE');
        setEditEffect('none');
        break;
      case 'wink':
        setEditName('윙크 평면');
        setEditEmoji('😉');
        setEditShape('wink');
        setEyeWidth(84);
        setEyeHeight(68);
        setPupilX(0);
        setPupilY(0);
        setEyebrowTilt(0);
        setEyeRadius(20);
        setHasSparkle(true);
        setHasGloss(false);
        setEditMouth('smile');
        setEditColor('#22D3EE');
        setEditEffect('none');
        break;
      case 'heart':
        setEditName('하트눈 평면');
        setEditEmoji('💖');
        setEditShape('heart');
        setEyeWidth(84);
        setEyeHeight(68);
        setPupilX(0);
        setPupilY(0);
        setEyebrowTilt(0);
        setEyeRadius(20);
        setHasSparkle(false);
        setHasGloss(false);
        setEditMouth('smile');
        setEditColor('#F43F5E');
        setEditEffect('none');
        break;
      case 'pupil':
        setEditName('초롱눈 평면');
        setEditEmoji('👀');
        setEditShape('pupil');
        setEyeWidth(84);
        setEyeHeight(68);
        setPupilX(0);
        setPupilY(0);
        setEyebrowTilt(0);
        setEyeRadius(20);
        setHasSparkle(true);
        setHasGloss(true);
        setEditMouth('none');
        setEditColor('#22D3EE');
        setEditEffect('none');
        break;
      case 'cat':
        setEditName('고양이 평면');
        setEditEmoji('🐱');
        setEditShape('cat');
        setEyeWidth(84);
        setEyeHeight(68);
        setPupilX(0);
        setPupilY(0);
        setEyebrowTilt(0);
        setEyeRadius(20);
        setHasSparkle(false);
        setHasGloss(false);
        setEditMouth('cat');
        setEditColor('#22D3EE');
        setEditEffect('none');
        break;
      default:
        break;
    }
    showToast(`'${exprId}' 기본 평면 표정을 불러왔습니다.`);
  };

  // Sync to hardware in realtime when editor sliders / shapes change
  React.useEffect(() => {
    if (showExprEditor && editorTab === 'slider') {
      syncFaceToHardware();
    }
  }, [eyeWidth, eyeHeight, pupilX, pupilY, eyebrowTilt, eyeRadius, hasSparkle, hasGloss, editShape, editMouth, editColor, editEffect, showExprEditor, editorTab]);

  // Handle Pixel Drawing Click & Mirroring
  const handlePixelClick = (index: number) => {
    const nextGrid = [...pixelGrid];
    nextGrid[index] = drawColor;

    if (isMirror) {
      const row = Math.floor(index / 16);
      const col = index % 16;
      const mirroredCol = 15 - col;
      const mirroredIndex = row * 16 + mirroredCol;
      nextGrid[mirroredIndex] = drawColor;
    }
    setPixelGrid(nextGrid);
    syncPixelsToHardware(nextGrid);
  };

  const handleClearPixelGrid = () => {
    const emptyGrid = Array(256).fill('#090D16');
    setPixelGrid(emptyGrid);
    syncPixelsToHardware(emptyGrid);
    showToast('픽셀 캔버스가 초기화되었습니다.');
  };

  const handleLoadPixelPreset = (preset: string) => {
    const grid = Array(256).fill('#090D16');
    if (preset === 'heart') {
      // Draw Heart preset in 16x16 grid
      const heartIndices = [
        35,36, 43,44,
        50,51,52,53, 58,59,60,61,
        65,66,67,68,69,70,71,72,73,74,75,76,77,78,
        81,82,83,84,85,86,87,88,89,90,91,92,93,94,
        98,99,100,101,102,103,104,105,106,107,108,109,
        115,116,117,118,119,120,121,122,123,124,
        132,133,134,135,136,137,138,139,
        149,150,151,152,153,154,
        166,167,168,169,
        183,184
      ];
      heartIndices.forEach(i => grid[i] = '#F43F5E');
    } else if (preset === 'star') {
      const starIndices = [
        23,24, 39,40, 55,56, 71,72,
        65,66,67,68,69,70,71,72,73,74,75,76,77,78,
        83,84,85,86,87,88,89,90,
        99,100,101,102,103,104,105,106,
        115,116, 123,124, 130,131, 140,141,
        145,146, 157,158
      ];
      starIndices.forEach(i => grid[i] = '#FACC15');
    }
    setPixelGrid(grid);
    syncPixelsToHardware(grid);
    showToast(`'${preset}' 픽셀 도안이 소다봇으로 실시간 전송되었습니다!`);
  };

  // Custom Created Expression List State
  const [customExprList, setCustomExprList] = useState<Array<{id: string; label: string; emoji: string; shape: string; mouth: string; color: string; effect: string}>>(() => {
    try {
      const saved = localStorage.getItem("sodabot_custom_exprs");
      return saved ? JSON.parse(saved) : [
        { id: 'custom_1', label: '울먹눈', emoji: '🥹', shape: 'happy', mouth: 'smile', color: '#38BDF8', effect: 'pulse' },
        { id: 'custom_2', label: '메롱', emoji: '😜', shape: 'wink', mouth: 'tongue', color: '#F43F5E', effect: 'bounce' }
      ];
    } catch {
      return [];
    }
  });

  const handleSaveCustomExpr = () => {
    const newExpr = {
      id: 'custom_' + Date.now(),
      label: editName || '커스텀 표정',
      emoji: editEmoji || '✨',
      shape: editShape,
      mouth: editMouth,
      color: editColor,
      effect: editEffect
    };
    const updated = [...customExprList, newExpr];
    setCustomExprList(updated);
    localStorage.setItem("sodabot_custom_exprs", JSON.stringify(updated));
    setShowExprEditor(false);
    showToast(`✨ '${editName}' 나만의 표정이 라이브러리에 저장되었습니다!`);
    setExprTab('custom');
  };

  const handleDeleteCustomExpr = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customExprList.filter(item => item.id !== id);
    setCustomExprList(updated);
    localStorage.setItem("sodabot_custom_exprs", JSON.stringify(updated));
    showToast('커스텀 표정이 삭제되었습니다.');
  };

  const [welcomeMsg, setWelcomeMsg] = useState('안녕하세요!\n저는 루미예요 :)\n오늘도 함께해요!');
  const [standbyFace, setStandbyFace] = useState('기본 표정 표시 🤖');

  const [soundTab, setSoundTab] = useState<'basic' | 'custom'>('basic');
  const [playingSound, setPlayingSound] = useState<string | null>(null);

  const [touchTab, setTouchTab] = useState<'touch' | 'button'>('touch');

  const [standbyTime, setStandbyTime] = useState('30초');

  const [wifiSsid, setWifiSsid] = useState(localStorage.getItem('sodabot_wifi_ssid') || 'SODA_LAB');
  const [wifiPass, setWifiPass] = useState(localStorage.getItem('sodabot_wifi_password') || '••••••••');
  const [autoSync, setAutoSync] = useState(true);
  const [timezone, setTimezone] = useState('서울, 대한민국 (GMT+9)');
  const [location, setLocation] = useState('서울특별시');

  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [bootingState, setBootingState] = useState<string | null>(null);

  // Welcome Screen Studio Modal State
  const [showWelcomeStudio, setShowWelcomeStudio] = useState(false);
  const [studioText, setStudioText] = useState('안녕하세요!\n저는 루미예요 :)\n오늘도 반가워요!');
  const [studioTheme, setStudioTheme] = useState<'starry' | 'neon' | 'sunset' | 'emerald'>('starry');
  const [studioColor, setStudioColor] = useState('#22D3EE');
  const [studioMascot, setStudioMascot] = useState('happy');
  const [studioSound, setStudioSound] = useState('greeting');

  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 2500);
  };

  // Web Audio API Audio Synthesizer (웹에서만 듣기 - 소리 보장)
  const playWebSound = async (soundId: string) => {
    setPlayingSound(`web_${soundId}`);
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const playTone = (freq: number, duration: number, type: OscillatorType = 'sine') => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
      };

      if (soundId === 'power_on') {
        playTone(440, 0.15, 'sine');
        setTimeout(() => playTone(880, 0.25, 'sine'), 150);
      } else if (soundId === 'greeting') {
        playTone(523.25, 0.15, 'triangle');
        setTimeout(() => playTone(659.25, 0.15, 'triangle'), 150);
        setTimeout(() => playTone(783.99, 0.25, 'triangle'), 300);
      } else if (soundId === 'button_click') {
        playTone(1000, 0.08, 'square');
      } else if (soundId === 'touch_react') {
        playTone(400, 0.1, 'sine');
        setTimeout(() => playTone(600, 0.15, 'sine'), 100);
      } else {
        playTone(880, 0.2, 'sine');
        setTimeout(() => playTone(1200, 0.2, 'sine'), 180);
      }
    } catch (e) {
      console.error("Audio error:", e);
    }
    setTimeout(() => setPlayingSound(null), 600);
  };

  // Hardware Sound Test (소다봇 기기에서만 듣기)
  const playBotSound = (soundId: string) => {
    setPlayingSound(`bot_${soundId}`);
    sendWsCommand("play_sound", soundId);
    showToast(`'${soundId}' 사운드를 소다봇 기기 스피커로 전송했습니다 🤖🔊`);
    setTimeout(() => setPlayingSound(null), 600);
  };

  // Boot sequence preview simulator
  const playBootSequence = async () => {
    showToast('🚀 2.0" TFT LCD 화면에서 시작 시퀀스를 재생합니다!');
    setBootingState('1. 💬 환영 인사 표시');
    setSelectedExpr('happy');
    await new Promise(r => setTimeout(r, 1200));

    setBootingState('2. 😃 웃는 표정 전환');
    setSelectedExpr('happy');
    await new Promise(r => setTimeout(r, 1200));

    setBootingState('3. 🎵 효과음 재생');
    playWebSound('greeting');
    await new Promise(r => setTimeout(r, 1200));

    setBootingState('4. ⏰ 현재 시간 표시 (대기)');
    setSelectedExpr('default');
    await new Promise(r => setTimeout(r, 1200));

    setBootingState(null);
  };

  // Export JSON configuration file
  const handleExportConfig = () => {
    const configData = {
      profileName,
      profileDesc,
      welcomeMsg,
      standbyFace,
      standbyTime,
      wifiSsid,
      autoSync,
      timezone,
      location,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sodabot_config_${profileName}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('설정 파일(sodabot_config.json) 다운로드가 완료되었습니다!');
  };

  // Import JSON configuration file
  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.profileName) setProfileName(data.profileName);
        if (data.profileDesc) setProfileDesc(data.profileDesc);
        if (data.welcomeMsg) setWelcomeMsg(data.welcomeMsg);
        if (data.wifiSsid) setWifiSsid(data.wifiSsid);
        showToast('백업 파일로부터 소다봇 설정이 성공적으로 복원되었습니다!');
      } catch (err) {
        alert('올바르지 않은 설정 파일 형식입니다.');
      }
    };
    reader.readAsText(file);
  };

  const expressionsList = [
    { id: 'default', label: '기본', emoji: '🤖', bg: 'bg-[#FAF9F6]' },
    { id: 'sleepy', label: '졸림', emoji: '😴', bg: 'bg-indigo-50' },
    { id: 'heart', label: '러블리 하트 (터치 3회)', emoji: '💖✨', bg: 'bg-pink-50' },
    { id: 'happy', label: '기쁨', emoji: '😆', bg: 'bg-amber-50' },
    { id: 'sad', label: '슬픔', emoji: '😢', bg: 'bg-blue-50' },
    { id: 'angry', label: '화남', emoji: '😡', bg: 'bg-rose-50' },
    { id: 'surprised', label: '놀람', emoji: '😲', bg: 'bg-cyan-50' },
    { id: 'wink', label: '윙크', emoji: '😉', bg: 'bg-pink-50' },
    { id: 'pupil', label: '초롱이', emoji: '👀', bg: 'bg-cyan-50' },
    { id: 'cat', label: '고양이', emoji: '🐱', bg: 'bg-yellow-50' },
  ];

  const soundList = [
    { id: 'power_on', name: '전원 켜짐', duration: '00:01' },
    { id: 'greeting', name: '인사할 때', duration: '00:02' },
    { id: 'button_click', name: '버튼 클릭', duration: '00:01' },
    { id: 'touch_react', name: '터치 반응', duration: '00:01' },
    { id: 'notification', name: '알림', duration: '00:02' },
  ];

  const touchActions = [
    { trigger: '탭 (한 번 터치)', icon: '👆', target: '랜덤 표정' },
    { trigger: '길게 누르기', icon: '👆', target: '환영 인사' },
    { trigger: '두 번 터치', icon: '✌️', target: '현재 시간' },
    { trigger: '스와이프 좌', icon: '👈', target: '이전 표정' },
    { trigger: '스와이프 우', icon: '👉', target: '다음 표정' },
  ];

  const startSeq = [
    { id: 1, text: '환영 인사 표시', icon: '💬' },
    { id: 2, text: '웃는 표정', icon: '😃' },
    { id: 3, text: '효과음 재생', icon: '🎵' },
    { id: 4, text: '현재 시간 표시', icon: '⏰' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF9F6] p-6 lg:p-8 overflow-y-auto font-sans animate-fade-in">
      
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed top-6 right-6 z-50 bg-[#1D1D1F] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in text-xs font-semibold">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto w-full space-y-8 pb-12">

        {/* Page Header Banner (LCD Simulator on Top-Left) */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-[#EAE6DF] shadow-sm">
          
          {/* Top-Left: Real-time 2.0" ST7789 TFT LCD Screen Simulator */}
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#FAF9F6] p-3 px-4 rounded-2xl border border-[#EAE6DF] shrink-0">
            <div className="text-left space-y-1">
              <div className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 inline-block">
                2.0" ST7789 TFT (320x240)
              </div>
              <div className="text-xs font-bold text-[#1D1D1F]">실시간 미리보기</div>
              <div className="text-[10px] text-[#86868B]">선택: <span className="font-bold text-amber-600">{expressionsList.find(e => e.id === selectedExpr)?.label}</span></div>
            </div>

            {/* Virtual TFT Screen Canvas Frame */}
            <div className="w-56 h-40 bg-[#111827] border-4 border-[#374151] rounded-2xl p-2.5 flex flex-col justify-between items-center relative overflow-hidden shadow-xl select-none group">
              {/* Screen Top Status Bar */}
              <div className="w-full flex justify-between items-center text-[9px] text-cyan-400 font-mono opacity-80 z-10">
                <span className="flex items-center gap-1"><Wifi className="w-2.5 h-2.5" /> SODA_LAB</span>
                <span className="font-bold">14:30</span>
                <span className="flex items-center gap-1">85% <Battery className="w-3 h-3 text-emerald-400" /></span>
              </div>

              {/* Eye Graphics Simulator synced 1:1 with soda-aibot.ino hardware drawing logic */}
              <div className="flex-1 w-full flex items-center justify-center gap-6 relative z-10">
                {selectedExpr === 'happy' && (
                  <div className="flex items-center justify-center gap-6">
                    <div className="w-12 h-10 border-t-[8px] border-cyan-400 rounded-t-full shadow-[0_0_12px_rgba(34,211,238,0.7)] animate-pulse"></div>
                    <div className="w-12 h-10 border-t-[8px] border-cyan-400 rounded-t-full shadow-[0_0_12px_rgba(34,211,238,0.7)] animate-pulse"></div>
                  </div>
                )}
                {selectedExpr === 'angry' && (
                  <>
                    <div className="w-12 h-10 bg-cyan-400 rounded-xl relative overflow-hidden shadow-[0_0_12px_rgba(34,211,238,0.7)]">
                      <div className="absolute top-0 right-0 w-8 h-8 bg-[#111827] transform rotate-45 translate-x-3 -translate-y-3"></div>
                    </div>
                    <div className="w-12 h-10 bg-cyan-400 rounded-xl relative overflow-hidden shadow-[0_0_12px_rgba(34,211,238,0.7)]">
                      <div className="absolute top-0 left-0 w-8 h-8 bg-[#111827] transform -rotate-45 -translate-x-3 -translate-y-3"></div>
                    </div>
                  </>
                )}
                {selectedExpr === 'sad' && (
                  <div className="relative w-full flex flex-col items-center justify-center">
                    <div className="flex items-center justify-center gap-6">
                      <div className="w-12 h-10 bg-cyan-400 rounded-xl relative overflow-hidden shadow-[0_0_12px_rgba(34,211,238,0.7)]">
                        <div className="absolute top-0 left-0 w-8 h-8 bg-[#111827] transform rotate-45 -translate-x-3 -translate-y-3"></div>
                      </div>
                      <div className="w-12 h-10 bg-cyan-400 rounded-xl relative overflow-hidden shadow-[0_0_12px_rgba(34,211,238,0.7)]">
                        <div className="absolute top-0 right-0 w-8 h-8 bg-[#111827] transform -rotate-45 translate-x-3 -translate-y-3"></div>
                      </div>
                    </div>
                    {/* Falling teardrop animation */}
                    <div className="absolute left-6 top-6 text-cyan-400 text-sm animate-bounce">💧</div>
                  </div>
                )}
                {selectedExpr === 'sleepy' && (
                  <div className="relative w-full flex items-center justify-center gap-6">
                    <div className="w-12 h-3 bg-cyan-400 rounded-full my-auto opacity-90 shadow-[0_0_10px_rgba(34,211,238,0.7)]"></div>
                    <div className="w-12 h-3 bg-cyan-400 rounded-full my-auto opacity-90 shadow-[0_0_10px_rgba(34,211,238,0.7)]"></div>

                    {/* Floating Z z z animation */}
                    <div className="absolute right-2 -top-5 flex flex-col text-cyan-300 font-mono font-bold select-none pointer-events-none">
                      <span className="text-[12px] animate-bounce tracking-widest text-indigo-300">Z</span>
                      <span className="text-[10px] animate-bounce delay-100 tracking-wider text-cyan-300 -mt-1 ml-2">z</span>
                      <span className="text-[8px] animate-bounce delay-200 text-cyan-400 -mt-1 ml-4">z</span>
                    </div>
                  </div>
                )}
                {selectedExpr === 'surprised' && (
                  <div className="relative flex items-center justify-center gap-6">
                    <div className="w-12 h-12 bg-cyan-400 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.9)] animate-pulse">
                      <div className="w-3 h-3 bg-[#111827] rounded-full"></div>
                    </div>
                    <div className="w-12 h-12 bg-cyan-400 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.9)] animate-pulse">
                      <div className="w-3 h-3 bg-[#111827] rounded-full"></div>
                    </div>
                    {/* Gasp exclamation effect */}
                    <div className="absolute -top-4 font-mono font-bold text-cyan-300 text-xs animate-ping">⚡ 😲 ⚡</div>
                  </div>
                )}
                {selectedExpr === 'wink' && (
                  <div className="relative flex items-center justify-center gap-6">
                    {/* Left winking arch */}
                    <div className="w-12 h-10 border-t-[8px] border-cyan-400 rounded-t-full shadow-[0_0_12px_rgba(34,211,238,0.7)] animate-pulse"></div>
                    {/* Right open sparkling eye */}
                    <div className="w-12 h-10 bg-cyan-400 rounded-2xl relative flex items-center justify-center shadow-[0_0_12px_rgba(34,211,238,0.7)]">
                      <div className="absolute top-1 right-1.5 text-xs text-amber-300 animate-spin">✨</div>
                    </div>
                  </div>
                )}
                {selectedExpr === 'heart' && (
                  <div className="flex gap-4 text-rose-500 text-3xl animate-bounce">
                    ❤️ ❤️
                  </div>
                )}
                {selectedExpr === 'cat' && (
                  <div className="flex flex-col items-center justify-center relative">
                    <div className="flex gap-6">
                      <div className="w-10 h-7 bg-cyan-400 rounded-t-full"></div>
                      <div className="w-10 h-7 bg-cyan-400 rounded-t-full"></div>
                    </div>
                    <div className="text-cyan-400 text-xs font-mono font-bold mt-1">▲ w ▲</div>
                  </div>
                )}
                {selectedExpr === 'pupil' && (
                  <div className="flex items-center justify-center gap-6">
                    <div className="w-12 h-10 bg-cyan-400 rounded-2xl relative flex items-center justify-center shadow-[0_0_14px_rgba(34,211,238,0.8)] animate-pulse">
                      <div className="w-5 h-5 bg-[#090D16] rounded-full relative">
                        <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-white rounded-full"></div>
                        <div className="absolute bottom-0.5 left-0.5 w-1 h-1 bg-white/70 rounded-full"></div>
                      </div>
                      <div className="absolute -top-1 -right-1 text-[9px]">✨</div>
                    </div>
                    <div className="w-12 h-10 bg-cyan-400 rounded-2xl relative flex items-center justify-center shadow-[0_0_14px_rgba(34,211,238,0.8)] animate-pulse">
                      <div className="w-5 h-5 bg-[#090D16] rounded-full relative">
                        <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-white rounded-full"></div>
                        <div className="absolute bottom-0.5 left-0.5 w-1 h-1 bg-white/70 rounded-full"></div>
                      </div>
                      <div className="absolute -top-1 -right-1 text-[9px]">✨</div>
                    </div>
                  </div>
                )}
                {(selectedExpr === 'default' || (selectedExpr !== 'happy' && selectedExpr !== 'angry' && selectedExpr !== 'sad' && selectedExpr !== 'sleepy' && selectedExpr !== 'surprised' && selectedExpr !== 'wink' && selectedExpr !== 'heart' && selectedExpr !== 'cat' && selectedExpr !== 'pupil')) && (
                  <>
                    <div className="w-12 h-10 bg-cyan-400 rounded-2xl shadow-[0_0_15px_rgba(34,211,238,0.6)]"></div>
                    <div className="w-12 h-10 bg-cyan-400 rounded-2xl shadow-[0_0_15px_rgba(34,211,238,0.6)]"></div>
                  </>
                )}
              </div>

              {/* Glass Scanline Reflection Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none"></div>
            </div>
          </div>

          {/* Right Header Info */}
          <div className="flex-1 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xl">
                  🤖
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[#1D1D1F] tracking-tight">소다봇 대시보드 & 상태 설정</h1>
                  <p className="text-xs text-[#86868B] mt-0.5 font-medium">소다봇 2.0인치 LCD 디스플레이 및 사운드, 동작을 제어할 수 있는 통합 워크스페이스</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    const btn = document.querySelector('button:has(span:contains("소다봇빌더"))') as HTMLButtonElement;
                    if (btn) btn.click();
                    else window.location.hash = "#sodabot_builder";
                  }}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#1D1D1F] text-white hover:bg-black transition-all cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                  🛠️ 소다봇빌더 (6주차)
                </button>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-200">
                  <Bluetooth className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                  {connectionType === 'none' ? '연결 대기중' : connectionType.toUpperCase()}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                  {connectionType === 'none' ? '소다봇 미연결' : '소다봇 연결됨'}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* 4-Column Responsive Grid Layout matching reference image */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* Card 1: 내 소다봇 프로필 */}
          <div className="bg-white border-2 border-emerald-400/30 hover:border-emerald-400/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between transition-all">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                  1. 내 소다봇 프로필
                </span>
                <Edit3 className="w-4 h-4 text-emerald-500 cursor-pointer hover:scale-110 transition-transform" />
              </div>
              <p className="text-[11px] text-[#86868B] leading-snug">
                소다봇의 이름과 아이콘을 설정하고 한눈에 정보를 확인할 수 있어요.
              </p>

              {/* Profile Card Box */}
              <div className="bg-[#FAF9F6] border border-[#EAE6DF] rounded-2xl p-4 flex items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center text-3xl shadow-sm relative group cursor-pointer">
                  <span>🤖</span>
                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-1 shadow">
                    <Edit3 className="w-2.5 h-2.5" />
                  </div>
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div>
                    <label className="text-[9px] font-bold text-[#86868B] uppercase">이름</label>
                    <div className="flex items-center justify-between bg-white border border-[#EAE6DF] px-2.5 py-1 rounded-lg">
                      <input 
                        type="text" 
                        value={profileName} 
                        onChange={(e) => setProfileName(e.target.value)}
                        className="text-xs font-bold text-[#1D1D1F] bg-transparent outline-none w-full"
                      />
                      <Edit3 className="w-3 h-3 text-[#86868B]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bio & Created Date & Startup Prompt */}
              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="text-[10px] font-semibold text-[#86868B]">한 줄 소개</label>
                  <input 
                    type="text" 
                    value={profileDesc}
                    onChange={(e) => setProfileDesc(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-xs text-[#1D1D1F] focus:bg-white outline-none"
                  />
                </div>

                {/* 시작 요청사항 (시작 인사 프롬프트) 설정 */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-indigo-600">부팅 시 시작 요청사항 (인사 멘트)</label>
                    <button 
                      type="button"
                      onClick={() => {
                        localStorage.setItem("sodabot_startup_prompt", startupPrompt);
                        sendWsCommand("test_startup_prompt", startupPrompt);
                        showToast("소다봇 텍스트 표시 요청 중…");
                      }}
                      className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                    >
                      <Play className="w-2.5 h-2.5" /> 테스트 실행
                    </button>
                  </div>
                  <textarea 
                    rows={2}
                    value={startupPrompt}
                    onChange={(e) => {
                      setStartupPrompt(e.target.value);
                      localStorage.setItem("sodabot_startup_prompt", e.target.value);
                    }}
                    placeholder="예: 소다봇 시작 테스트야. 한 문장으로 짧게 인사해줘."
                    className="w-full px-3 py-1.5 bg-indigo-50/40 border border-indigo-100 rounded-xl text-xs text-[#1D1D1F] focus:bg-white outline-none resize-none"
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] pt-0.5 text-[#86868B]">
                  <span>생성일</span>
                  <span className="font-mono font-semibold text-[#1D1D1F]">2025.05.20</span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                sendWsCommand("set_profile", profileName, "프로필 정보 저장");
                showToast('소다봇 프로필 정보가 저장되었습니다!');
              }}
              className="mt-6 w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              소다봇 정보 저장
            </button>
          </div>


          {/* Card 2: 표정 관리 */}
          <div className="bg-white border-2 border-amber-400/30 hover:border-amber-400/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
                  2. 표정 관리
                </span>
                <Smile className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-[11px] text-[#86868B] leading-snug">
                기본 표정을 사용하거나 편집해서 나만의 표정 라이브러리를 만들어요.
              </p>

              {/* Tabs */}
              <div className="flex bg-[#FAF9F6] p-1 rounded-xl border border-[#EAE6DF] text-[10px] font-bold">
                <button 
                  onClick={() => setExprTab('basic')}
                  className={`flex-1 py-1 rounded-lg transition-colors ${exprTab === 'basic' ? 'bg-white text-amber-700 shadow-sm' : 'text-[#86868B]'}`}
                >
                  기본 표정 ({expressionsList.length})
                </button>
                <button 
                  onClick={() => setExprTab('custom')}
                  className={`flex-1 py-1 rounded-lg transition-colors ${exprTab === 'custom' ? 'bg-white text-amber-700 shadow-sm' : 'text-[#86868B]'}`}
                >
                  내 표정 ({customExprList.length})
                </button>
                <button 
                  onClick={() => setShowExprEditor(true)} 
                  className="px-2 py-1 text-amber-700 hover:bg-amber-100 rounded-lg flex items-center gap-0.5 cursor-pointer font-bold"
                >
                  <Plus className="w-3 h-3 text-amber-600" /> 새 만들기
                </button>
              </div>

              {/* Expression Grid */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                {exprTab === 'basic' ? (
                  expressionsList.map(expr => (
                    <button
                      key={expr.id}
                      onClick={() => triggerExpression(expr.id, expr.label)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer ${selectedExpr === expr.id ? 'border-amber-500 bg-amber-50 scale-105 shadow-sm ring-2 ring-amber-400' : 'border-[#EAE6DF] bg-white hover:border-amber-300'}`}
                      title={`${expr.label} (클릭 시 3초간 소다봇 출력)`}
                    >
                      <span className="text-xl">{expr.emoji}</span>
                      <span className="text-[9px] font-bold text-[#1D1D1F] mt-1">{expr.label}</span>
                    </button>
                  ))
                ) : customExprList.length === 0 ? (
                  <div className="col-span-4 p-4 text-center text-xs text-[#86868B]">
                    등록된 나만의 표정이 없습니다.<br />우측 상단 <span className="font-bold text-amber-600">+ 새 만들기</span> 버튼을 눌러보세요!
                  </div>
                ) : (
                  customExprList.map(cExpr => (
                    <div
                      key={cExpr.id}
                      onClick={() => triggerExpression(cExpr.shape || 'happy', cExpr.label)}
                      className={`relative flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer group ${selectedExpr === cExpr.shape ? 'border-amber-500 bg-amber-50 scale-105 shadow-sm ring-2 ring-amber-400' : 'border-[#EAE6DF] bg-white hover:border-amber-300'}`}
                    >
                      <span className="text-xl">{cExpr.emoji}</span>
                      <span className="text-[9px] font-bold text-[#1D1D1F] mt-1 truncate max-w-full">{cExpr.label}</span>
                      <button 
                        onClick={(e) => handleDeleteCustomExpr(cExpr.id, e)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 text-rose-500 hover:bg-rose-50 rounded transition-all"
                        title="표정 삭제"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button 
              onClick={() => {
                const target = expressionsList.find(e => e.id === selectedExpr);
                triggerExpression(selectedExpr, target?.label || '선택한');
              }}
              className="mt-6 w-full py-2.5 bg-amber-400 hover:bg-amber-500 text-amber-950 text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Smile className="w-3.5 h-3.5" />
              즉시 표정 실행 (3초간 유지)
            </button>
          </div>


          {/* Card 3: 화면 & 메시지 */}
          <div className="bg-white border-2 border-blue-400/30 hover:border-blue-400/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                  3. 화면 & 메시지
                </span>
                <MessageCircle className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-[11px] text-[#86868B] leading-snug">
                소다봇 화면에 보여줄 인사말과 메시지를 자유롭게 설정해요.
              </p>

              {/* Welcome Message Box */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-[#5C5B57]">환영 인사 <span className="text-[#86868B] font-normal">(부팅 시 표시)</span></label>
                  <button 
                    onClick={() => setShowWelcomeStudio(true)}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-blue-500" /> + 나만의 환영화면 만들기
                  </button>
                </div>
                <div className="relative">
                  <textarea 
                    value={welcomeMsg}
                    onChange={(e) => setWelcomeMsg(e.target.value)}
                    rows={3}
                    className="w-full p-2.5 text-xs bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-[#1D1D1F] outline-none focus:bg-white focus:border-blue-300 resize-none font-sans leading-relaxed"
                  />
                  <span className="absolute bottom-2 right-2 text-[9px] text-[#86868B] font-mono">
                    {welcomeMsg.length}/100
                  </span>
                </div>
              </div>

              {/* Standby Screen Box */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#5C5B57]">대기 화면 <span className="text-[#86868B] font-normal">(아무 동작 없을 때)</span></label>
                <div className="relative">
                  <select 
                    value={standbyFace}
                    onChange={(e) => setStandbyFace(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-[#1D1D1F] outline-none focus:bg-white font-bold appearance-none cursor-pointer"
                  >
                    <option>기본 표정 표시 🤖</option>
                    <option>시계 모드 ⏰</option>
                    <option>날씨 정보 ☀️</option>
                    <option>화면 끄기 🌙</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-[#86868B] absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                sendWsCommand("set_welcome", welcomeMsg, "대기화면 설정 전송");
                showToast('환영 인사 및 대기 화면 설정이 저장 후 전송되었습니다!');
              }}
              className="mt-6 w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              저장 후 보내기
            </button>
          </div>


          {/* Card 4: 소리 관리 */}
          <div className="bg-white border-2 border-purple-400/30 hover:border-purple-400/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
                  4. 소리 관리
                </span>
                <Volume2 className="w-4 h-4 text-purple-500" />
              </div>
              <p className="text-[11px] text-[#86868B] leading-snug">
                소리 효과를 선택하거나 업로드해서 다양한 상황에 적용할 수 있어요.
              </p>

              {/* Sound Tabs */}
              <div className="flex bg-[#FAF9F6] p-1 rounded-xl border border-[#EAE6DF] text-[10px] font-bold">
                <button 
                  onClick={() => setSoundTab('basic')}
                  className={`flex-1 py-1 rounded-lg transition-colors ${soundTab === 'basic' ? 'bg-white text-purple-700 shadow-sm' : 'text-[#86868B]'}`}
                >
                  기본 소리
                </button>
                <button 
                  onClick={() => setSoundTab('custom')}
                  className={`flex-1 py-1 rounded-lg transition-colors ${soundTab === 'custom' ? 'bg-white text-purple-700 shadow-sm' : 'text-[#86868B]'}`}
                >
                  내 소리
                </button>
                <button className="px-2 py-1 text-purple-600 hover:bg-purple-100/50 rounded-lg flex items-center gap-0.5">
                  <Plus className="w-3 h-3" /> 업로드
                </button>
              </div>

              {/* Sound List */}
              <div className="space-y-2">
                {soundList.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2 px-2.5 bg-[#FAF9F6] hover:bg-purple-50/50 rounded-xl border border-[#EAE6DF] text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-[#1D1D1F] text-[11px]">{s.name}</span>
                      <span className="font-mono text-[9px] text-[#86868B]">({s.duration})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => playWebSound(s.id)}
                        className="px-2 py-1 bg-white hover:bg-purple-100 border border-[#EAE6DF] rounded-lg text-[10px] font-medium text-purple-700 flex items-center gap-1 transition-colors cursor-pointer"
                        title="웹 브라우저 스피커로 듣기"
                      >
                        <Volume2 className={`w-3 h-3 ${playingSound === `web_${s.id}` ? 'animate-bounce text-purple-600' : ''}`} />
                        웹에서 듣기
                      </button>
                      <button 
                        onClick={() => playBotSound(s.id)}
                        className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                        title="소다봇 기기 스피커로 전송하여 듣기"
                      >
                        <Bot className={`w-3 h-3 ${playingSound === `bot_${s.id}` ? 'animate-bounce text-yellow-300' : ''}`} />
                        소다봇에서 듣기
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={() => {
                sendWsCommand("play_sound", "greeting", "소리 설정 소다봇 전송");
                showToast('소리 설정이 소다봇으로 성공적으로 전송되었습니다!');
              }}
              className="mt-6 w-full py-2.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5"
            >
              <Volume2 className="w-3.5 h-3.5" />
              소다봇으로 보내기
            </button>
          </div>

        </div>


        {/* Row 2: Cards 5 ~ 8 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* Card 5: 동작 설정 */}
          <div className="bg-white border-2 border-rose-400/30 hover:border-rose-400/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100">
                  5. 동작 설정
                </span>
                <Sliders className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-[11px] text-[#86868B] leading-snug">
                터치, 버튼 등 입력에 따라 소다봇이 어떻게 반응할지 설정해요.
              </p>

              {/* Tabs */}
              <div className="flex bg-[#FAF9F6] p-1 rounded-xl border border-[#EAE6DF] text-[10px] font-bold">
                <button 
                  onClick={() => setTouchTab('touch')}
                  className={`flex-1 py-1 rounded-lg transition-colors ${touchTab === 'touch' ? 'bg-white text-rose-700 shadow-sm' : 'text-[#86868B]'}`}
                >
                  터치 패드
                </button>
                <button 
                  onClick={() => setTouchTab('button')}
                  className={`flex-1 py-1 rounded-lg transition-colors ${touchTab === 'button' ? 'bg-white text-rose-700 shadow-sm' : 'text-[#86868B]'}`}
                >
                  버튼
                </button>
              </div>

              {/* Action mappings list */}
              <div className="space-y-1.5">
                {touchActions.map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-[#FAF9F6] rounded-xl border border-[#EAE6DF] text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{t.icon}</span>
                      <span className="text-[11px] text-[#86868B] font-medium">{t.trigger}</span>
                    </div>
                    <button className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-0.5">
                      <span>{t.target}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={() => {
                sendWsCommand("set_reaction", "touch", "동작 반응 설정 전송");
                showToast('동작 반응 설정이 저장 및 적용되었습니다!');
              }}
              className="mt-6 w-full py-2.5 bg-rose-400 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              저장 후 보내기
            </button>
          </div>


          {/* Card 6: 시작 & 대기 설정 */}
          <div className="bg-white border-2 border-teal-400/30 hover:border-teal-400/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100">
                  6. 시작 & 대기 설정
                </span>
                <Zap className="w-4 h-4 text-teal-500" />
              </div>
              <p className="text-[11px] text-[#86868B] leading-snug">
                전원을 켰을 때부터 대기 상태까지 소다봇의 흐름을 설정해요.
              </p>

              {/* Sequence */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#5C5B57]">시작 순서 <span className="text-[#86868B] font-normal">(전원 켤 때)</span></label>
                {startSeq.map(seq => (
                  <div key={seq.id} className="flex items-center justify-between p-1.5 px-2.5 bg-[#FAF9F6] rounded-xl border border-[#EAE6DF] text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-teal-600 text-xs">{seq.id}</span>
                      <span className="text-xs">{seq.icon}</span>
                      <span className="text-[11px] font-semibold text-[#1D1D1F]">{seq.text}</span>
                    </div>
                    <Layers className="w-3.5 h-3.5 text-[#86868B] cursor-grab" />
                  </div>
                ))}
              </div>

              {/* Standby Time */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#5C5B57]">대기 시간</label>
                <div className="relative">
                  <select 
                    value={standbyTime} 
                    onChange={(e) => setStandbyTime(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-xs font-bold text-[#1D1D1F] outline-none cursor-pointer appearance-none"
                  >
                    <option>15초</option>
                    <option>30초</option>
                    <option>1분</option>
                    <option>5분</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-[#86868B] absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>
            </div>

            <button 
              onClick={() => playBootSequence()}
              className="mt-6 w-full py-2.5 bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              시작 시퀀스 테스트 (2.0" LCD 재생)
            </button>
          </div>


          {/* Card 7: 데이터 & 시간 설정 */}
          <div className="bg-white border-2 border-orange-400/30 hover:border-orange-400/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-100">
                  7. 데이터 & 시간 설정
                </span>
                <Clock className="w-4 h-4 text-orange-500" />
              </div>
              <p className="text-[11px] text-[#86868B] leading-snug">
                Wi-Fi 연결 정보와 시간, 날씨 등 필요한 정보를 설정해요.
              </p>

              {/* Wi-Fi Input Box */}
              <div className="space-y-2 bg-[#FAF9F6] p-3 rounded-2xl border border-[#EAE6DF]">
                <span className="text-[10px] font-bold text-[#1D1D1F] flex items-center gap-1">
                  <Wifi className="w-3 h-3 text-orange-500" /> Wi-Fi 설정
                </span>
                <input 
                  type="text" 
                  value={wifiSsid}
                  onChange={(e) => setWifiSsid(e.target.value)}
                  placeholder="SSID"
                  className="w-full px-2.5 py-1 bg-white border border-[#EAE6DF] rounded-lg text-xs font-mono"
                />
                <input 
                  type="password" 
                  value={wifiPass}
                  onChange={(e) => setWifiPass(e.target.value)}
                  placeholder="비밀번호"
                  className="w-full px-2.5 py-1 bg-white border border-[#EAE6DF] rounded-lg text-xs font-mono"
                />
              </div>

              {/* Time & Sync */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#5C5B57]">시간/날짜 자동 동기화</span>
                  <input 
                    type="checkbox" 
                    checked={autoSync}
                    onChange={(e) => setAutoSync(e.target.checked)}
                    className="accent-orange-500 w-4 h-4 cursor-pointer" 
                  />
                </div>
                <select 
                  value={timezone} 
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full p-1.5 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-[11px] font-medium"
                >
                  <option>서울, 대한민국 (GMT+9)</option>
                  <option>도쿄, 일본 (GMT+9)</option>
                  <option>뉴욕, 미국 (GMT-5)</option>
                </select>

                <div>
                  <label className="text-[10px] font-bold text-[#5C5B57]">위치 (날씨용)</label>
                  <select 
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full mt-1 p-1.5 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-[11px] font-medium"
                  >
                    <option>서울특별시</option>
                    <option>부산광역시</option>
                    <option>인천광역시</option>
                  </select>
                </div>
              </div>
            </div>

            <button 
              onClick={() => showToast('Wi-Fi 및 네트워크 설정이 저장되었습니다!')}
              className="mt-6 w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              저장
            </button>
          </div>


          {/* Card 8: 백업 & 공유 */}
          <div className="bg-white border-2 border-emerald-500/30 hover:border-emerald-500/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                  8. 백업 & 공유
                </span>
                <Share2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-[11px] text-[#86868B] leading-snug">
                내 소다봇 설정을 백업하거나 다른 사람과 공유할 수 있어요.
              </p>

              {/* Action links */}
              <div className="space-y-2">
                <button 
                  onClick={handleExportConfig}
                  className="w-full p-2.5 bg-[#FAF9F6] hover:bg-emerald-50/50 rounded-xl border border-[#EAE6DF] flex items-center gap-2 text-left group transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="text-[11px] font-bold text-[#1D1D1F]">현재 설정 백업</div>
                    <div className="text-[9px] text-[#86868B]">파일로 다운로드 (JSON)</div>
                  </div>
                </button>

                <label className="w-full p-2.5 bg-[#FAF9F6] hover:bg-emerald-50/50 rounded-xl border border-[#EAE6DF] flex items-center gap-2 text-left group transition-colors cursor-pointer">
                  <Upload className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="text-[11px] font-bold text-[#1D1D1F]">설정 불러오기</div>
                    <div className="text-[9px] text-[#86868B]">전에 저장한 설정 복원 (JSON)</div>
                  </div>
                  <input type="file" accept=".json" onChange={handleImportConfig} className="hidden" />
                </label>

                <button 
                  onClick={() => showToast('공유용 소다봇 설정 데이터 패키지를 생성하는 중...')}
                  className="w-full p-2 bg-[#FAF9F6] hover:bg-emerald-50/50 rounded-xl border border-[#EAE6DF] flex items-center gap-2 text-left transition-colors cursor-pointer"
                >
                  <Bot className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[11px] font-semibold text-[#1D1D1F]">다른 소다봇에 보내기</span>
                </button>

                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    showToast('소다봇 설정 공유 링크가 클립보드에 복사되었습니다!');
                  }}
                  className="w-full p-2 bg-[#FAF9F6] hover:bg-emerald-50/50 rounded-xl border border-[#EAE6DF] flex items-center gap-2 text-left transition-colors cursor-pointer"
                >
                  <Link className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[11px] font-semibold text-[#1D1D1F]">공유 링크 만들기</span>
                </button>
              </div>
            </div>

            <button 
              onClick={() => showToast('전체 소다봇 설정 백업본이 성공적으로 생성되었습니다!')}
              className="mt-6 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              백업하기
            </button>
          </div>

        </div>


        {/* Card 9: 소다봇 연결 & 상태 (Full Width Bottom Dashboard) */}
        <div className="bg-white border-2 border-indigo-400/30 hover:border-indigo-400/60 rounded-3xl p-6 shadow-sm space-y-6">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#EAE6DF] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#1D1D1F] flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                  9. 소다봇 연결 & 상태
                </span>
                연결 상태를 확인하고, 펌웨어 업데이트와 센서 정보를 볼 수 있어요.
              </h3>
            </div>
            <span className="text-[11px] text-[#86868B] font-mono">최종 동기화: {new Date().toLocaleTimeString()}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">

            {/* Col 1: Connection Status */}
            <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-[#EAE6DF] space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#86868B]">연결 상태</span>
                <div className="flex items-center gap-2 mt-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <span className="text-sm font-bold text-emerald-600">{connectionType === 'none' ? '미연결' : '⚡ 연결됨'}</span>
                </div>
              </div>
              <button 
                onClick={() => { sodabotTransport.disconnect(); showToast('소다봇 연결을 해제했습니다.'); }}
                className="w-full py-1.5 bg-white border border-[#EAE6DF] text-xs font-semibold text-[#5C5B57] hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-colors"
              >
                연결 해제
              </button>
            </div>

            {/* Col 2: Battery */}
            <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-[#EAE6DF] space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#86868B]">배터리</span>
                <div className="flex items-center gap-3 mt-2">
                  <div className="w-8 h-12 border-2 border-emerald-500 rounded-lg p-0.5 flex flex-col justify-end relative">
                    <div className="w-full bg-emerald-500 rounded-sm" style={{ height: '85%' }}></div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-[#1D1D1F] font-mono">85%</div>
                    <div className="text-[9px] text-emerald-600 font-semibold">정상 작동 중</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Col 3: Firmware & Storage */}
            <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-[#EAE6DF] space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center text-[10px] text-[#86868B] font-bold">
                  <span>펌웨어 버전</span>
                  <span className="font-mono text-[#1D1D1F]">v1.2.3</span>
                </div>
                <button className="mt-1 w-full py-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100">
                  업데이트 확인
                </button>
              </div>

              <div>
                <div className="flex justify-between items-center text-[10px] text-[#86868B] font-bold">
                  <span>저장 공간</span>
                  <span className="font-mono text-[#1D1D1F]">72% 사용 중</span>
                </div>
                <div className="w-full h-1.5 bg-[#EAE6DF] rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-indigo-500" style={{ width: '72%' }}></div>
                </div>
              </div>
            </div>

            {/* Col 4: Sensor Info */}
            <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-[#EAE6DF] space-y-2">
              <span className="text-[10px] font-bold text-[#86868B]">센서 정보</span>
              <div className="space-y-1.5 pt-1 text-xs font-mono font-semibold">
                <div className="flex items-center justify-between text-rose-600">
                  <span className="flex items-center gap-1 text-[11px]"><Thermometer className="w-3.5 h-3.5" /> 온도</span>
                  <span>26.5°C</span>
                </div>
                <div className="flex items-center justify-between text-blue-600">
                  <span className="flex items-center gap-1 text-[11px]"><Droplets className="w-3.5 h-3.5" /> 습도</span>
                  <span>48%</span>
                </div>
                <div className="flex items-center justify-between text-amber-600">
                  <span className="flex items-center gap-1 text-[11px]"><Sun className="w-3.5 h-3.5" /> 조도</span>
                  <span>320 lux</span>
                </div>
              </div>
            </div>

            {/* Col 5: Recent Logs */}
            <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-[#EAE6DF] space-y-2">
              <span className="text-[10px] font-bold text-[#86868B]">최근 활동</span>
              <div className="space-y-1 text-[10px] text-[#5C5B57] font-mono">
                <div className="flex items-center gap-1 truncate">
                  <span className="text-emerald-500 font-bold">•</span> 14:30 표정 전송 완료
                </div>
                <div className="flex items-center gap-1 truncate">
                  <span className="text-purple-500 font-bold">•</span> 14:28 소리 전송 완료
                </div>
                <div className="flex items-center gap-1 truncate">
                  <span className="text-blue-500 font-bold">•</span> 14:25 WebSocket 연결
                </div>
              </div>
            </div>

            {/* Col 6: Help & Support */}
            <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-[#EAE6DF] space-y-2 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-[#86868B]">도움말</span>
              <div className="space-y-1.5 text-[11px] font-semibold text-[#1D1D1F]">
                <a href="#guide" className="flex items-center gap-1.5 hover:text-indigo-600">
                  <FileText className="w-3.5 h-3.5 text-[#86868B]" /> 사용 가이드 보기
                </a>
                <a href="#faq" className="flex items-center gap-1.5 hover:text-indigo-600">
                  <HelpCircle className="w-3.5 h-3.5 text-[#86868B]" /> 자주 묻는 질문
                </a>
                <a href="#support" className="flex items-center gap-1.5 hover:text-indigo-600">
                  <MessageCircle className="w-3.5 h-3.5 text-[#86868B]" /> 문의하기
                </a>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Credit Note */}
        <div className="text-center text-xs text-[#86868B] font-mono pt-4">
          🚀 소다톡은 계속 업데이트됩니다. 더 많은 기능으로 소다봇을 나답게 만들어 보세요!
        </div>

      </div>

      {/* ── Custom Welcome Screen Studio Modal ────────────────────────────────────── */}
      {showWelcomeStudio && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#EAE6DF] rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto font-sans">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#EAE6DF] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-lg">
                  ✨
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1D1D1F]">나만의 환영화면 스튜디오</h3>
                  <p className="text-xs text-[#86868B]">부팅 시 소다봇 2.0" LCD 화면에 표시될 개성 있는 환영 연출을 만드세요.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowWelcomeStudio(false)}
                className="w-8 h-8 rounded-full bg-[#FAF9F6] border border-[#EAE6DF] hover:bg-[#EAE6DF] flex items-center justify-center text-xs text-[#5C5B57] transition-colors"
              >
                ✕
              </button>
            </div>

            {/* 320x240 Live Canvas Display Simulator inside Modal */}
            <div className="flex flex-col items-center justify-center space-y-2 bg-[#FAF9F6] p-4 rounded-2xl border border-[#EAE6DF]">
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                2.0" LCD (320x240) 환영화면 캔버스 미리보기
              </span>

              <div 
                className={`w-72 h-52 border-4 border-slate-700 rounded-2xl p-4 flex flex-col justify-between items-center relative overflow-hidden shadow-2xl transition-all duration-500`}
                style={{
                  background: studioTheme === 'starry' 
                    ? 'radial-gradient(circle at center, #1e1b4b 0%, #09090b 100%)' 
                    : studioTheme === 'neon'
                    ? 'linear-gradient(135deg, #0284c7 0%, #0f172a 100%)'
                    : studioTheme === 'sunset'
                    ? 'linear-gradient(135deg, #be185d 0%, #312e81 100%)'
                    : 'linear-gradient(135deg, #047857 0%, #064e3b 100%)'
                }}
              >
                {/* Background Particle Effects */}
                <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>

                {/* Top Status */}
                <div className="w-full flex justify-between text-[9px] font-mono text-white/70 z-10">
                  <span>SODA_LAB</span>
                  <span>WELCOME!</span>
                </div>

                {/* Mascot Eyes */}
                <div className="flex items-center gap-6 z-10">
                  {studioMascot === 'happy' && (
                    <>
                      <div className="w-12 h-10 border-t-8 border-cyan-300 rounded-t-full transform -rotate-12"></div>
                      <div className="w-12 h-10 border-t-8 border-cyan-300 rounded-t-full transform rotate-12"></div>
                    </>
                  )}
                  {studioMascot === 'heart' && (
                    <div className="text-4xl animate-bounce">😍</div>
                  )}
                  {studioMascot === 'sunglasses' && (
                    <div className="text-4xl">😎</div>
                  )}
                  {studioMascot === 'cat' && (
                    <div className="text-4xl">🐱</div>
                  )}
                  {studioMascot === 'default' && (
                    <>
                      <div className="w-12 h-12 bg-cyan-300 rounded-full shadow-[0_0_12px_rgba(103,232,249,0.8)]"></div>
                      <div className="w-12 h-12 bg-cyan-300 rounded-full shadow-[0_0_12px_rgba(103,232,249,0.8)]"></div>
                    </>
                  )}
                </div>

                {/* Custom Welcome Message Lines */}
                <div className="w-full text-center z-10 font-bold whitespace-pre-line text-xs leading-relaxed" style={{ color: studioColor }}>
                  {studioText}
                </div>
              </div>
            </div>

            {/* Studio Customization Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              
              {/* Option 1: Welcome Text */}
              <div className="space-y-1.5">
                <label className="font-bold text-[#1D1D1F]">1. 환영 문구 편집</label>
                <textarea 
                  value={studioText}
                  onChange={(e) => setStudioText(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl outline-none focus:bg-white focus:border-blue-400 font-sans leading-relaxed text-xs"
                />
              </div>

              {/* Option 2: Background Theme */}
              <div className="space-y-1.5">
                <label className="font-bold text-[#1D1D1F]">2. 배경 테마 선택</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'starry', name: '🌌 은하수 우주' },
                    { id: 'neon', name: '⚡ 네온 사이버' },
                    { id: 'sunset', name: '🌅 핑크 석양' },
                    { id: 'emerald', name: '🌿 에메랄드' },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setStudioTheme(t.id as any)}
                      className={`p-2 rounded-xl border text-[11px] font-bold text-left transition-all ${studioTheme === t.id ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-[#EAE6DF] bg-white hover:border-blue-200'}`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Option 3: Mascot Character */}
              <div className="space-y-1.5">
                <label className="font-bold text-[#1D1D1F]">3. 마스코트 표정</label>
                <div className="flex gap-2">
                  {[
                    { id: 'happy', emoji: '😆' },
                    { id: 'heart', emoji: '😍' },
                    { id: 'sunglasses', emoji: '😎' },
                    { id: 'cat', emoji: '🐱' },
                    { id: 'default', emoji: '🤖' },
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => setStudioMascot(m.id)}
                      className={`flex-1 py-2 rounded-xl border text-xl flex items-center justify-center transition-all ${studioMascot === m.id ? 'border-blue-500 bg-blue-50 scale-110 shadow-sm' : 'border-[#EAE6DF] bg-white hover:border-blue-200'}`}
                    >
                      {m.emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Option 4: Text Color */}
              <div className="space-y-1.5">
                <label className="font-bold text-[#1D1D1F]">4. 문구 글자 색상</label>
                <div className="flex gap-2">
                  {[
                    { color: '#22D3EE', name: '시안' },
                    { color: '#FACC15', name: '옐로우' },
                    { color: '#34D399', name: '민트' },
                    { color: '#F472B6', name: '핑크' },
                    { color: '#FFFFFF', name: '화이트' },
                  ].map(c => (
                    <button
                      key={c.color}
                      onClick={() => setStudioColor(c.color)}
                      className={`flex-1 py-2 rounded-xl border transition-all flex items-center justify-center ${studioColor === c.color ? 'ring-2 ring-blue-500 scale-105' : ''}`}
                      style={{ backgroundColor: c.color }}
                      title={c.name}
                    >
                      <span className="w-2 h-2 rounded-full bg-slate-900/30"></span>
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 border-t border-[#EAE6DF] pt-4">
              <button 
                onClick={() => setShowWelcomeStudio(false)}
                className="flex-1 py-2.5 bg-[#FAF9F6] border border-[#EAE6DF] text-[#5C5B57] text-xs font-bold rounded-xl hover:bg-[#EAE6DF] transition-colors"
              >
                취소
              </button>
              <button 
                onClick={() => {
                  setWelcomeMsg(studioText);
                  setShowWelcomeStudio(false);
                  showToast('✨ 나만의 맞춤 환영화면이 생성되어 소다봇으로 전송되었습니다!');
                }}
                className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                소다봇에 환영화면 적용 및 저장
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal 2: Custom Expression Studio Editor (showExprEditor - 2 Modes) */}
      {showExprEditor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#EAE6DF] rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[94vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#EAE6DF] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 text-lg font-bold">
                  🎨
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1D1D1F]">나만의 표정 편집기 (Expression Studio)</h3>
                  <p className="text-[11px] text-[#86868B]">기존 표정을 불러와 정밀하게 다듬거나, 픽셀 캔버스에 자유롭게 그려보세요!</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowExprEditor(false)}
                className="w-7 h-7 rounded-full bg-[#FAF9F6] border border-[#EAE6DF] flex items-center justify-center text-xs text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex bg-[#FAF9F6] p-1 rounded-2xl border border-[#EAE6DF] text-xs font-bold">
              <button 
                type="button"
                onClick={() => setEditorTab('slider')}
                className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${editorTab === 'slider' ? 'bg-white text-amber-700 shadow-sm' : 'text-[#86868B]'}`}
              >
                🎛️ 정밀 파라미터 미세 조율 (표정 가져오기)
              </button>
              <button 
                type="button"
                onClick={() => setEditorTab('pixel')}
                className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${editorTab === 'pixel' ? 'bg-white text-amber-700 shadow-sm' : 'text-[#86868B]'}`}
              >
                ✍️ 픽셀 자유 드로잉 캔버스
              </button>
            </div>

            {/* 320x240 LCD Screen Live Preview (100% Exact 1:1 Hardware Pixel-Perfect Match) */}
            <div className="flex flex-col items-center gap-2 bg-[#090D16] p-3.5 rounded-2xl border-4 border-[#374151] shadow-inner select-none relative overflow-hidden">
              <div className="text-[10px] font-mono text-cyan-400 self-start opacity-80 flex items-center justify-between w-full">
                <span>2.0" LCD PREVIEW (320x240): <strong className="text-amber-400">{editName} ({editEmoji})</strong></span>
                <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  1:1 HARDWARE ACCURATE
                </span>
              </div>

              {/* 320x240 Exact Ratio Display Frame */}
              <div className="w-full max-w-[340px] aspect-[4/3] bg-[#000000] rounded-lg border border-cyan-950/60 shadow-inner relative flex items-center justify-center overflow-hidden">
                {editorTab === 'pixel' ? (
                  /* Mode 1: 16x16 Pixel Grid Rendering */
                  <div className="grid grid-cols-16 gap-[1.5px] bg-[#000000] p-2 rounded">
                    {pixelGrid.map((color, idx) => (
                      <div 
                        key={idx}
                        style={{ backgroundColor: color }}
                        className="w-3.5 h-3.5 rounded-[1px] transition-colors"
                      />
                    ))}
                  </div>
                ) : (
                  /* Mode 2: SVG Rendering Matching Firmware C++ Code 1:1 */
                  <svg viewBox="0 0 320 240" className="w-full h-full">
                    {/* Background */}
                    <rect width="320" height="240" fill="#000000" />

                    {/* 1. Eyebrows (눈썹) */}
                    {eyebrowTilt !== 0 && editShape !== 'cat' && (
                      <g>
                        {/* Left Brow: LEX(100) - ew/2, browY - tiltOffset */}
                        <rect 
                          x={100 - eyeWidth / 2} 
                          y={120 - eyeHeight / 2 - 12 - Math.max(-15, Math.min(15, eyebrowTilt / 3))} 
                          width={eyeWidth} 
                          height={6} 
                          rx={3} 
                          fill={editColor} 
                        />
                        {/* Right Brow: REX(220) - ew/2, browY + tiltOffset */}
                        <rect 
                          x={220 - eyeWidth / 2} 
                          y={120 - eyeHeight / 2 - 12 + Math.max(-15, Math.min(15, eyebrowTilt / 3))} 
                          width={eyeWidth} 
                          height={6} 
                          rx={3} 
                          fill={editColor} 
                        />
                      </g>
                    )}

                    {/* 2. Eyes (눈 렌더링) */}
                    {editShape === 'happy' ? (
                      /* Happy: Thick Arches */
                      <g fill="none" stroke={editColor} strokeWidth="12" strokeLinecap="round">
                        <path d={`M ${100 - 36 + pupilX} ${132 + pupilY} A 36 36 0 0 1 ${100 + 36 + pupilX} ${132 + pupilY}`} />
                        <path d={`M ${220 - 36 + pupilX} ${132 + pupilY} A 36 36 0 0 1 ${220 + 36 + pupilX} ${132 + pupilY}`} />
                      </g>
                    ) : editShape === 'wink' ? (
                      /* Wink: Left Line, Right Round Eye */
                      <g>
                        <rect x={100 - 36} y={120 - 4} width={72} height={8} rx={4} fill={editColor} />
                        <rect 
                          x={220 - eyeWidth / 2 + pupilX} 
                          y={120 - eyeHeight / 2 + pupilY} 
                          width={eyeWidth} 
                          height={eyeHeight} 
                          rx={eyeRadius} 
                          fill={editColor} 
                        />
                      </g>
                    ) : editShape === 'sleepy' ? (
                      /* Sleepy: Top Half Masked Eyes */
                      <g>
                        <rect 
                          x={100 - eyeWidth / 2 + pupilX} 
                          y={120 - eyeHeight / 2 + pupilY} 
                          width={eyeWidth} 
                          height={eyeHeight} 
                          rx={eyeRadius} 
                          fill={editColor} 
                        />
                        <rect 
                          x={220 - eyeWidth / 2 + pupilX} 
                          y={120 - eyeHeight / 2 + pupilY} 
                          width={eyeWidth} 
                          height={eyeHeight} 
                          rx={eyeRadius} 
                          fill={editColor} 
                        />
                        {/* Mask Top Half */}
                        <rect x={100 - eyeWidth / 2 - 2} y={120 - eyeHeight / 2 - 2} width={eyeWidth + 4} height={eyeHeight / 2} fill="#000000" />
                        <rect x={220 - eyeWidth / 2 - 2} y={120 - eyeHeight / 2 - 2} width={eyeWidth + 4} height={eyeHeight / 2} fill="#000000" />
                      </g>
                    ) : editShape === 'heart' ? (
                      /* Heart: Dual Hearts */
                      <g fill={editColor === '#22D3EE' ? '#FF3264' : editColor}>
                        {/* Left Heart */}
                        <circle cx={100 - 18 + pupilX} cy={120 - 20 + pupilY} r={19} />
                        <circle cx={100 + 18 + pupilX} cy={120 - 20 + pupilY} r={19} />
                        <polygon points={`${100 - 36 + pupilX},${120 - 14 + pupilY} ${100 + 36 + pupilX},${120 - 14 + pupilY} ${100 + pupilX},${120 + 26 + pupilY}`} />
                        {/* Right Heart */}
                        <circle cx={220 - 18 + pupilX} cy={120 - 20 + pupilY} r={19} />
                        <circle cx={220 + 18 + pupilX} cy={120 - 20 + pupilY} r={19} />
                        <polygon points={`${220 - 36 + pupilX},${120 - 14 + pupilY} ${220 + 36 + pupilX},${120 - 14 + pupilY} ${220 + pupilX},${120 + 26 + pupilY}`} />
                      </g>
                    ) : editShape === 'angry' ? (
                      /* Angry: Upper Corner Masked */
                      <g>
                        <rect 
                          x={100 - eyeWidth / 2 + pupilX} 
                          y={120 - eyeHeight / 2 + pupilY} 
                          width={eyeWidth} 
                          height={eyeHeight} 
                          rx={eyeRadius} 
                          fill={editColor} 
                        />
                        <rect 
                          x={220 - eyeWidth / 2 + pupilX} 
                          y={120 - eyeHeight / 2 + pupilY} 
                          width={eyeWidth} 
                          height={eyeHeight} 
                          rx={eyeRadius} 
                          fill={editColor} 
                        />
                        {/* Upper Angled Cuts */}
                        <polygon points={`${100 - eyeWidth / 2},${120 - eyeHeight / 2} ${100 + eyeWidth / 2},${120 - eyeHeight / 2} ${100 + eyeWidth / 2},${120 - eyeHeight / 2 + 25}`} fill="#000000" />
                        <polygon points={`${220 - eyeWidth / 2},${120 - eyeHeight / 2} ${220 + eyeWidth / 2},${120 - eyeHeight / 2} ${220 - eyeWidth / 2},${120 - eyeHeight / 2 + 25}`} fill="#000000" />
                      </g>
                    ) : editShape === 'cat' ? (
                      /* Cat: Arches + Whiskers + Nose */
                      <g>
                        <g fill="none" stroke={editColor} strokeWidth="10" strokeLinecap="round">
                          <path d="M 64 132 A 36 36 0 0 1 136 132" />
                          <path d="M 184 132 A 36 36 0 0 1 256 132" />
                        </g>
                        {/* Nose */}
                        <polygon points="160,142 153,154 167,154" fill={editColor} />
                        {/* Cat Mouth (w) */}
                        <g fill="none" stroke={editColor} strokeWidth="3">
                          <path d="M 140 156 A 8 8 0 0 0 160 156" />
                          <path d="M 160 156 A 8 8 0 0 0 180 156" />
                        </g>
                        {/* Pink Cheeks */}
                        <circle cx={55} cy={146} r={10} fill="#FF82AA" />
                        <circle cx={265} cy={146} r={10} fill="#FF82AA" />
                        {/* Whiskers */}
                        <line x1={35} y1={135} x2={59} y2={135} stroke={editColor} strokeWidth="2" />
                        <line x1={40} y1={148} x2={62} y2={148} stroke={editColor} strokeWidth="2" />
                        <line x1={261} y1={135} x2={285} y2={135} stroke={editColor} strokeWidth="2" />
                        <line x1={258} y1={148} x2={280} y2={148} stroke={editColor} strokeWidth="2" />
                      </g>
                    ) : (
                      /* Default / Pupil / Custom Eyes */
                      <g>
                        <rect 
                          x={100 - eyeWidth / 2 + pupilX} 
                          y={120 - eyeHeight / 2 + pupilY} 
                          width={eyeWidth} 
                          height={eyeHeight} 
                          rx={eyeRadius} 
                          fill={editColor} 
                        />
                        <rect 
                          x={220 - eyeWidth / 2 + pupilX} 
                          y={120 - eyeHeight / 2 + pupilY} 
                          width={eyeWidth} 
                          height={eyeHeight} 
                          rx={eyeRadius} 
                          fill={editColor} 
                        />
                      </g>
                    )}

                    {/* 3. Gloss Highlights (광택) */}
                    {hasGloss && editShape !== 'heart' && editShape !== 'happy' && editShape !== 'cat' && (
                      <g fill="#FFFFFF">
                        <circle cx={100 - eyeWidth / 4 + pupilX} cy={120 - eyeHeight / 4 + pupilY} r={5} />
                        <circle cx={220 - eyeWidth / 4 + pupilX} cy={120 - eyeHeight / 4 + pupilY} r={5} />
                      </g>
                    )}

                    {/* 4. Sparkles (반짝이 별) */}
                    {hasSparkle && (
                      <g fill="#FFDC64" fontSize="24" fontFamily="monospace" fontWeight="bold">
                        <text x={100 + 36} y={120 - 36}>*</text>
                        <text x={220 + 36} y={120 - 36}>*</text>
                      </g>
                    )}

                    {/* 5. Mouth (입 모양) */}
                    {editShape !== 'cat' && editMouth !== 'none' && (
                      <g>
                        {editMouth === 'smile' && (
                          <path d="M 136 155 A 24 24 0 0 0 184 155" fill="none" stroke={editColor} strokeWidth="5" strokeLinecap="round" />
                        )}
                        {editMouth === 'open' && (
                          <rect x={145} y={150} width={30} height={18} rx={8} fill={editColor} />
                        )}
                        {editMouth === 'cat' && (
                          <g fill="none" stroke={editColor} strokeWidth="3">
                            <path d="M 140 156 A 8 8 0 0 0 160 156" />
                            <path d="M 160 156 A 8 8 0 0 0 180 156" />
                          </g>
                        )}
                        {editMouth === 'tongue' && (
                          <rect x={148} y={152} width={24} height={14} rx={6} fill="#FF6496" />
                        )}
                      </g>
                    )}

                  </svg>
                )}
              </div>
            </div>

            {/* Editor Mode 1: 16x16 Pixel Drawing Board */}
            {editorTab === 'pixel' ? (
              <div className="space-y-4 text-xs">
                
                {/* Palette & Tools */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FAF9F6] p-2.5 rounded-2xl border border-[#EAE6DF]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[#1D1D1F] mr-1">팔레트:</span>
                    {['#22D3EE', '#F59E0B', '#10B981', '#F43F5E', '#8B5CF6', '#FFFFFF', '#090D16'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setDrawColor(c)}
                        className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${drawColor === c ? 'ring-2 ring-amber-500 scale-110' : ''}`}
                        style={{ backgroundColor: c }}
                        title={c === '#090D16' ? '지우개' : c}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsMirror(!isMirror)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${isMirror ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-[#EAE6DF] text-[#86868B]'}`}
                    >
                      🔄 좌우대칭 {isMirror ? 'ON' : 'OFF'}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearPixelGrid}
                      className="px-2 py-1 bg-white hover:bg-rose-50 border border-[#EAE6DF] text-rose-600 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      🧹 전체지우기
                    </button>
                  </div>
                </div>

                {/* 16x16 Drawing Grid */}
                <div className="flex flex-col items-center">
                  <div className="text-[10px] text-[#86868B] mb-1 font-mono">마우스로 클릭하거나 드래그하여 픽셀 도안을 그려보세요</div>
                  <div 
                    onMouseDown={() => setIsMouseDown(true)}
                    onMouseUp={() => setIsMouseDown(false)}
                    onMouseLeave={() => setIsMouseDown(false)}
                    className="grid grid-cols-16 gap-[1.5px] bg-[#374151] p-2 rounded-xl border border-[#4B5563] shadow-md select-none cursor-crosshair"
                  >
                    {pixelGrid.map((color, idx) => (
                      <div
                        key={idx}
                        onMouseDown={() => handlePixelClick(idx)}
                        onMouseEnter={() => { if (isMouseDown) handlePixelClick(idx); }}
                        style={{ backgroundColor: color }}
                        className="w-4 h-4 rounded-[1.5px] hover:opacity-80 transition-all border border-white/5"
                      />
                    ))}
                  </div>
                </div>

                {/* Preset Load Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="font-bold text-[#1D1D1F] text-[11px]">도안 추천:</span>
                  <button type="button" onClick={() => handleLoadPixelPreset('heart')} className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold border border-rose-200 cursor-pointer">
                    ❤️ 하트 픽셀
                  </button>
                  <button type="button" onClick={() => handleLoadPixelPreset('star')} className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-[10px] font-bold border border-amber-200 cursor-pointer">
                    ⭐ 별 픽셀
                  </button>
                </div>

              </div>
            ) : (
              /* Editor Mode 2: Fine-Tuning Parameter Sliders with Base Preset Importer */
              <div className="space-y-4 text-xs">
                
                {/* 1. Base Preset Importer (기존 기본 표정 불러오기) */}
                <div className="bg-[#FAF9F6] p-3 rounded-2xl border border-[#EAE6DF] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-[#1D1D1F] flex items-center gap-1.5">
                      <span className="text-amber-500">📥</span> 1. 기존 기본 표정 불러오기 (평면 모드)
                    </label>
                    <span className="text-[10px] text-[#86868B]">클릭 시 기본 평면 형태를 가져옵니다</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { id: 'default', label: '기본', emoji: '🤖' },
                      { id: 'happy', label: '기쁨', emoji: '😆' },
                      { id: 'angry', label: '화남', emoji: '😡' },
                      { id: 'sad', label: '슬픔', emoji: '😢' },
                      { id: 'sleepy', label: '졸림', emoji: '😴' },
                      { id: 'surprised', label: '놀람', emoji: '😲' },
                      { id: 'wink', label: '윙크', emoji: '😉' },
                      { id: 'heart', label: '하트눈', emoji: '💖' },
                      { id: 'pupil', label: '초롱이', emoji: '👀' },
                      { id: 'cat', label: '고양이', emoji: '🐱' },
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleLoadBaseExpression(p.id)}
                        className={`py-1.5 px-2 rounded-xl font-bold text-[11px] border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          editShape === p.id 
                            ? 'bg-amber-100 border-amber-400 text-amber-900 shadow-sm' 
                            : 'bg-white hover:bg-amber-50/50 border-[#EAE6DF] text-[#5C5B57]'
                        }`}
                      >
                        <span>{p.emoji}</span>
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Name & Emoji & Color */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="font-bold text-[#1D1D1F]">표정 이름</label>
                    <input 
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="예: 초롱이, 앙칼진눈"
                      className="w-full p-2 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl outline-none focus:bg-white focus:border-amber-400 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-[#1D1D1F]">대표 이모지</label>
                    <select 
                      value={editEmoji}
                      onChange={(e) => setEditEmoji(e.target.value)}
                      className="w-full p-2 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl outline-none focus:bg-white font-bold cursor-pointer"
                    >
                      {['🥹', '😜', '🤩', '💖', '😈', '😭', '🐶', '🦄', '⭐', '✨', '🤖', '😆', '😡', '😢', '😴', '😲', '😉', '👀', '🐱'].map(e => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-[#1D1D1F]">눈 색상</label>
                    <div className="flex items-center gap-1.5 p-1 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl h-[38px]">
                      {['#22D3EE', '#F59E0B', '#10B981', '#F43F5E', '#8B5CF6', '#FFFFFF'].map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditColor(c)}
                          className={`flex-1 h-6 rounded-lg transition-all cursor-pointer ${editColor === c ? 'ring-2 ring-amber-500 scale-105 shadow-sm' : 'opacity-80'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Shape & Mouth Selectors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="font-bold text-[#1D1D1F]">기본 눈 모양 (Shape)</label>
                    <select
                      value={editShape}
                      onChange={(e: any) => setEditShape(e.target.value)}
                      className="w-full p-2 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl outline-none focus:bg-white font-bold cursor-pointer"
                    >
                      <option value="default">기본 사각 (Default)</option>
                      <option value="happy">웃는 눈 (Happy Arch)</option>
                      <option value="angry">화난 눈 (Angry Tilt)</option>
                      <option value="sad">슬픈 눈 (Sad Tilt)</option>
                      <option value="sleepy">졸린 눈 (Sleepy Flat)</option>
                      <option value="surprised">놀란 눈 (Surprised Circle)</option>
                      <option value="wink">윙크 (Wink)</option>
                      <option value="heart">하트 (Heart)</option>
                      <option value="cat">고양이 (Cat)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-[#1D1D1F]">입 모양 (Mouth)</label>
                    <select
                      value={editMouth}
                      onChange={(e: any) => setEditMouth(e.target.value)}
                      className="w-full p-2 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl outline-none focus:bg-white font-bold cursor-pointer"
                    >
                      <option value="none">없음 (None)</option>
                      <option value="smile">미소 (◡ Smile)</option>
                      <option value="open">벌림 (o Open)</option>
                      <option value="cat">고양이 (▲ w ▲ Cat)</option>
                      <option value="tongue">메롱 (👅 Tongue)</option>
                    </select>
                  </div>
                </div>

                {/* 4. Fine-Tuning Sliders Grid */}
                <div className="grid grid-cols-2 gap-3 bg-[#FAF9F6] p-3.5 rounded-2xl border border-[#EAE6DF]">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span>눈 가로 폭</span>
                      <span className="font-mono text-amber-600">{eyeWidth}px</span>
                    </div>
                    <input type="range" min={40} max={110} value={eyeWidth} onChange={e => setEyeWidth(+e.target.value)} className="w-full accent-amber-500 cursor-pointer" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span>눈 세로 높이</span>
                      <span className="font-mono text-amber-600">{eyeHeight}px</span>
                    </div>
                    <input type="range" min={20} max={90} value={eyeHeight} onChange={e => setEyeHeight(+e.target.value)} className="w-full accent-amber-500 cursor-pointer" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span>동공 좌우 위치 (Pupil X)</span>
                      <span className="font-mono text-amber-600">{pupilX}px</span>
                    </div>
                    <input type="range" min={-20} max={20} value={pupilX} onChange={e => setPupilX(+e.target.value)} className="w-full accent-amber-500 cursor-pointer" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span>동공 상하 위치 (Pupil Y)</span>
                      <span className="font-mono text-amber-600">{pupilY}px</span>
                    </div>
                    <input type="range" min={-20} max={20} value={pupilY} onChange={e => setPupilY(+e.target.value)} className="w-full accent-amber-500 cursor-pointer" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span>눈썹 사선 각도</span>
                      <span className="font-mono text-amber-600">{eyebrowTilt}°</span>
                    </div>
                    <input type="range" min={-45} max={45} value={eyebrowTilt} onChange={e => setEyebrowTilt(+e.target.value)} className="w-full accent-amber-500 cursor-pointer" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span>모서리 둥글기 (Radius)</span>
                      <span className="font-mono text-amber-600">{eyeRadius}px</span>
                    </div>
                    <input type="range" min={0} max={35} value={eyeRadius} onChange={e => setEyeRadius(+e.target.value)} className="w-full accent-amber-500 cursor-pointer" />
                  </div>
                </div>

                {/* 5. Overlays (반짝이 & 광택) */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setHasSparkle(!hasSparkle)}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${hasSparkle ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-[#EAE6DF] text-[#86868B]'}`}
                  >
                    ✨ 반짝이 오버레이 {hasSparkle ? 'ON' : 'OFF'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setHasGloss(!hasGloss)}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${hasGloss ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-[#EAE6DF] text-[#86868B]'}`}
                  >
                    💎 광택 하이라이트 {hasGloss ? 'ON' : 'OFF'}
                  </button>
                </div>

              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center gap-2 border-t border-[#EAE6DF] pt-4">
              <button 
                type="button"
                onClick={() => setShowExprEditor(false)}
                className="py-2.5 px-4 bg-[#FAF9F6] border border-[#EAE6DF] text-[#5C5B57] text-xs font-bold rounded-xl hover:bg-[#EAE6DF] transition-colors cursor-pointer"
              >
                취소
              </button>
              <button 
                type="button"
                onClick={() => {
                  if (editorTab === 'pixel') {
                    syncPixelsToHardware(pixelGrid);
                  } else {
                    syncFaceToHardware();
                  }
                  showToast('소다봇 화면으로 실시간 테스트 전송 완료!');
                }}
                className="flex-1 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-indigo-600" />
                소다봇 화면에 즉시 테스트 ⚡
              </button>
              <button 
                type="button"
                onClick={handleSaveCustomExpr}
                className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-500 text-amber-950 text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                나만의 표정 저장하기
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
