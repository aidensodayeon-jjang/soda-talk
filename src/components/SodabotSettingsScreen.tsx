import { sodabotTransport } from '../utils/sodabotTransport';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Edit3, Save, Smile, Volume2, Sparkles, Sliders, Play, Plus, 
  Wifi, Clock, MapPin, Download, Upload, Share2, Link, RefreshCw, 
  Check, Power, Battery, Cpu, HardDrive, Thermometer, Droplets, Sun, 
  ChevronRight, HelpCircle, MessageCircle, FileText, MoveUp, MoveDown,
  ChevronDown, Layers, ShieldCheck, Zap, Bluetooth, Usb, Trash2,
  Copy, Code
} from 'lucide-react';
import { 
  generateCustomFirmware, 
  validateCustomCode, 
  CustomCodeParts, 
  GeneratedFirmwareResult 
} from '../utils/sodabotFirmwareGenerator';

const expressionsList = [
  { id: 'default', label: '기본', emoji: '🤖', bg: 'bg-[#FAF9F6]' },
  { id: 'happy', label: '기쁨', emoji: '😆', bg: 'bg-amber-50' },
  { id: 'wink', label: '윙크', emoji: '😉', bg: 'bg-pink-50' },
  { id: 'heart', label: '하트', emoji: '💖', bg: 'bg-rose-50' },
  { id: 'sleepy', label: '졸림', emoji: '😴', bg: 'bg-indigo-50' },
  { id: 'sad', label: '슬픔', emoji: '😢', bg: 'bg-blue-50' },
  { id: 'angry', label: '화남', emoji: '😡', bg: 'bg-rose-50' },
  { id: 'surprised', label: '놀람', emoji: '😲', bg: 'bg-cyan-50' },
  { id: 'confused', label: '갸웃', emoji: '🤔', bg: 'bg-purple-50' },
  { id: 'pupil', label: '초롱', emoji: '👀', bg: 'bg-cyan-50' },
  { id: 'cat', label: '냥이', emoji: '🐱', bg: 'bg-yellow-50' },
  { id: 'idle', label: '평온', emoji: '😊', bg: 'bg-emerald-50' },
];

function buildGptCustomPrompt(featureDescription: string): string {
  const targetDesc = featureDescription.trim() || '인터넷에서 현재 시간을 가져와 SODABOT LCD 화면에 HH:MM 형식으로 표시하고 싶습니다.';

  return `나는 ESP32-S3 기반의 SODABOT에 새로운 기능을 추가하려고 합니다.

원하는 기능:
${targetDesc}

기존 SODABOT 펌웨어에 코드를 자동으로 합칠 예정이므로
반드시 아래 4개 파트로 나누어 코드를 작성해주세요.

1. HEADERS
필요한 #include 코드만 작성해주세요.

2. GLOBALS
전역 변수, 상수, 서버 주소, 설정값 등
함수 밖에 필요한 코드만 작성해주세요.

3. SETUP
기존 setup() 함수 안에 추가할 초기화 코드만 작성해주세요.
setup() 함수 전체를 새로 작성하지 마세요.

4. FUNCTION
실제 기능을 수행하는 함수 전체를 작성해주세요.

중요 규칙:
- ESP32-S3 Arduino 환경 기준으로 작성해주세요.
- setup() 전체를 만들지 마세요.
- loop() 전체를 만들지 마세요.
- 기존 SODABOT 펌웨어를 수정한다고 가정해주세요.
- 각 파트는 독립적으로 복사할 수 있게 구분해주세요.
- 필요하지 않은 파트는 "없음"이라고 표시해주세요.
- FUNCTION에는 실행 가능한 대표 함수가 최소 1개 있어야 합니다.
- 함수 이름은 기능을 이해하기 쉬운 이름으로 작성해주세요.
- 외부 라이브러리가 필요한 경우 HEADERS에 포함해주세요.
- Wi-Fi가 이미 연결되어 있다고 가정해도 됩니다.
- LCD 출력, 표정 출력, 소리 출력 등 SODABOT 전용 함수가 필요하다면
  임의로 함수명을 만들지 말고
  "SODABOT의 기존 출력 함수에 연결 필요"라고 주석으로 표시해주세요.
- 코드 뒤에는 각 파트가 어떤 역할을 하는지 한 줄씩 간단히 설명해주세요.

출력 형식은 반드시 다음과 같이 해주세요.

=== HEADERS ===
\`\`\`cpp
// 필요한 include (없으면 "없음")
\`\`\`

=== GLOBALS ===
\`\`\`cpp
// 전역 변수 / 상수
\`\`\`

=== SETUP ===
\`\`\`cpp
// setup() 내부에 들어갈 초기화 코드
\`\`\`

=== FUNCTION ===
\`\`\`cpp
// 실행 함수 정의
\`\`\``;
}

export default function SodabotSettingsScreen() {
  const [connectionType, setConnectionType] = useState(sodabotTransport.type);
  React.useEffect(() => {
    const update = () => setConnectionType(sodabotTransport.type);
    window.addEventListener('sodabot-status-changed', update);
    return () => window.removeEventListener('sodabot-status-changed', update);
  }, []);

  // State variables for interactive UI controls
  const [profileName, setProfileName] = useState(localStorage.getItem("sodabot_profile_name") || 'LUMI');
  const [profileDesc, setProfileDesc] = useState(localStorage.getItem("sodabot_profile_desc") || 'Your Smart AI Companion');
  const [startupPrompt, setStartupPrompt] = useState(localStorage.getItem("sodabot_startup_prompt") || 'Hello, I am Lumi! Ready to assist you.');
  const [exprTab, setExprTab] = useState<'basic' | 'custom'>('basic');
  const [defaultIdleExpr, setDefaultIdleExpr] = useState(localStorage.getItem('sodabot_default_idle_expr') || 'happy');
  const [selectedExpr, setSelectedExpr] = useState(() => localStorage.getItem('sodabot_default_idle_expr') || 'happy');

  // Custom Created Expression List State
  const [customExprList, setCustomExprList] = useState<Array<{
    id: string;
    label: string;
    emoji: string;
    mode: 'slider' | 'pixel';
    shape?: string;
    mouth?: string;
    color?: string;
    effect?: string;
    eyeWidth?: number;
    eyeHeight?: number;
    pupilX?: number;
    pupilY?: number;
    eyebrowTilt?: number;
    eyeRadius?: number;
    hasSparkle?: boolean;
    hasGloss?: boolean;
    pixelGrid?: string[];
  }>>(() => {
    try {
      const saved = localStorage.getItem("sodabot_custom_exprs");
      return saved ? JSON.parse(saved) : [
        { 
          id: 'custom_1', label: '울먹', emoji: '🥹', mode: 'slider',
          shape: 'happy', mouth: 'smile', color: '#38BDF8', effect: 'pulse',
          eyeWidth: 84, eyeHeight: 68, pupilX: 0, pupilY: 4, eyebrowTilt: 10, eyeRadius: 20, hasSparkle: true, hasGloss: true
        },
        { 
          id: 'custom_2', label: '메롱', emoji: '😜', mode: 'slider',
          shape: 'wink', mouth: 'tongue', color: '#F43F5E', effect: 'bounce',
          eyeWidth: 84, eyeHeight: 68, pupilX: 0, pupilY: 0, eyebrowTilt: 0, eyeRadius: 20, hasSparkle: false, hasGloss: false
        }
      ];
    } catch {
      return [];
    }
  });

  const [activeCustomFace, setActiveCustomFace] = useState<any>(() => {
    try {
      const savedIdle = localStorage.getItem('sodabot_default_idle_expr');
      if (savedIdle && savedIdle.startsWith('custom_')) {
        const savedCustom = localStorage.getItem('sodabot_default_custom_face');
        return savedCustom ? JSON.parse(savedCustom) : null;
      }
      return null;
    } catch {
      return null;
    }
  });

  const exprTimeoutRef = React.useRef<any>(null);
  const sendWsCommand = (action: string, value: string, label?: string) => {
    window.dispatchEvent(new CustomEvent('sodabot-send-command', { detail: { action, value, label } }));
  };

  // Hardware-compatible safe expression mapper (Guarantees no unsupported_expression errors)
  const mapToSafeHardwareExpr = (exprId: string): string => {
    const validHardwareExprs = ['happy', 'sad', 'angry', 'sleepy', 'surprised', 'wink', 'heart', 'confused', 'pupil', 'cat', 'idle', 'default'];
    if (validHardwareExprs.includes(exprId)) return exprId;
    if (exprId === 'squint' || exprId === 'thinking' || exprId === 'listening') return 'confused';
    if (exprId === 'tongue' || exprId === 'tease') return 'wink';
    if (exprId === 'sparkle' || exprId === 'star') return 'pupil';
    return 'default';
  };

  // Set and persist user's chosen basic expression as default idle
  const handleSetDefaultIdleExpr = (exprId: string, label: string) => {
    if (exprTimeoutRef.current) clearTimeout(exprTimeoutRef.current);
    setDefaultIdleExpr(exprId);
    setSelectedExpr(exprId);
    setActiveCustomFace(null);
    localStorage.setItem('sodabot_default_idle_expr', exprId);
    localStorage.removeItem('sodabot_default_custom_face');

    const matched = expressionsList.find(e => e.id === exprId);
    const displayLabel = matched ? `${matched.label} 표정 ${matched.emoji}` : `${label} 표정`;
    setStandbyFace(displayLabel);
    localStorage.setItem('sodabot_standby_face', displayLabel);

    const safeHardwareId = mapToSafeHardwareExpr(exprId);
    sendWsCommand("set_default_expression", safeHardwareId, `대기 기본 표정(${label}) 설정`);

    showToast(`⭐ 소다봇 대기 기본 표정이 '${label}'(으)로 저장되었습니다!`);
  };

  // Set and persist user's custom created expression as default idle
  const handleSetDefaultCustomIdleExpr = (cExpr: any) => {
    if (exprTimeoutRef.current) clearTimeout(exprTimeoutRef.current);
    setDefaultIdleExpr(cExpr.id);
    setSelectedExpr(cExpr.shape || 'custom');
    setActiveCustomFace(cExpr);
    localStorage.setItem('sodabot_default_idle_expr', cExpr.id);
    localStorage.setItem('sodabot_default_custom_face', JSON.stringify(cExpr));

    const displayLabel = `[내 표정] ${cExpr.label} ${cExpr.emoji}`;
    setStandbyFace(displayLabel);
    localStorage.setItem('sodabot_standby_face', displayLabel);

    try {
      if (cExpr.mode === 'pixel' && cExpr.pixelGrid) {
        syncPixelsToHardware(cExpr.pixelGrid);
      } else {
        syncFaceToHardware({
          eyeWidth: cExpr.eyeWidth ?? 84,
          eyeHeight: cExpr.eyeHeight ?? 68,
          pupilX: cExpr.pupilX ?? 0,
          pupilY: cExpr.pupilY ?? 0,
          eyebrowTilt: cExpr.eyebrowTilt ?? 0,
          eyeRadius: cExpr.eyeRadius ?? 20,
          hasSparkle: cExpr.hasSparkle ?? false,
          hasGloss: cExpr.hasGloss ?? false,
          shape: cExpr.shape || 'happy',
          mouth: cExpr.mouth || 'smile',
          color: cExpr.color || '#22D3EE',
          effect: cExpr.effect || 'none'
        });
      }
    } catch {}

    showToast(`⭐ 내가 만든 맞춤 표정 '${cExpr.label}'이(가) 대기 기본 표정으로 저장되었습니다!`);
  };

  // Immediate Expression Execution with 3-Second Auto-Reset to Configured Default
  const triggerExpression = (exprId: string, label: string) => {
    setActiveCustomFace(null);
    setSelectedExpr(exprId);

    const safeHardwareId = mapToSafeHardwareExpr(exprId);
    sendWsCommand("set_expression", safeHardwareId, `${label} 표정 전송`);
    showToast(`'${label}' 표정 전송 중…`);

    // Reset to user's configured default idle expression after 3 seconds
    if (exprTimeoutRef.current) clearTimeout(exprTimeoutRef.current);
    exprTimeoutRef.current = setTimeout(() => {
      setSelectedExpr(defaultIdleExpr);
      if (defaultIdleExpr.startsWith('custom_')) {
        try {
          const savedCustom = localStorage.getItem('sodabot_default_custom_face');
          if (savedCustom) setActiveCustomFace(JSON.parse(savedCustom));
        } catch {}
      } else {
        setActiveCustomFace(null);
      }
    }, 3000);
  };

  // Execute and faithfully reproduce a customized expression (Sliders / Pixels)
  const triggerCustomExpression = (cExpr: any) => {
    setActiveCustomFace(cExpr);
    setSelectedExpr(cExpr.shape || 'custom');

    if (cExpr.mode === 'pixel' && cExpr.pixelGrid) {
      syncPixelsToHardware(cExpr.pixelGrid);
    } else {
      syncFaceToHardware({
        eyeWidth: cExpr.eyeWidth ?? 84,
        eyeHeight: cExpr.eyeHeight ?? 68,
        pupilX: cExpr.pupilX ?? 0,
        pupilY: cExpr.pupilY ?? 0,
        eyebrowTilt: cExpr.eyebrowTilt ?? 0,
        eyeRadius: cExpr.eyeRadius ?? 20,
        hasSparkle: cExpr.hasSparkle ?? false,
        hasGloss: cExpr.hasGloss ?? false,
        shape: cExpr.shape || 'happy',
        mouth: cExpr.mouth || 'smile',
        color: cExpr.color || '#22D3EE',
        effect: cExpr.effect || 'none'
      });
    }

    showToast(`✨ '${cExpr.label}' 맞춤 표정을 소다봇에 재현 중…`);

    if (exprTimeoutRef.current) clearTimeout(exprTimeoutRef.current);
    exprTimeoutRef.current = setTimeout(() => {
      setSelectedExpr(defaultIdleExpr);
      if (defaultIdleExpr.startsWith('custom_')) {
        try {
          const savedCustom = localStorage.getItem('sodabot_default_custom_face');
          if (savedCustom) setActiveCustomFace(JSON.parse(savedCustom));
        } catch {}
      } else {
        setActiveCustomFace(null);
      }
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

  const handleSaveCustomExpr = () => {
    const newExpr: typeof customExprList[0] = {
      id: 'custom_' + Date.now(),
      label: editName || '나만의표정',
      emoji: editEmoji || '✨',
      mode: editorTab,
      shape: editShape,
      mouth: editMouth,
      color: editColor,
      effect: editEffect,
      eyeWidth,
      eyeHeight,
      pupilX,
      pupilY,
      eyebrowTilt,
      eyeRadius,
      hasSparkle,
      hasGloss,
      pixelGrid: editorTab === 'pixel' ? [...pixelGrid] : undefined
    };
    const updated = [...customExprList, newExpr];
    setCustomExprList(updated);
    localStorage.setItem("sodabot_custom_exprs", JSON.stringify(updated));
    setShowExprEditor(false);
    showToast(`✨ '${newExpr.label}' 나만의 표정이 라이브러리에 저장되었습니다!`);
    setExprTab('custom');
  };

  const handleDeleteCustomExpr = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customExprList.filter(item => item.id !== id);
    setCustomExprList(updated);
    localStorage.setItem("sodabot_custom_exprs", JSON.stringify(updated));
    showToast('커스텀 표정이 삭제되었습니다.');
  };

  const [welcomeMsg, setWelcomeMsg] = useState(localStorage.getItem('sodabot_welcome_msg') || 'HELLO!\nI AM LUMI :)\nNICE TO SEE YOU TODAY!');
  const [standbyFace, setStandbyFace] = useState(localStorage.getItem('sodabot_standby_face') || '기본 표정 표시 🤖');

  const [soundTab, setSoundTab] = useState<'basic' | 'custom'>('basic');
  const [playingSound, setPlayingSound] = useState<string | null>(null);

  // 미리 준비된 아두이노 기능 슬롯 정의 (슬롯 1, 2, 3)
  const USER_FUNCTION_SLOTS = [
    { slot: 'CUSTOM_1', arduinoFunction: 'customFunction1', label: 'customFunction1()', displayName: '기능 슬롯 1' },
    { slot: 'CUSTOM_2', arduinoFunction: 'customFunction2', label: 'customFunction2()', displayName: '기능 슬롯 2' },
    { slot: 'CUSTOM_3', arduinoFunction: 'customFunction3', label: 'customFunction3()', displayName: '기능 슬롯 3' },
  ];

  // 사용자 정의 아두이노 기능 (MY FUNCTIONS) 상태 관리 (기본 더미 데이터 없음)
  const [customFunctions, setCustomFunctions] = useState<Array<{
    id: string;
    name: string;
    slot: string;
    arduinoFunction: string;
    description: string;
    createdAt?: number;
  }>>(() => {
    try {
      const saved = localStorage.getItem('sodabot_custom_functions');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Remove legacy demo if present without explicit user creation
        return parsed
          .filter((item: any) => item.id !== 'func_clock_demo')
          .map((item: any, idx: number) => {
            const slotObj = USER_FUNCTION_SLOTS.find(s => s.slot === item.slot || s.arduinoFunction === item.functionName || s.arduinoFunction === item.arduinoFunction)
              || USER_FUNCTION_SLOTS[idx % USER_FUNCTION_SLOTS.length];
            return {
              id: item.id || `func_${Date.now()}_${idx}`,
              name: item.name || `기능 ${idx + 1}`,
              slot: slotObj.slot,
              arduinoFunction: slotObj.arduinoFunction,
              description: item.description || '',
              createdAt: item.createdAt || Date.now()
            };
          });
      }
      return [];
    } catch {
      return [];
    }
  });

  // 모달 상태 관리
  const [showFuncModal, setShowFuncModal] = useState(false); // 새 기능 등록 모달
  const [editingFunc, setEditingFunc] = useState<{ id: string; name: string; slot: string; arduinoFunction: string; description: string; createdAt?: number } | null>(null); // 수정 모달
  const [deletingFunc, setDeletingFunc] = useState<{ id: string; name: string; slot: string; arduinoFunction: string } | null>(null); // 삭제 확인 모달
  const [funcNameInput, setFuncNameInput] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('CUSTOM_1');
  const [funcDescInput, setFuncDescInput] = useState('');
  const [connectTargetFunc, setConnectTargetFunc] = useState<{ id: string; name: string; slot: string; arduinoFunction: string; description: string } | null>(null);

  // 커스텀 코드 4개 파트 및 펌웨어 생성 상태
  const [headersInput, setHeadersInput] = useState('');
  const [globalsInput, setGlobalsInput] = useState('');
  const [setupInput, setSetupInput] = useState('');
  const [functionInput, setFunctionInput] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [generationResult, setGenerationResult] = useState<GeneratedFirmwareResult | null>(null);
  const [showCodePreview, setShowCodePreview] = useState(false);
  const [isCopiedCode, setIsCopiedCode] = useState(false);

  // GPT 프롬프트 가이드 상태
  const [showGptHelp, setShowGptHelp] = useState(false);
  const [gptFeatureInput, setGptFeatureInput] = useState('');
  const [isCopiedGptPrompt, setIsCopiedGptPrompt] = useState(false);

  const handleCopyGptPrompt = () => {
    const effectiveFeature = gptFeatureInput.trim() || (funcNameInput.trim() ? `${funcNameInput.trim()}${funcDescInput.trim() ? ` - ${funcDescInput.trim()}` : ''}` : '');
    const prompt = buildGptCustomPrompt(effectiveFeature);
    navigator.clipboard.writeText(prompt);
    setIsCopiedGptPrompt(true);
    showToast('📋 원하는 기능이 반영된 GPT 프롬프트가 복사되었습니다!');
    setTimeout(() => setIsCopiedGptPrompt(false), 2000);
  };

  const [btnSingleClick, setBtnSingleClick] = useState(() => {
    const saved = localStorage.getItem('sodabot_btn_single');
    return saved && saved !== 'show_time' ? saved : 'random_face';
  });
  const [btnDoubleClick, setBtnDoubleClick] = useState(() => {
    const saved = localStorage.getItem('sodabot_btn_double');
    return saved && saved !== 'show_time' ? saved : 'happy_face';
  });
  const [btnLongPress, setBtnLongPress] = useState(() => {
    const saved = localStorage.getItem('sodabot_btn_long');
    return saved && saved !== 'show_time' ? saved : 'greeting';
  });

  const previewStandbyScreen = (face: string) => {
    showToast(`🌙 [대기 화면: ${face}] 미리보기를 시작합니다.`);
    if (face.includes('시계')) {
      setBootingState('time');
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      sendWsCommand("send_message", `TIME\n${timeStr}`, "대기 화면 시계 모드");
      setTimeout(() => setBootingState(null), 3000);
    } else if (face.includes('날씨')) {
      setBootingState('greeting');
      setBootingMessage('WEATHER\nSUNNY 24°C');
      sendWsCommand("send_message", "WEATHER\nSUNNY 24C", "대기 화면 날씨 모드");
      setTimeout(() => setBootingState(null), 3000);
    } else if (face.includes('화면 끄기')) {
      setBootingState(null);
      setSelectedExpr('sleepy');
      sendWsCommand("set_expression", "sleepy", "대기 화면 절전 모드");
    } else {
      setBootingState(null);
      // 1. Check custom expressions
      const foundCustom = customExprList.find(c => face.includes(c.label) || face.includes(c.id));
      if (foundCustom) {
        triggerCustomExpression(foundCustom);
        return;
      }
      // 2. Check basic expressions
      const matched = expressionsList.find(e => face.includes(e.label) || face.includes(e.id) || face.includes(e.emoji));
      const exprId = matched ? matched.id : defaultIdleExpr;
      const safeId = mapToSafeHardwareExpr(exprId);
      triggerExpression(safeId, matched?.label || '기본');
    }
  };

  // 1. 새 기능 등록 모달 열기 (비어 있는 첫 번째 슬롯 자동 선택 및 초기화)
  const handleOpenNewFuncModal = () => {
    setFuncNameInput('');
    setFuncDescInput('');
    setHeadersInput('');
    setGlobalsInput('');
    setSetupInput('');
    setFunctionInput('');
    setValidationErrors([]);
    setGenerationResult(null);
    setShowCodePreview(false);
    setIsCopiedCode(false);
    setShowGptHelp(false);
    setGptFeatureInput('');
    setIsCopiedGptPrompt(false);

    const usedSlots = customFunctions.map(f => f.slot);
    const availableSlot = USER_FUNCTION_SLOTS.find(s => !usedSlots.includes(s.slot)) || USER_FUNCTION_SLOTS[0];
    setSelectedSlot(availableSlot.slot);
    setShowFuncModal(true);
  };

  // 펌웨어 빌드 및 기능 등록
  const handleBuildFirmware = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);

    const parts: CustomCodeParts = {
      name: funcNameInput.trim(),
      description: funcDescInput.trim(),
      headers: headersInput,
      globals: globalsInput,
      setup: setupInput,
      functionCode: functionInput,
      targetSlot: selectedSlot
    };

    // 검증 수행
    const validation = validateCustomCode(parts);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    try {
      const wifiSsid = localStorage.getItem('sodabot_wifi_ssid') || '';
      const wifiPass = localStorage.getItem('sodabot_wifi_pass') || '';
      const result = generateCustomFirmware(parts, profileName || 'LUMI', wifiSsid, wifiPass);
      setGenerationResult(result);

      // SODA TALK 내 기능 목록에 등록
      const slotObj = USER_FUNCTION_SLOTS.find(s => s.slot === selectedSlot) || USER_FUNCTION_SLOTS[0];
      const newItem = {
        id: `func_${Date.now()}`,
        name: parts.name,
        slot: slotObj.slot,
        arduinoFunction: result.mainFunctionName || slotObj.arduinoFunction,
        functionName: result.mainFunctionName,
        description: parts.description || '',
        firmwareFileName: result.fileName,
        headers: parts.headers,
        globals: parts.globals,
        setupCode: parts.setup,
        functionCode: parts.functionCode,
        createdAt: Date.now()
      };

      const filtered = customFunctions.filter(item => item.slot !== selectedSlot);
      const updatedList = [...filtered, newItem];
      setCustomFunctions(updatedList);
      localStorage.setItem('sodabot_custom_functions', JSON.stringify(updatedList));

      showToast(`✨ '${parts.name}' 펌웨어가 성공적으로 생성되었습니다!`);
    } catch (err: any) {
      setValidationErrors([`펌웨어 생성 중 오류가 발생했습니다: ${err.message || '알 수 없는 오류'}`]);
    }
  };

  // .ino 파일 다운로드
  const handleDownloadIno = () => {
    if (!generationResult) return;
    const blob = new Blob([generationResult.mergedCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generationResult.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`📥 '${generationResult.fileName}' 다운로드를 시작합니다.`);
  };

  // 병합된 코드 복사
  const handleCopyMergedCode = () => {
    if (!generationResult) return;
    navigator.clipboard.writeText(generationResult.mergedCode);
    setIsCopiedCode(true);
    showToast('📋 전체 .ino 코드가 클립보드에 복사되었습니다.');
    setTimeout(() => setIsCopiedCode(false), 2000);
  };

  // 2. 기능 수정 모달 열기
  const handleOpenEditFuncModal = (fn: { id: string; name: string; slot: string; arduinoFunction: string; description: string; createdAt?: number }) => {
    setEditingFunc(fn);
    setFuncNameInput(fn.name);
    setFuncDescInput(fn.description);
  };

  // 기능 수정 저장
  const handleSaveEditFunction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFunc) return;

    const trimmedName = funcNameInput.trim();
    const trimmedDesc = funcDescInput.trim();

    if (!trimmedName) {
      alert('기능 이름을 입력해주세요.');
      return;
    }

    const updatedList = customFunctions.map(item => {
      if (item.id === editingFunc.id) {
        return {
          ...item,
          name: trimmedName,
          description: trimmedDesc
        };
      }
      return item;
    });

    setCustomFunctions(updatedList);
    localStorage.setItem('sodabot_custom_functions', JSON.stringify(updatedList));
    setEditingFunc(null);
    showToast(`'${trimmedName}' 기능이 수정되었습니다.`);
  };

  // 3. 기능 삭제 확인 모달 열기
  const handleRequestDeleteFunction = (fn: { id: string; name: string; slot: string; arduinoFunction: string }) => {
    setDeletingFunc(fn);
  };

  // 기능 삭제 확정 (SODA TALK 등록 및 버튼 연결만 해제, Arduino 코드는 보존)
  const handleConfirmDeleteFunction = () => {
    if (!deletingFunc) return;

    const deletedName = deletingFunc.name;
    const deletedSlot = deletingFunc.slot;

    // 1. 등록 목록에서 삭제
    const updated = customFunctions.filter(item => item.id !== deletingFunc.id);
    setCustomFunctions(updated);
    localStorage.setItem('sodabot_custom_functions', JSON.stringify(updated));

    // 2. 물리 버튼에 연결되어 있었다면 기본 기능으로 리셋
    const customSlotKey = `custom:${deletedSlot}`;
    let singleVal = btnSingleClick;
    let doubleVal = btnDoubleClick;
    let longVal = btnLongPress;
    let changed = false;

    if (btnSingleClick === customSlotKey) {
      singleVal = 'random_face';
      setBtnSingleClick(singleVal);
      localStorage.setItem('sodabot_btn_single', singleVal);
      changed = true;
    }
    if (btnDoubleClick === customSlotKey) {
      doubleVal = 'happy_face';
      setBtnDoubleClick(doubleVal);
      localStorage.setItem('sodabot_btn_double', doubleVal);
      changed = true;
    }
    if (btnLongPress === customSlotKey) {
      longVal = 'greeting';
      setBtnLongPress(longVal);
      localStorage.setItem('sodabot_btn_long', longVal);
      changed = true;
    }

    if (changed) {
      sendWsCommand("set_button_action", JSON.stringify({
        single: singleVal,
        double: doubleVal,
        long: longVal
      }), "삭제된 기능 버튼 연결 해제");
    }

    setDeletingFunc(null);
    showToast(`'${deletedName}' 기능 등록이 삭제되었습니다.`);
  };

  const handleConnectToButton = (fn: { id: string; name: string; slot: string; arduinoFunction: string }, targetButton: 'single' | 'double' | 'long') => {
    const customValue = `custom:${fn.slot}`;
    let singleVal = btnSingleClick;
    let doubleVal = btnDoubleClick;
    let longVal = btnLongPress;

    if (targetButton === 'single') {
      setBtnSingleClick(customValue);
      singleVal = customValue;
      localStorage.setItem('sodabot_btn_single', customValue);
    } else if (targetButton === 'double') {
      setBtnDoubleClick(customValue);
      doubleVal = customValue;
      localStorage.setItem('sodabot_btn_double', customValue);
    } else if (targetButton === 'long') {
      setBtnLongPress(customValue);
      longVal = customValue;
      localStorage.setItem('sodabot_btn_long', customValue);
    }

    sendWsCommand("set_button_action", JSON.stringify({
      single: singleVal,
      double: doubleVal,
      long: longVal
    }), `버튼 동작 설정 (${fn.name} 연결)`);

    setConnectTargetFunc(null);
    showToast(`🔗 '${fn.name}' 기능이 [${targetButton === 'single' ? '한 번 누름' : targetButton === 'double' ? '더블 클릭' : '길게 누름'}]에 연결되었습니다!`);

    // 물리 버튼 설정 카드로 부드럽게 스크롤
    const el = document.getElementById('card-button-settings');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const executeButtonAction = (targetAction: string, triggerName: string) => {
    showToast(`🔘 [${triggerName}] 동작을 테스트합니다!`);

    // 1. 커스텀 사용자 정의 함수 슬롯(CUSTOM_1, CUSTOM_2, CUSTOM_3) 실행
    if (targetAction.startsWith('custom:') || targetAction.startsWith('CUSTOM_')) {
      const slotKey = targetAction.replace('custom:', '');
      const matchedFunc = customFunctions.find(f => f.slot === slotKey || f.arduinoFunction === slotKey);
      const slotObj = USER_FUNCTION_SLOTS.find(s => s.slot === slotKey || s.arduinoFunction === slotKey);
      const funcTitle = matchedFunc ? matchedFunc.name : slotKey;
      const arduinoFnLabel = slotObj ? slotObj.label : matchedFunc ? `${matchedFunc.arduinoFunction}()` : `${slotKey}()`;

      // 소다봇에 슬롯 명령 전송 (예: CUSTOM_1)
      sendWsCommand("call_function", slotObj ? slotObj.slot : slotKey, `사용자 슬롯 '${funcTitle}(${slotKey})' 실행`);

      // LCD 화면 시뮬레이터에 표시
      setBootingState('greeting');
      setBootingMessage(`[MY FUNCTION]\n${funcTitle}\n${arduinoFnLabel}`);
      playWebSound('touch_react');
      setTimeout(() => { setBootingState(null); setSelectedExpr(defaultIdleExpr); }, 3000);
      showToast(`⚡ [${triggerName}] 내가 만든 기능 '${funcTitle} (${arduinoFnLabel})' 실행!`);
      return;
    }

    // 2. 기본 내장 기능 실행
    switch (targetAction) {
      case 'random_face': {
        const exprs = ['happy', 'wink', 'surprised', 'heart', 'pupil', 'sleepy', 'cat'];
        const random = exprs[Math.floor(Math.random() * exprs.length)];
        triggerExpression(random, '랜덤');
        break;
      }
      case 'next_face': {
        const exprs = ['default', 'happy', 'wink', 'surprised', 'heart', 'pupil', 'sleepy', 'cat'];
        const nextIdx = (exprs.indexOf(selectedExpr) + 1) % exprs.length;
        triggerExpression(exprs[nextIdx], '다음');
        break;
      }
      case 'happy_face':
        triggerExpression('happy', '기쁨');
        break;
      case 'wink_face':
        triggerExpression('wink', '윙크');
        break;
      case 'greeting': {
        setBootingState('greeting');
        const text = welcomeMsg || 'HELLO!\nI AM LUMI :)';
        setBootingMessage(text);
        sendWsCommand("send_message", text.replace(/\n/g, ' '), "환영 인사");
        playWebSound('greeting');
        sendWsCommand("play_sound", "greeting");
        setTimeout(() => { setBootingState(null); setSelectedExpr(defaultIdleExpr); }, 3000);
        break;
      }
      case 'play_sound':
        playWebSound('touch_react');
        sendWsCommand("play_sound", "touch_react");
        break;
      case 'default_face':
      default:
        setSelectedExpr(defaultIdleExpr);
        sendWsCommand("set_expression", mapToSafeHardwareExpr(defaultIdleExpr), "기본 표정");
        break;
    }
  };

  const [standbyTime, setStandbyTime] = useState('30초');

  const [wifiSsid, setWifiSsid] = useState(localStorage.getItem('sodabot_wifi_ssid') || 'SODA_LAB');
  const [wifiPass, setWifiPass] = useState(localStorage.getItem('sodabot_wifi_password') || '••••••••');
  const [autoSync, setAutoSync] = useState(true);
  const [timezone, setTimezone] = useState('서울, 대한민국 (GMT+9)');
  const [location, setLocation] = useState('서울특별시');

  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [bootingState, setBootingState] = useState<string | null>(null);
  const [bootingMessage, setBootingMessage] = useState<string>('');

  // Configurable Boot Sequence State
  const [bootSequence, setBootSequence] = useState<Array<{
    id: string;
    type: 'greeting' | 'expression' | 'sound' | 'time';
    name: string;
    icon: string;
    enabled: boolean;
    value: string;
  }>>([
    { id: '1', type: 'greeting', name: '환영 인사 표시', icon: '💬', enabled: true, value: 'HELLO!\nI AM LUMI :)\nNICE TO SEE YOU TODAY!' },
    { id: '2', type: 'expression', name: '표정 전환', icon: '😃', enabled: true, value: 'happy' },
    { id: '3', type: 'sound', name: '효과음 재생', icon: '🎵', enabled: true, value: 'greeting' },
    { id: '4', type: 'time', name: '현재 시간 표시', icon: '⏰', enabled: true, value: '' },
  ]);

  const moveSeqUp = (index: number) => {
    if (index === 0) return;
    setBootSequence(prev => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
    showToast('시퀀스 순서를 위로 이동했습니다.');
  };

  const moveSeqDown = (index: number) => {
    if (index >= bootSequence.length - 1) return;
    setBootSequence(prev => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
    showToast('시퀀스 순서를 아래로 이동했습니다.');
  };

  const toggleSeqEnabled = (id: string) => {
    setBootSequence(prev => prev.map(item => item.id === id ? { ...item, enabled: !item.enabled } : item));
  };

  const updateSeqValue = (id: string, value: string) => {
    setBootSequence(prev => prev.map(item => item.id === id ? { ...item, value } : item));
  };

  const removeSeqItem = (id: string) => {
    if (bootSequence.length <= 1) {
      showToast('최소 1개 이상의 시작 시퀀스 단계가 필요합니다.');
      return;
    }
    setBootSequence(prev => prev.filter(item => item.id !== id));
    showToast('시퀀스 단계를 삭제했습니다.');
  };

  const addSeqItem = (type: 'greeting' | 'expression' | 'sound' | 'time') => {
    const newId = Date.now().toString();
    let newItem: typeof bootSequence[0];
    if (type === 'greeting') {
      newItem = { id: newId, type: 'greeting', name: '환영 인사 표시', icon: '💬', enabled: true, value: welcomeMsg || 'HELLO!\nI AM LUMI :)' };
    } else if (type === 'expression') {
      newItem = { id: newId, type: 'expression', name: '표정 전환', icon: '😃', enabled: true, value: 'happy' };
    } else if (type === 'sound') {
      newItem = { id: newId, type: 'sound', name: '효과음 재생', icon: '🎵', enabled: true, value: 'greeting' };
    } else {
      newItem = { id: newId, type: 'time', name: '현재 시간 표시', icon: '⏰', enabled: true, value: '' };
    }
    setBootSequence(prev => [...prev, newItem]);
    showToast(`'${newItem.name}' 단계를 새로 추가했습니다.`);
  };

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

  // Boot sequence preview simulator & Real Hardware execution
  const playBootSequence = async () => {
    const activeSteps = bootSequence.filter(s => s.enabled);
    if (activeSteps.length === 0) {
      showToast('⚠️ 활성화된 시작 시퀀스 항목이 없습니다. 체크박스를 켜주세요.');
      return;
    }
    showToast(`🚀 시작 시퀀스 (${activeSteps.length}단계) 실행 중!`);
    
    for (let i = 0; i < activeSteps.length; i++) {
      const step = activeSteps[i];
      if (step.type === 'greeting') {
        const text = step.value || welcomeMsg || 'HELLO!\nI AM LUMI :)';
        setBootingState('greeting');
        setBootingMessage(text);
        const cleanMsg = text.replace(/\n/g, ' ');
        sendWsCommand("send_message", cleanMsg, `[${i+1}/${activeSteps.length}] 환영 인사 전송`);
        await new Promise(r => setTimeout(r, 2000));
      } else if (step.type === 'expression') {
        const expr = step.value || 'happy';
        setBootingState(expr);
        setSelectedExpr(expr);
        sendWsCommand("set_expression", expr, `[${i+1}/${activeSteps.length}] ${expr} 표정 전송`);
        await new Promise(r => setTimeout(r, 1500));
      } else if (step.type === 'sound') {
        const sound = step.value || 'greeting';
        setBootingState('sound');
        playWebSound(sound);
        sendWsCommand("play_sound", sound, `[${i+1}/${activeSteps.length}] ${sound} 효과음 재생`);
        await new Promise(r => setTimeout(r, 1200));
      } else if (step.type === 'time') {
        setBootingState('time');
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        sendWsCommand("send_message", `TIME\n${timeStr}`, `[${i+1}/${activeSteps.length}] 현재 시간 전송`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // 완료 후 기본 표정 복귀
    setBootingState(null);
    setBootingMessage('');
    setSelectedExpr('default');
    sendWsCommand("set_expression", "default", "시작 시퀀스 완료 -> 기본 표정 복귀");
    showToast('✨ 시작 시퀀스 재생이 완료되었습니다.');
  };

  // Listen to physical button events from Sodabot
  useEffect(() => {
    const handleButtonEvent = (e: any) => {
      const detail = e.detail;
      const typeStr = detail.type === 'single' ? '한 번 누름' : detail.type === 'double' ? '더블 클릭' : '길게 누름';
      showToast(`🤖 소다봇 물리 버튼 감지: [${typeStr}]`);
      if (detail.action) {
        executeButtonAction(detail.action, typeStr);
      }
    };
    window.addEventListener('sodabot-button-event', handleButtonEvent);
    return () => window.removeEventListener('sodabot-button-event', handleButtonEvent);
  }, [btnSingleClick, btnDoubleClick, btnLongPress]);
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

  const soundList = [
    { id: 'power_on', name: '전원 켜짐', duration: '00:01' },
    { id: 'greeting', name: '인사할 때', duration: '00:02' },
    { id: 'button_click', name: '버튼 클릭', duration: '00:01' },
    { id: 'touch_react', name: '터치 반응', duration: '00:01' },
    { id: 'notification', name: '알림', duration: '00:02' },
  ];

  const baseButtonActions = [
    { id: 'random_face', label: '🎲 랜덤 표정 전환' },
    { id: 'next_face', label: '🔄 다음 표정 전환' },
    { id: 'happy_face', label: '😆 기쁨 표정' },
    { id: 'wink_face', label: '😉 윙크 표정' },
    { id: 'greeting', label: '💬 환영 인사 & 소리' },
    { id: 'play_sound', label: '🔔 반응 효과음' },
    { id: 'default_face', label: '🤖 기본 표정 복귀' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FBFBFA] p-6 lg:p-8 overflow-y-auto font-sans animate-fade-in text-[#191919]">
      
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed top-6 right-6 z-50 bg-[#191919] text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2.5 animate-fade-in text-xs font-medium border border-neutral-700">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto w-full space-y-6 pb-12">

        {/* Page Header Banner (LCD Simulator on Top-Left) */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-[#E5E5E3] shadow-2xs">
          
          {/* Top-Left: Real-time 2.0" ST7789 TFT LCD Screen Simulator */}
          <div className="flex flex-col items-center shrink-0">
            <div className="w-[280px] h-[176px] bg-[#111111] rounded-2xl p-3 shadow-xl border border-neutral-800 flex flex-col justify-between relative overflow-hidden ring-1 ring-black/5">
              
              {/* LCD Top Status Bar */}
              <div className="flex justify-between items-center text-[10px] text-[#86868B] font-mono z-10 select-none">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  2.0" TFT ST7789
                </span>
                <span className="text-[9px] text-[#A1A1A6] font-semibold tracking-wider">
                  {bootingState ? `BOOT: ${bootingState.toUpperCase()}` : selectedExpr.toUpperCase()}
                </span>
              </div>

              {/* Eye Graphics & Boot Simulator synced 1:1 with hardware drawing logic */}
              <div className="flex-1 w-full flex items-center justify-center relative z-10">
                {bootingState === 'greeting' ? (
                  <div className="text-center px-2 animate-fade-in space-y-1">
                    <div className="text-[10px] text-amber-300 font-medium flex items-center justify-center gap-1">GREETING</div>
                    <div className="text-[12px] text-white font-medium leading-snug tracking-wide whitespace-pre-line bg-black/60 px-3 py-2 rounded-xl border border-white/10 shadow-inner font-mono">
                      {bootingMessage || welcomeMsg || 'HELLO!\nI AM LUMI :)\nNICE TO SEE YOU TODAY!'}
                    </div>
                  </div>
                ) : bootingState === 'sound' ? (
                  <div className="flex flex-col items-center justify-center animate-bounce">
                    <div className="flex gap-2.5 text-amber-300 text-lg">🎵 🎶 ✨</div>
                    <div className="text-[10px] text-cyan-300 font-mono font-medium mt-1">GREETING SOUND</div>
                  </div>
                ) : bootingState === 'time' ? (
                  <div className="flex flex-col items-center justify-center animate-fade-in space-y-0.5">
                    <div className="text-[9px] text-[#86868B] font-mono">CURRENT TIME</div>
                    <div className="text-2xl font-bold font-mono text-emerald-400 tracking-wider">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ) : activeCustomFace ? (
                  /* Custom Expression 1:1 Live Playback in 2.0" LCD Simulator */
                  activeCustomFace.mode === 'pixel' && activeCustomFace.pixelGrid ? (
                    <div className="grid grid-cols-16 gap-[1px] w-28 h-28 bg-[#090D16] p-1 rounded-xl border border-white/10 shadow-inner">
                      {activeCustomFace.pixelGrid.map((color: string, idx: number) => (
                        <div key={idx} className="w-1.5 h-1.5 rounded-[1px]" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center relative animate-fade-in">
                      <div className="flex items-center justify-center gap-5">
                        {/* Left Custom Eye */}
                        <div 
                          className="relative flex items-center justify-center shadow-lg transition-all"
                          style={{
                            width: `${Math.max(28, Math.min(52, (activeCustomFace.eyeWidth ?? 84) * 0.5))}px`,
                            height: `${Math.max(20, Math.min(48, (activeCustomFace.eyeHeight ?? 68) * 0.5))}px`,
                            backgroundColor: activeCustomFace.color || '#22D3EE',
                            borderRadius: activeCustomFace.shape === 'happy' || activeCustomFace.shape === 'wink' ? '24px 24px 6px 6px' : `${(activeCustomFace.eyeRadius ?? 20) * 0.5}px`,
                            transform: `rotate(${(activeCustomFace.eyebrowTilt ?? 0) * 0.5}deg)`,
                            boxShadow: `0 0 12px ${activeCustomFace.color || '#22D3EE'}88`
                          }}
                        >
                          {/* Pupil */}
                          <div 
                            className="w-3.5 h-3.5 bg-[#090D16] rounded-full relative"
                            style={{
                              transform: `translate(${(activeCustomFace.pupilX ?? 0) * 0.4}px, ${(activeCustomFace.pupilY ?? 0) * 0.4}px)`
                            }}
                          >
                            {activeCustomFace.hasGloss && <div className="absolute top-0.5 right-0.5 w-1 h-1 bg-white rounded-full" />}
                          </div>
                          {activeCustomFace.hasSparkle && <span className="absolute -top-1.5 -right-1.5 text-[8px] text-amber-300">✨</span>}
                        </div>

                        {/* Right Custom Eye */}
                        <div 
                          className="relative flex items-center justify-center shadow-lg transition-all"
                          style={{
                            width: `${Math.max(28, Math.min(52, (activeCustomFace.eyeWidth ?? 84) * 0.5))}px`,
                            height: `${Math.max(20, Math.min(48, (activeCustomFace.eyeHeight ?? 68) * 0.5))}px`,
                            backgroundColor: activeCustomFace.color || '#22D3EE',
                            borderRadius: activeCustomFace.shape === 'happy' ? '24px 24px 6px 6px' : activeCustomFace.shape === 'wink' ? '12px' : `${(activeCustomFace.eyeRadius ?? 20) * 0.5}px`,
                            transform: `rotate(-${(activeCustomFace.eyebrowTilt ?? 0) * 0.5}deg)`,
                            boxShadow: `0 0 12px ${activeCustomFace.color || '#22D3EE'}88`
                          }}
                        >
                          {/* Pupil */}
                          <div 
                            className="w-3.5 h-3.5 bg-[#090D16] rounded-full relative"
                            style={{
                              transform: `translate(${(activeCustomFace.pupilX ?? 0) * 0.4}px, ${(activeCustomFace.pupilY ?? 0) * 0.4}px)`
                            }}
                          >
                            {activeCustomFace.hasGloss && <div className="absolute top-0.5 right-0.5 w-1 h-1 bg-white rounded-full" />}
                          </div>
                          {activeCustomFace.hasSparkle && <span className="absolute -top-1.5 -right-1.5 text-[8px] text-amber-300">✨</span>}
                        </div>
                      </div>

                      {/* Custom Mouth */}
                      {activeCustomFace.mouth && activeCustomFace.mouth !== 'none' && (
                        <div className="mt-2 text-center text-xs font-mono font-bold" style={{ color: activeCustomFace.color || '#22D3EE' }}>
                          {activeCustomFace.mouth === 'smile' && '◡'}
                          {activeCustomFace.mouth === 'open' && 'o'}
                          {activeCustomFace.mouth === 'cat' && '▲ w ▲'}
                          {activeCustomFace.mouth === 'tongue' && '👅'}
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center gap-6">
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
                        <div className="absolute left-6 top-6 text-cyan-400 text-sm animate-bounce">💧</div>
                      </div>
                    )}
                    {selectedExpr === 'sleepy' && (
                      <div className="relative w-full flex items-center justify-center gap-6">
                        <div className="w-12 h-3 bg-cyan-400 rounded-full my-auto opacity-90 shadow-[0_0_10px_rgba(34,211,238,0.7)]"></div>
                        <div className="w-12 h-3 bg-cyan-400 rounded-full my-auto opacity-90 shadow-[0_0_10px_rgba(34,211,238,0.7)]"></div>
                        <div className="absolute right-2 -top-5 flex flex-col text-cyan-300 font-mono font-bold select-none pointer-events-none">
                          <span className="text-[12px] animate-bounce tracking-widest text-indigo-300">Z</span>
                          <span className="text-[10px] animate-bounce delay-100 tracking-wider text-cyan-300 -mt-1 ml-2">z</span>
                          <span className="text-[8px] animate-bounce delay-200 text-cyan-400 -mt-1 ml-4">z</span>
                        </div>
                      </div>
                    )}
                    {selectedExpr === 'surprised' && (
                      <div className="flex items-center justify-center gap-6">
                        <div className="w-10 h-10 bg-cyan-400 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.7)] animate-ping-slow"></div>
                        <div className="w-10 h-10 bg-cyan-400 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.7)] animate-ping-slow"></div>
                      </div>
                    )}
                    {selectedExpr === 'wink' && (
                      <div className="flex items-center justify-center gap-6">
                        <div className="w-12 h-10 bg-cyan-400 rounded-2xl shadow-[0_0_12px_rgba(34,211,238,0.7)]"></div>
                        <div className="w-12 h-3 bg-cyan-400 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.7)]"></div>
                      </div>
                    )}
                    {selectedExpr === 'heart' && (
                      <div className="flex items-center justify-center gap-6 text-3xl text-pink-400 filter drop-shadow-[0_0_10px_rgba(244,114,182,0.8)] animate-pulse">
                        <span>💖</span>
                        <span>💖</span>
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
                    {selectedExpr === 'confused' && (
                      <div className="relative flex items-center justify-center gap-6">
                        <div className="w-12 h-12 bg-cyan-400 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.7)]">
                          <div className="w-4 h-4 bg-[#090D16] rounded-full translate-x-1 -translate-y-1"></div>
                        </div>
                        <div className="w-12 h-6 bg-cyan-400 rounded-xl shadow-[0_0_12px_rgba(34,211,238,0.7)]"></div>
                      </div>
                    )}
                    {selectedExpr === 'squint' && (
                      <div className="relative flex items-center justify-center gap-6">
                        <div className="w-12 h-3 bg-cyan-400 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.7)]"></div>
                        <div className="w-12 h-3 bg-cyan-400 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.7)]"></div>
                      </div>
                    )}
                    {(selectedExpr === 'default' || (selectedExpr !== 'happy' && selectedExpr !== 'angry' && selectedExpr !== 'sad' && selectedExpr !== 'sleepy' && selectedExpr !== 'surprised' && selectedExpr !== 'wink' && selectedExpr !== 'heart' && selectedExpr !== 'cat' && selectedExpr !== 'pupil' && selectedExpr !== 'confused' && selectedExpr !== 'squint')) && (
                      <>
                        <div className="w-12 h-10 bg-cyan-400 rounded-2xl shadow-[0_0_15px_rgba(34,211,238,0.6)]"></div>
                        <div className="w-12 h-10 bg-cyan-400 rounded-2xl shadow-[0_0_15px_rgba(34,211,238,0.6)]"></div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Glass Scanline Reflection Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none"></div>
            </div>
          </div>

          {/* Top-Right: Simplified Status & Quick Info */}
          <div className="flex-1 flex flex-col justify-between space-y-4 bg-[#FBFBFA] p-5 rounded-xl border border-[#E5E5E3]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5E3] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#191919] flex items-center gap-2">
                  소다봇 설정 스튜디오
                </h2>
                <p className="text-xs text-[#787774] mt-0.5">
                  표정, 대기 모드, 효과음 및 물리 버튼 동작을 한 화면에서 설정합니다.
                </p>
              </div>

              {/* Status Badges */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium bg-neutral-100 text-neutral-700 border border-neutral-200/80">
                  <Bluetooth className="w-3 h-3 mr-1 text-neutral-500" />
                  {connectionType === 'none' ? '연결 대기' : connectionType.toUpperCase()}
                </span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                  connectionType === 'none' 
                    ? 'bg-neutral-100 text-neutral-500 border-neutral-200' 
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${connectionType === 'none' ? 'bg-neutral-400' : 'bg-emerald-500 animate-pulse'}`}></span>
                  {connectionType === 'none' ? '미연결' : '소다봇 연결됨'}
                </span>
              </div>
            </div>

            {/* Quick Overview Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="bg-white p-3 rounded-xl border border-[#E5E5E3] space-y-1 shadow-2xs">
                <span className="text-[11px] text-[#787774] font-medium block">대기 기본 표정</span>
                <div className="text-xs font-bold text-[#191919] truncate">
                  {defaultIdleExpr.startsWith('custom_')
                    ? (activeCustomFace?.emoji ? `${activeCustomFace.emoji} ${activeCustomFace.label}` : '맞춤 표정')
                    : `${expressionsList.find(e => e.id === defaultIdleExpr)?.emoji || '🤖'} ${expressionsList.find(e => e.id === defaultIdleExpr)?.label || defaultIdleExpr}`}
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-[#E5E5E3] space-y-1 shadow-2xs">
                <span className="text-[11px] text-[#787774] font-medium block">대기 화면 모드</span>
                <div className="text-xs font-bold text-[#191919] truncate">
                  {standbyFace}
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1 bg-white p-3 rounded-xl border border-[#E5E5E3] space-y-1 shadow-2xs">
                <span className="text-[11px] text-[#787774] font-medium block">실시간 연동</span>
                <div className="text-xs font-semibold text-emerald-700 truncate">
                  {connectionType === 'none' ? '웹 시뮬레이터 동작' : '하드웨어 1:1 동기화'}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* 4-Card Single-Row Layout (1단 4열 그리드) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

          {/* Card 1: 표정 관리 */}
          <div className="bg-white border border-[#E5E5E3] hover:border-neutral-300 rounded-2xl p-5 shadow-2xs flex flex-col justify-between transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-neutral-100 border border-neutral-200/80 text-[11px] font-bold text-neutral-700 flex items-center justify-center">1</span>
                  <span className="text-xs font-bold text-[#191919]">표정 관리</span>
                </div>
                <Smile className="w-4 h-4 text-neutral-400" />
              </div>
              <p className="text-[11px] text-[#787774] leading-relaxed">
                기본 표정을 선택하거나 편집하여 나만의 표정 라이브러리를 만듭니다.
              </p>

              {/* Current Default Idle Expression Display */}
              <div className="flex items-center justify-between bg-[#FBFBFA] border border-[#EBEBEA] px-2.5 py-1.5 rounded-xl text-[10px]">
                <span className="font-medium text-[#191919] flex items-center gap-1.5 truncate max-w-[75%]">
                  <span className="text-[#787774]">대기 기본:</span>
                  <span className="text-[#191919] bg-white px-1.5 py-0.5 rounded border border-[#E5E5E3] font-bold truncate">
                    {defaultIdleExpr.startsWith('custom_')
                      ? (activeCustomFace?.emoji ? `${activeCustomFace.emoji} [내 표정] ${activeCustomFace.label}` : '[내 표정] 맞춤')
                      : `${expressionsList.find(e => e.id === defaultIdleExpr)?.emoji || '🤖'} ${expressionsList.find(e => e.id === defaultIdleExpr)?.label || defaultIdleExpr}`}
                  </span>
                </span>
                <span className="text-[9px] text-[#787774] font-medium shrink-0">평상시 유지</span>
              </div>

              {/* Tabs */}
              <div className="flex bg-[#F5F5F3] p-0.5 rounded-lg border border-[#EBEBEA] text-[10px] font-medium">
                <button 
                  onClick={() => setExprTab('basic')}
                  className={`flex-1 py-1 rounded-md transition-colors ${exprTab === 'basic' ? 'bg-white text-[#191919] font-bold shadow-2xs' : 'text-[#787774]'}`}
                >
                  기본 ({expressionsList.length})
                </button>
                <button 
                  onClick={() => setExprTab('custom')}
                  className={`flex-1 py-1 rounded-md transition-colors ${exprTab === 'custom' ? 'bg-white text-[#191919] font-bold shadow-2xs' : 'text-[#787774]'}`}
                >
                  내 표정 ({customExprList.length})
                </button>
                <button 
                  onClick={() => setShowExprEditor(true)} 
                  className="px-2 py-1 text-blue-600 hover:bg-blue-50/80 rounded-md flex items-center gap-0.5 cursor-pointer font-semibold"
                >
                  <Plus className="w-3 h-3 text-blue-600" /> 만들기
                </button>
              </div>

              {/* Expression Grid (4x3 12 items single screen visible) */}
              <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                {exprTab === 'basic' ? (
                  expressionsList.map(expr => {
                    const isDefault = defaultIdleExpr === expr.id;
                    const isSelected = selectedExpr === expr.id && !activeCustomFace;
                    return (
                      <button
                        key={expr.id}
                        onClick={() => triggerExpression(expr.id, expr.label)}
                        className={`relative flex flex-col items-center justify-center p-1.5 py-2 rounded-xl border transition-all cursor-pointer ${
                          isSelected 
                            ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-600/30' 
                            : 'border-[#E5E5E3] bg-white hover:border-neutral-400 hover:bg-[#FBFBFA]'
                        }`}
                        title={`${expr.label} (클릭: 3초 테스트 / 하단 버튼으로 대기표정 저장)`}
                      >
                        {isDefault && (
                          <span className="absolute -top-1 -right-1 bg-neutral-900 text-amber-300 text-[8px] font-bold px-1 rounded-full shadow-2xs leading-tight">
                            ⭐
                          </span>
                        )}
                        <span className="text-lg leading-none">{expr.emoji}</span>
                        <span className="text-[10px] font-medium text-[#191919] mt-1 tracking-tight leading-none">{expr.label}</span>
                      </button>
                    );
                  })
                ) : customExprList.length === 0 ? (
                  <div className="col-span-4 p-4 text-center text-xs text-[#787774]">
                    등록된 나만의 표정이 없습니다.<br />상단 <span className="font-semibold text-blue-600">+ 만들기</span> 버튼을 눌러보세요!
                  </div>
                ) : (
                  customExprList.map(cExpr => {
                    const isDefault = defaultIdleExpr === cExpr.id;
                    const isSelected = activeCustomFace?.id === cExpr.id;
                    return (
                      <div
                        key={cExpr.id}
                        onClick={() => triggerCustomExpression(cExpr)}
                        className={`relative flex flex-col items-center justify-center p-1.5 py-2 rounded-xl border transition-all cursor-pointer group ${
                          isSelected 
                            ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-600/30' 
                            : 'border-[#E5E5E3] bg-white hover:border-neutral-400 hover:bg-[#FBFBFA]'
                        }`}
                        title={`${cExpr.label} (클릭: 3초 테스트 / 하단 버튼으로 대기표정 저장)`}
                      >
                        {isDefault && (
                          <span className="absolute -top-1 -right-1 bg-neutral-900 text-amber-300 text-[8px] font-bold px-1 rounded-full shadow-2xs leading-tight z-10">
                            ⭐
                          </span>
                        )}
                        <span className="text-lg leading-none">{cExpr.emoji}</span>
                        <span className="text-[10px] font-medium text-[#191919] mt-1 truncate max-w-full tracking-tight leading-none">{cExpr.label.slice(0, 2)}</span>
                        <button 
                          onClick={(e) => handleDeleteCustomExpr(cExpr.id, e)}
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 text-neutral-400 hover:text-rose-600 rounded transition-all"
                          title="표정 삭제"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Action Buttons for Card 1 */}
            <div className="mt-4 space-y-1.5">
              <button 
                onClick={() => {
                  if (exprTab === 'custom') {
                    const target = activeCustomFace || (customExprList.length > 0 ? customExprList[0] : null);
                    if (target) handleSetDefaultCustomIdleExpr(target);
                    else showToast('선택하거나 생성된 내 표정이 없습니다.');
                  } else {
                    const target = expressionsList.find(e => e.id === selectedExpr) || expressionsList[0];
                    handleSetDefaultIdleExpr(target.id, target.label);
                  }
                }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                title="선택된 표정을 소다봇의 상시대기 기본 표정으로 저장합니다"
              >
                <span>⭐</span>
                선택한 표정을 대기 기본으로 저장
              </button>
              <button 
                onClick={() => {
                  if (exprTab === 'custom') {
                    const target = activeCustomFace || (customExprList.length > 0 ? customExprList[0] : null);
                    if (target) triggerCustomExpression(target);
                  } else {
                    const target = expressionsList.find(e => e.id === selectedExpr) || expressionsList[0];
                    triggerExpression(target.id, target.label);
                  }
                }}
                className="w-full py-2 bg-white hover:bg-neutral-50 text-neutral-700 border border-[#E5E5E3] text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <Smile className="w-3.5 h-3.5 text-neutral-500" />
                즉시 테스트 실행 (3초)
              </button>
            </div>
          </div>


          {/* Card 2: 인사·소리 & 대기 설정 */}
          <div className="bg-white border border-[#E5E5E3] hover:border-neutral-300 rounded-2xl p-5 shadow-2xs flex flex-col justify-between transition-all space-y-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-neutral-100 border border-neutral-200/80 text-[11px] font-bold text-neutral-700 flex items-center justify-center">2</span>
                  <span className="text-xs font-bold text-[#191919]">인사·소리 & 대기 설정</span>
                </div>
                <Volume2 className="w-4 h-4 text-neutral-400" />
              </div>
              <p className="text-[11px] text-[#787774] leading-relaxed">
                부팅 인사말, 대기 화면 모드, 효과음을 한곳에서 설정합니다.
              </p>

              {/* 1) Welcome Message Box */}
              <div className="space-y-1 bg-[#FBFBFA] p-2.5 rounded-xl border border-[#EBEBEA]">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-[#191919]">환영 인사 문구</label>
                  <span className="text-[9px] text-[#787774]">부팅 시 2.5초 표시</span>
                </div>
                <div className="relative">
                  <textarea 
                    value={welcomeMsg}
                    onChange={(e) => setWelcomeMsg(e.target.value)}
                    rows={2}
                    placeholder="e.g. HELLO!\nI AM LUMI :)\nNICE TO SEE YOU TODAY!"
                    className="w-full p-2 text-xs bg-white border border-[#E5E5E3] rounded-xl text-[#191919] outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 resize-none font-sans leading-relaxed transition-all placeholder:text-[#A1A1A0]"
                  />
                  <span className="absolute bottom-1 right-2 text-[8px] text-[#787774] font-mono">
                    {welcomeMsg.length}/100
                  </span>
                </div>
              </div>

              {/* 2) Standby Screen Box */}
              <div className="space-y-1 bg-[#FBFBFA] p-2.5 rounded-xl border border-[#EBEBEA]">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-[#191919]">대기 화면 모드</label>
                  <button
                    onClick={() => previewStandbyScreen(standbyFace)}
                    className="px-2 py-0.5 bg-white hover:bg-neutral-100 text-neutral-700 border border-[#E5E5E3] text-[9px] font-semibold rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                    title="대기 화면 미리보기"
                  >
                    <Play className="w-2.5 h-2.5 text-neutral-500" /> 미리보기
                  </button>
                </div>
                <div className="relative">
                  <select 
                    value={standbyFace}
                    onChange={(e) => {
                      const newFace = e.target.value;
                      setStandbyFace(newFace);
                      // 1. Check if matches custom expression
                      const matchedCustom = customExprList.find(c => newFace.includes(`[내 표정] ${c.label}`) || newFace.includes(c.label) || newFace === c.id);
                      if (matchedCustom) {
                        handleSetDefaultCustomIdleExpr(matchedCustom);
                        return;
                      }
                      // 2. Check if matches basic expression
                      const matched = expressionsList.find(expr => newFace.includes(expr.label) || newFace.includes(expr.emoji));
                      if (matched) {
                        handleSetDefaultIdleExpr(matched.id, matched.label);
                        return;
                      }
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E5E5E3] rounded-xl text-[#191919] outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 font-semibold appearance-none cursor-pointer transition-all"
                  >
                    <optgroup label="🤖 기본 표정 (12개)">
                      {expressionsList.map(expr => (
                        <option key={expr.id} value={`${expr.label} 표정 ${expr.emoji}`}>
                          {expr.emoji} {expr.label} 표정 ({expr.id})
                        </option>
                      ))}
                    </optgroup>
                    {customExprList.length > 0 && (
                      <optgroup label="✨ 내가 만든 맞춤 표정">
                        {customExprList.map(cExpr => (
                          <option key={cExpr.id} value={`[내 표정] ${cExpr.label} ${cExpr.emoji}`}>
                            {cExpr.emoji} [내 표정] {cExpr.label}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="⚙️ 화면 모드">
                      <option value="시계 모드 ⏰">⏰ 시계 모드</option>
                      <option value="날씨 정보 ☀️">☀️ 날씨 정보</option>
                      <option value="화면 끄기 🌙">🌙 화면 끄기 (절전)</option>
                    </optgroup>
                  </select>
                  <ChevronDown className="w-3 h-3 text-[#787774] absolute right-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* 3) Sound Effects Box */}
              <div className="space-y-1.5 bg-[#FBFBFA] p-2.5 rounded-xl border border-[#EBEBEA]">
                <label className="text-[10px] font-bold text-[#191919]">효과음 테스트 & 선택</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {soundList.slice(0, 4).map(s => (
                    <div key={s.id} className="flex items-center justify-between p-1.5 bg-white rounded-xl border border-[#E5E5E3] text-xs">
                      <span className="font-medium text-[#191919] text-[10px] truncate max-w-[50px]">{s.name}</span>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => playWebSound(s.id)}
                          className="p-1 bg-[#F5F5F3] hover:bg-neutral-200 text-neutral-700 rounded-md transition-colors cursor-pointer"
                          title="웹에서 듣기"
                        >
                          <Volume2 className="w-2.5 h-2.5" />
                        </button>
                        <button 
                          onClick={() => playBotSound(s.id)}
                          className="p-1 bg-neutral-900 hover:bg-black text-white rounded-md transition-colors cursor-pointer shadow-2xs"
                          title="소다봇에서 듣기"
                        >
                          <Bot className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                const cleanedText = welcomeMsg.trim();
                localStorage.setItem('sodabot_welcome_msg', cleanedText);
                localStorage.setItem('sodabot_standby_face', standbyFace);
                localStorage.setItem('sodabot_standby_time', standbyTime);
                localStorage.setItem('sodabot_default_idle_expr', defaultIdleExpr);
                sendWsCommand("set_welcome", cleanedText, "환영 인사 설정 전송");
                sendWsCommand("set_expression", mapToSafeHardwareExpr(defaultIdleExpr), "대기 기본 표정 전송");
                
                // 실시간 미리보기
                setBootingState('greeting');
                setBootingMessage(cleanedText);
                setTimeout(() => setBootingState(null), 3000);

                showToast('환영 인사 및 대기 표정 설정이 소다봇에 저장 및 전송되었습니다!');
              }}
              className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              저장 후 보내기
            </button>
          </div>


          {/* Card 3: 단일 물리 버튼 동작 설정 */}
          <div id="card-button-settings" className="bg-white border border-[#E5E5E3] hover:border-neutral-300 rounded-2xl p-5 shadow-2xs flex flex-col justify-between transition-all scroll-mt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-neutral-100 border border-neutral-200/80 text-[11px] font-bold text-neutral-700 flex items-center justify-center">3</span>
                  <span className="text-xs font-bold text-[#191919]">물리 버튼 동작 설정</span>
                </div>
                <Sliders className="w-4 h-4 text-neutral-400" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-[#787774] leading-relaxed">
                  단일 버튼에 기본 기능 및 내가 만든 아두이노 기능을 연결합니다.
                </p>
              </div>

              {/* Single Button 3 Actions */}
              <div className="space-y-2 pt-0.5">
                {/* 1. Single Click */}
                <div className="p-2 bg-[#FBFBFA] rounded-xl border border-[#EBEBEA] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#191919] flex items-center gap-1">
                      <span>🔘</span> 한 번 누름 (클릭)
                    </span>
                    <button
                      onClick={() => executeButtonAction(btnSingleClick, '한 번 누름')}
                      className="px-1.5 py-0.5 bg-white hover:bg-neutral-100 text-neutral-700 border border-[#E5E5E3] text-[9px] font-semibold rounded transition-colors"
                      title="화면 및 소다봇에서 테스트"
                    >
                      테스트
                    </button>
                  </div>
                  <select
                    value={btnSingleClick}
                    onChange={(e) => setBtnSingleClick(e.target.value)}
                    aria-label="한 번 누름 동작 선택"
                    className="w-full text-[10px] font-medium text-[#191919] bg-white border border-[#E5E5E3] rounded-lg px-2 py-1 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 cursor-pointer shadow-2xs transition-all"
                  >
                    <optgroup label="🤖 기본 기능">
                      {baseButtonActions.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="✨ 내가 만든 기능">
                      {customFunctions.length === 0 ? (
                        <option disabled value="">아직 등록된 기능이 없습니다</option>
                      ) : (
                        customFunctions.map((fn) => (
                          <option key={fn.id} value={`custom:${fn.slot}`}>
                            ✨ {fn.name} ({fn.arduinoFunction}())
                          </option>
                        ))
                      )}
                    </optgroup>
                  </select>
                </div>

                {/* 2. Double Click */}
                <div className="p-2 bg-[#FBFBFA] rounded-xl border border-[#EBEBEA] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#191919] flex items-center gap-1">
                      <span>⚡️</span> 더블 클릭 (2회)
                    </span>
                    <button
                      onClick={() => executeButtonAction(btnDoubleClick, '더블 클릭')}
                      className="px-1.5 py-0.5 bg-white hover:bg-neutral-100 text-neutral-700 border border-[#E5E5E3] text-[9px] font-semibold rounded transition-colors"
                      title="화면 및 소다봇에서 테스트"
                    >
                      테스트
                    </button>
                  </div>
                  <select
                    value={btnDoubleClick}
                    onChange={(e) => setBtnDoubleClick(e.target.value)}
                    aria-label="더블 클릭 동작 선택"
                    className="w-full text-[10px] font-medium text-[#191919] bg-white border border-[#E5E5E3] rounded-lg px-2 py-1 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 cursor-pointer shadow-2xs transition-all"
                  >
                    <optgroup label="🤖 기본 기능">
                      {baseButtonActions.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="✨ 내가 만든 기능">
                      {customFunctions.length === 0 ? (
                        <option disabled value="">아직 등록된 기능이 없습니다</option>
                      ) : (
                        customFunctions.map((fn) => (
                          <option key={fn.id} value={`custom:${fn.slot}`}>
                            ✨ {fn.name} ({fn.arduinoFunction}())
                          </option>
                        ))
                      )}
                    </optgroup>
                  </select>
                </div>

                {/* 3. Long Press */}
                <div className="p-2 bg-[#FBFBFA] rounded-xl border border-[#EBEBEA] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#191919] flex items-center gap-1">
                      <span>⏳</span> 길게 누름 (1초)
                    </span>
                    <button
                      onClick={() => executeButtonAction(btnLongPress, '길게 누름')}
                      className="px-1.5 py-0.5 bg-white hover:bg-neutral-100 text-neutral-700 border border-[#E5E5E3] text-[9px] font-semibold rounded transition-colors"
                      title="화면 및 소다봇에서 테스트"
                    >
                      테스트
                    </button>
                  </div>
                  <select
                    value={btnLongPress}
                    onChange={(e) => setBtnLongPress(e.target.value)}
                    aria-label="길게 누름 동작 선택"
                    className="w-full text-[10px] font-medium text-[#191919] bg-white border border-[#E5E5E3] rounded-lg px-2 py-1 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 cursor-pointer shadow-2xs transition-all"
                  >
                    <optgroup label="🤖 기본 기능">
                      {baseButtonActions.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="✨ 내가 만든 기능">
                      {customFunctions.length === 0 ? (
                        <option disabled value="">아직 등록된 기능이 없습니다</option>
                      ) : (
                        customFunctions.map((fn) => (
                          <option key={fn.id} value={`custom:${fn.slot}`}>
                            ✨ {fn.name} ({fn.arduinoFunction}())
                          </option>
                        ))
                      )}
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* 내가 등록한 기능 목록 */}
              <div className="space-y-1.5 pt-2 border-t border-[#E5E5E3]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#191919]">
                    내가 등록한 기능 ({customFunctions.length}/3)
                  </span>
                  <span className="text-[9px] text-[#787774]">슬롯 관리</span>
                </div>

                {customFunctions.length === 0 ? (
                  <div className="p-3 bg-[#FBFBFA] border border-[#EBEBEA] rounded-xl text-center space-y-0.5">
                    <p className="text-[11px] font-medium text-neutral-600">
                      아직 등록된 기능이 없습니다.
                    </p>
                    <p className="text-[10px] text-[#787774]">
                      Arduino에서 코드를 작성한 후 새 기능을 등록해보세요.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {customFunctions.map((fn) => {
                      const slotObj = USER_FUNCTION_SLOTS.find(s => s.slot === fn.slot);
                      return (
                        <div 
                          key={fn.id} 
                          className="p-2.5 bg-[#FBFBFA] border border-[#EBEBEA] rounded-xl space-y-2 transition-all hover:border-neutral-300"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-[#191919] truncate">{fn.name}</span>
                                <span className="px-1.5 py-0.5 bg-neutral-200/70 text-neutral-700 text-[9px] font-medium rounded">
                                  {slotObj?.displayName || fn.slot}
                                </span>
                                <span className="text-[9px] font-mono text-[#787774]">
                                  {fn.arduinoFunction}()
                                </span>
                              </div>
                              {fn.description && (
                                <p className="text-[10px] text-[#787774] mt-0.5 truncate">
                                  {fn.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 pt-1 border-t border-neutral-200/50">
                            <button
                              onClick={() => setConnectTargetFunc(fn)}
                              className="flex-1 py-1 px-2 bg-white hover:bg-neutral-100 text-blue-600 border border-[#E5E5E3] text-[10px] font-semibold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
                            >
                              <Link className="w-3 h-3" />
                              버튼에 연결
                            </button>
                            <button
                              onClick={() => handleOpenEditFuncModal(fn)}
                              className="py-1 px-2 bg-white hover:bg-neutral-100 text-neutral-700 border border-[#E5E5E3] text-[10px] font-medium rounded-lg transition-all cursor-pointer"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleRequestDeleteFunction(fn)}
                              className="py-1 px-2 bg-white hover:bg-rose-50 text-neutral-500 hover:text-rose-600 border border-[#E5E5E3] text-[10px] font-medium rounded-lg transition-all cursor-pointer"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 커스텀 기능 추가 버튼 */}
                {customFunctions.length < 3 ? (
                  <button
                    onClick={handleOpenNewFuncModal}
                    className="w-full py-2 bg-white hover:bg-neutral-50 border border-[#E5E5E3] rounded-xl text-[11px] font-semibold text-blue-600 flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs mt-1"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                    커스텀 기능 추가
                  </button>
                ) : (
                  <div className="py-1.5 px-2 bg-neutral-100/70 border border-neutral-200 rounded-xl text-center text-[10px] text-neutral-500">
                    모든 기능 슬롯(3개)이 사용 중입니다
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={() => {
                localStorage.setItem('sodabot_btn_single', btnSingleClick);
                localStorage.setItem('sodabot_btn_double', btnDoubleClick);
                localStorage.setItem('sodabot_btn_long', btnLongPress);
                sendWsCommand("set_button_action", JSON.stringify({
                  single: btnSingleClick,
                  double: btnDoubleClick,
                  long: btnLongPress
                }), "단일 버튼 동작 설정 저장 및 전송");
                showToast('단일 버튼 동작 설정이 저장 및 소다봇에 적용되었습니다!');
              }}
              className="mt-3 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              저장 후 소다봇에 적용
            </button>
          </div>


          {/* Card 4: 시작 시퀀스 & 대기 시간 */}
          <div className="bg-white border border-[#E5E5E3] hover:border-neutral-300 rounded-2xl p-5 shadow-2xs flex flex-col justify-between transition-all space-y-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-neutral-100 border border-neutral-200/80 text-[11px] font-bold text-neutral-700 flex items-center justify-center">4</span>
                  <span className="text-xs font-bold text-[#191919]">시작 시퀀스 설정</span>
                </div>
                <Zap className="w-4 h-4 text-neutral-400" />
              </div>
              <p className="text-[11px] text-[#787774] leading-relaxed">
                전원을 켰을 때 실행할 단계(인사, 표정, 소리, 시계)를 직접 구성합니다.
              </p>

              {/* Dynamic Interactive Sequence List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-[#191919]">
                    부팅 시퀀스 ({bootSequence.filter(s => s.enabled).length}개 활성)
                  </label>
                  <span className="text-[9px] text-[#787774]">순서 이동/설정</span>
                </div>

                <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
                  {bootSequence.map((seq, index) => (
                    <div 
                      key={seq.id} 
                      className={`p-2 rounded-xl border transition-all ${
                        seq.enabled ? 'bg-[#FBFBFA] border-[#EBEBEA]' : 'bg-neutral-50/70 border-neutral-200 opacity-60'
                      }`}
                    >
                      {/* Step Header */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <input 
                            type="checkbox"
                            checked={seq.enabled}
                            onChange={() => toggleSeqEnabled(seq.id)}
                            className="w-3.5 h-3.5 text-blue-600 rounded border-neutral-300 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="text-xs">{seq.icon}</span>
                          <span className="text-[11px] font-bold text-[#191919] truncate">{seq.label}</span>
                          <span className="text-[9px] text-[#787774] truncate max-w-[80px]">
                            {seq.type === 'greeting' ? `"${seq.value}"` : seq.type === 'expression' ? seq.value : seq.type === 'sound' ? seq.value : `${seq.duration}초`}
                          </span>
                        </div>

                        {/* Reorder controls */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button 
                            disabled={index === 0}
                            onClick={() => moveSeqUp(index)}
                            title="위로 이동"
                            className="p-0.5 text-neutral-400 hover:text-neutral-900 rounded disabled:opacity-20 cursor-pointer"
                          >
                            <MoveUp className="w-3 h-3" />
                          </button>
                          <button 
                            disabled={index === bootSequence.length - 1}
                            onClick={() => moveSeqDown(index)}
                            title="아래로 이동"
                            className="p-0.5 text-neutral-400 hover:text-neutral-900 rounded disabled:opacity-20 cursor-pointer"
                          >
                            <MoveDown className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => removeSeqItem(seq.id)}
                            title="삭제"
                            className="p-0.5 text-neutral-400 hover:text-rose-600 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Step Button Row */}
                <div className="pt-1 border-t border-[#E5E5E3] space-y-1">
                  <div className="grid grid-cols-4 gap-1">
                    <button 
                      onClick={() => addSeqItem('greeting')}
                      className="py-1 px-1 bg-white hover:bg-neutral-50 border border-[#E5E5E3] text-[10px] font-medium text-neutral-700 rounded-lg flex items-center justify-center gap-0.5 transition-all cursor-pointer shadow-2xs"
                    >
                      💬 인사
                    </button>
                    <button 
                      onClick={() => addSeqItem('expression')}
                      className="py-1 px-1 bg-white hover:bg-neutral-50 border border-[#E5E5E3] text-[10px] font-medium text-neutral-700 rounded-lg flex items-center justify-center gap-0.5 transition-all cursor-pointer shadow-2xs"
                    >
                      😃 표정
                    </button>
                    <button 
                      onClick={() => addSeqItem('sound')}
                      className="py-1 px-1 bg-white hover:bg-neutral-50 border border-[#E5E5E3] text-[10px] font-medium text-neutral-700 rounded-lg flex items-center justify-center gap-0.5 transition-all cursor-pointer shadow-2xs"
                    >
                      🎵 소리
                    </button>
                    <button 
                      onClick={() => addSeqItem('time')}
                      className="py-1 px-1 bg-white hover:bg-neutral-50 border border-[#E5E5E3] text-[10px] font-medium text-neutral-700 rounded-lg flex items-center justify-center gap-0.5 transition-all cursor-pointer shadow-2xs"
                    >
                      ⏰ 시계
                    </button>
                  </div>
                </div>
              </div>

              {/* Standby Time */}
              <div className="space-y-1 pt-1">
                <label className="text-[10px] font-bold text-[#191919]">대기 시간</label>
                <div className="relative">
                  <select 
                    value={standbyTime} 
                    onChange={(e) => {
                      setStandbyTime(e.target.value);
                      localStorage.setItem('sodabot_standby_time', e.target.value);
                      sendWsCommand("set_standby", JSON.stringify({
                        mode: standbyFace,
                        timeout: e.target.value === '15초' ? 15000 : e.target.value === '1분' ? 60000 : e.target.value === '5분' ? 300000 : 30000
                      }), "대기 시간 변경 전송");
                    }}
                    className="w-full px-3 py-1.5 bg-white border border-[#E5E5E3] rounded-xl text-xs font-semibold text-[#191919] outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 cursor-pointer appearance-none transition-all"
                  >
                    <option>15초</option>
                    <option>30초</option>
                    <option>1분</option>
                    <option>5분</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-[#787774] absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>
            </div>

            <button 
              onClick={() => playBootSequence()}
              className="mt-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              시작 시퀀스 실행
            </button>
          </div>
        </div>

      </div>



      {/* 1. Modal: 새 기능 등록 & 펌웨어 빌더 (showFuncModal) */}
      {showFuncModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white border border-[#E5E5E3] rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl space-y-4 my-auto max-h-[92vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E5E5E3] pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold">
                  ⚡
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#191919]">
                    {generationResult ? '펌웨어 준비 완료' : '커스텀 기능 추가'}
                  </h3>
                  <p className="text-[11px] text-[#787774]">
                    {generationResult 
                      ? '병합된 펌웨어를 다운로드하여 소다봇에 업로드하세요.' 
                      : '내가 만든 기능 코드를 추가하고 새 펌웨어를 만들어요.'}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowFuncModal(false)}
                className="w-7 h-7 rounded-lg bg-[#FBFBFA] border border-[#E5E5E3] flex items-center justify-center text-xs text-[#787774] hover:text-[#191919] cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="overflow-y-auto pr-1 space-y-4 flex-1">
              
              {!generationResult ? (
                /* === [Step 1: 코드 입력 화면] === */
                <form id="new-func-form" onSubmit={handleBuildFirmware} className="space-y-4">
                  
                  {/* Validation Errors Notice */}
                  {validationErrors.length > 0 && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                        <span>⚠️</span>
                        <span>입력 내용을 확인해주세요:</span>
                      </div>
                      <ul className="text-[11px] text-rose-600 list-disc list-inside space-y-0.5 pl-1">
                        {validationErrors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 1. 기능 이름 */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#191919] flex items-center justify-between">
                      <span>기능 이름</span>
                      <span className="text-[10px] text-rose-500 font-normal">* 필수</span>
                    </label>
                    <input
                      type="text"
                      value={funcNameInput}
                      onChange={(e) => setFuncNameInput(e.target.value)}
                      placeholder="예: 인터넷 시계"
                      className="w-full px-3 py-2 bg-white border border-[#E5E5E3] focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 rounded-xl text-xs font-medium text-[#191919] outline-none transition-all placeholder:text-[#A1A1A0]"
                      required
                      autoFocus
                    />
                  </div>

                  {/* 2. 기능 설명 (선택) */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#191919]">
                      기능 설명 (선택)
                    </label>
                    <input
                      type="text"
                      value={funcDescInput}
                      onChange={(e) => setFuncDescInput(e.target.value)}
                      placeholder="예: 인터넷에서 현재 시간을 가져와 화면에 표시"
                      className="w-full px-3 py-2 bg-white border border-[#E5E5E3] focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 rounded-xl text-xs font-medium text-[#191919] outline-none transition-all placeholder:text-[#A1A1A0]"
                    />
                  </div>

                  {/* 3. 커스텀 코드 4개 영역 */}
                  <div className="space-y-3 pt-1 border-t border-[#E5E5E3]">
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#191919]">
                          커스텀 코드 (4개 파트)
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowGptHelp(!showGptHelp)}
                          className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200/80 rounded-full text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-2xs group"
                          title="GPT에게 코드 요청하는 프롬프트 보기"
                        >
                          <Sparkles className="w-3 h-3 text-blue-600 group-hover:scale-110 transition-transform" />
                          <span>GPT에게 코드 만들기</span>
                        </button>
                      </div>
                      <span className="text-[10px] text-[#787774]">
                        순서대로 필요한 코드를 작성해요
                      </span>
                    </div>

                    {/* GPT 프롬프트 가이드 팝오버 카드 */}
                    {showGptHelp && (
                      <div className="p-3.5 sm:p-4 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-3 animate-fade-in shadow-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <span className="text-base sm:text-lg leading-none mt-0.5">🤖</span>
                            <div>
                              <h4 className="text-xs font-bold text-[#191919]">
                                GPT에게 맞춤 코드 요청하기
                              </h4>
                              <p className="text-[10px] sm:text-[11px] text-[#787774] mt-0.5">
                                만들고 싶은 기능만 입력하고 복사를 누르면 GPT에 바로 붙여넣을 수 있는 프롬프트가 완성됩니다.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowGptHelp(false)}
                            className="w-6 h-6 rounded-lg bg-white border border-[#E5E5E3] flex items-center justify-center text-xs text-neutral-500 hover:text-neutral-900 cursor-pointer transition-colors shrink-0"
                            title="닫기"
                          >
                            ✕
                          </button>
                        </div>

                        {/* 원하는 기능 입력 필드 + 원클릭 복사 버튼 */}
                        <div className="space-y-1.5 pt-0.5">
                          <label className="text-[11px] font-bold text-[#191919] flex items-center justify-between">
                            <span>원하는 기능 입력</span>
                            <span className="text-[10px] text-blue-600 font-normal">
                              {gptFeatureInput.trim() ? '입력한 기능 반영됨' : funcNameInput.trim() ? `'${funcNameInput}' 자동 반영됨` : '자유롭게 입력'}
                            </span>
                          </label>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={gptFeatureInput}
                              onChange={(e) => setGptFeatureInput(e.target.value)}
                              placeholder={funcNameInput.trim() ? `${funcNameInput}${funcDescInput.trim() ? ` (${funcDescInput})` : ''}` : "예: 인터넷에서 서울 현재 시간을 가져와서 LCD에 표시하기"}
                              className="flex-1 px-3 py-2 bg-white border border-[#E5E5E3] focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 rounded-xl text-xs font-medium text-[#191919] outline-none transition-all placeholder:text-[#A1A1A0]"
                            />
                            <button
                              type="button"
                              onClick={handleCopyGptPrompt}
                              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer shrink-0 active:scale-95"
                            >
                              {isCopiedGptPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{isCopiedGptPrompt ? '복사 완료!' : '프롬프트 복사'}</span>
                            </button>
                          </div>
                        </div>

                        {/* 프롬프트 실시간 미리보기 (축약 스크롤 박스) */}
                        <div className="relative bg-[#FBFBFA] border border-[#EBEBEA] rounded-xl p-2.5 max-h-36 overflow-y-auto">
                          <pre className="font-mono text-[10px] text-neutral-700 whitespace-pre-wrap leading-relaxed select-all">
                            {buildGptCustomPrompt(gptFeatureInput.trim() || (funcNameInput.trim() ? `${funcNameInput.trim()}${funcDescInput.trim() ? ` - ${funcDescInput.trim()}` : ''}` : ''))}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* ① HEADERS */}
                    <div className="p-3 bg-[#FBFBFA] border border-[#EBEBEA] rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#191919] flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-neutral-200 text-neutral-700 text-[9px] font-mono rounded">1</span>
                          HEADERS (헤더 / 라이브러리)
                        </span>
                        <span className="text-[9px] text-[#787774]">선택</span>
                      </div>
                      <p className="text-[10px] text-[#787774]">
                        필요한 라이브러리 코드를 붙여넣어요.
                      </p>
                      <textarea
                        value={headersInput}
                        onChange={(e) => setHeadersInput(e.target.value)}
                        placeholder={`#include <time.h>`}
                        rows={2}
                        className="w-full px-3 py-2 bg-white border border-[#E5E5E3] focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 rounded-lg font-mono text-[11px] text-[#191919] outline-none transition-all placeholder:text-[#A1A1A0] resize-y"
                        spellCheck={false}
                      />
                    </div>

                    {/* ② GLOBALS */}
                    <div className="p-3 bg-[#FBFBFA] border border-[#EBEBEA] rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#191919] flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-neutral-200 text-neutral-700 text-[9px] font-mono rounded">2</span>
                          GLOBALS (전역 변수 / 설정값)
                        </span>
                        <span className="text-[9px] text-[#787774]">선택</span>
                      </div>
                      <p className="text-[10px] text-[#787774]">
                        함수 밖에서 사용할 변수와 설정값을 넣어요.
                      </p>
                      <textarea
                        value={globalsInput}
                        onChange={(e) => setGlobalsInput(e.target.value)}
                        placeholder={`const char* ntpServer = "pool.ntp.org";`}
                        rows={2}
                        className="w-full px-3 py-2 bg-white border border-[#E5E5E3] focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 rounded-lg font-mono text-[11px] text-[#191919] outline-none transition-all placeholder:text-[#A1A1A0] resize-y"
                        spellCheck={false}
                      />
                    </div>

                    {/* ③ SETUP */}
                    <div className="p-3 bg-[#FBFBFA] border border-[#EBEBEA] rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#191919] flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-neutral-200 text-neutral-700 text-[9px] font-mono rounded">3</span>
                          SETUP (초기화 코드)
                        </span>
                        <span className="text-[9px] text-[#787774]">선택</span>
                      </div>
                      <p className="text-[10px] text-[#787774]">
                        소다봇이 시작할 때 한 번 실행할 코드를 넣어요.
                      </p>
                      <textarea
                        value={setupInput}
                        onChange={(e) => setSetupInput(e.target.value)}
                        placeholder={`configTime(9 * 3600, 0, ntpServer);`}
                        rows={2}
                        className="w-full px-3 py-2 bg-white border border-[#E5E5E3] focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 rounded-lg font-mono text-[11px] text-[#191919] outline-none transition-all placeholder:text-[#A1A1A0] resize-y"
                        spellCheck={false}
                      />
                    </div>

                    {/* ④ FUNCTION */}
                    <div className="p-3 bg-[#FBFBFA] border border-[#EBEBEA] rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#191919] flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-mono rounded font-bold">4</span>
                          FUNCTION (실행 함수)
                        </span>
                        <span className="text-[9px] text-rose-500 font-bold">* 필수</span>
                      </div>
                      <p className="text-[10px] text-[#787774]">
                        실제 기능을 실행하는 함수를 작성해요.
                      </p>
                      <textarea
                        value={functionInput}
                        onChange={(e) => setFunctionInput(e.target.value)}
                        placeholder={`void showClock() {\n  // 기능 코드\n}`}
                        rows={4}
                        className="w-full px-3 py-2 bg-white border border-[#E5E5E3] focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 rounded-lg font-mono text-[11px] text-[#191919] outline-none transition-all placeholder:text-[#A1A1A0] resize-y"
                        spellCheck={false}
                        required
                      />
                    </div>

                  </div>

                </form>
              ) : (
                /* === [Step 2: 펌웨어 생성 완료 화면] === */
                <div className="space-y-4 animate-fade-in">
                  
                  {/* Status Card */}
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                        ✓
                      </div>
                      <span className="text-sm font-bold text-emerald-950">
                        펌웨어 준비 완료
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100 space-y-0.5">
                        <span className="text-[10px] text-neutral-500">기능</span>
                        <div className="font-bold text-[#191919] truncate">{funcNameInput}</div>
                      </div>
                      <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100 space-y-0.5">
                        <span className="text-[10px] text-neutral-500">파일명</span>
                        <div className="font-bold text-[#191919] font-mono text-[11px] truncate">{generationResult.fileName}</div>
                      </div>
                    </div>

                    {/* Included Parts Checklist */}
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100 space-y-1.5">
                      <span className="text-[10px] font-bold text-neutral-600">추가된 코드:</span>
                      <div className="grid grid-cols-4 gap-1 text-[11px]">
                        <span className={`px-1.5 py-0.5 rounded text-center font-medium ${generationResult.includedParts.headers ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-400'}`}>
                          HEADERS {generationResult.includedParts.headers ? '✓' : '-'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-center font-medium ${generationResult.includedParts.globals ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-400'}`}>
                          GLOBALS {generationResult.includedParts.globals ? '✓' : '-'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-center font-medium ${generationResult.includedParts.setup ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-400'}`}>
                          SETUP {generationResult.includedParts.setup ? '✓' : '-'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-center font-medium ${generationResult.includedParts.function ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-400'}`}>
                          FUNCTION {generationResult.includedParts.function ? '✓' : '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Code Preview Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setShowCodePreview(!showCodePreview)}
                        className="text-xs font-semibold text-neutral-700 hover:text-blue-600 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Code className="w-3.5 h-3.5" />
                        {showCodePreview ? '코드 미리보기 접기' : '코드 미리보기'}
                      </button>
                      {showCodePreview && (
                        <button
                          type="button"
                          onClick={handleCopyMergedCode}
                          className="text-[10px] text-neutral-600 hover:text-neutral-900 flex items-center gap-1 px-2 py-1 bg-[#FBFBFA] border border-[#E5E5E3] rounded-lg cursor-pointer"
                        >
                          {isCopiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          {isCopiedCode ? '복사됨' : '전체 복사'}
                        </button>
                      )}
                    </div>

                    {showCodePreview && (
                      <div className="relative rounded-xl border border-[#E5E5E3] bg-[#FBFBFA] p-3 max-h-56 overflow-y-auto">
                        <pre className="font-mono text-[10px] text-neutral-800 leading-relaxed whitespace-pre-wrap">
                          {generationResult.mergedCode}
                        </pre>
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-[#E5E5E3] flex items-center gap-2 shrink-0">
              {!generationResult ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowFuncModal(false)}
                    className="flex-1 py-2.5 bg-white hover:bg-neutral-50 text-neutral-700 border border-[#E5E5E3] text-xs font-medium rounded-xl transition-colors cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    form="new-func-form"
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    펌웨어 만들기
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowCodePreview(!showCodePreview)}
                    className="flex-1 py-2.5 bg-white hover:bg-neutral-50 text-neutral-700 border border-[#E5E5E3] text-xs font-medium rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Code className="w-3.5 h-3.5" />
                    {showCodePreview ? '코드 닫기' : '코드 미리보기'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadIno}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    .ino 다운로드
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}



      {/* 2. Modal: 기존 기능 정보 수정 (editingFunc) */}
      {editingFunc && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#E5E5E3] rounded-2xl max-w-sm sm:max-w-md w-full p-5 sm:p-6 shadow-xl space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E5E5E3] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-800 text-sm font-bold">
                  ✏️
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#191919]">
                    기능 정보 수정
                  </h3>
                  <p className="text-[11px] text-[#787774]">
                    등록된 기능의 이름과 설명을 수정해요.
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setEditingFunc(null)}
                className="w-7 h-7 rounded-lg bg-[#FBFBFA] border border-[#E5E5E3] flex items-center justify-center text-xs text-[#787774] hover:text-[#191919] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEditFunction} className="space-y-4">
              
              {/* 1. 기능 이름 */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#191919] flex items-center justify-between">
                  <span>기능 이름</span>
                  <span className="text-[10px] text-rose-500 font-normal">* 필수</span>
                </label>
                <input
                  type="text"
                  value={funcNameInput}
                  onChange={(e) => setFuncNameInput(e.target.value)}
                  placeholder="예: 인터넷 시계"
                  className="w-full px-3 py-2 bg-white border border-[#E5E5E3] focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 rounded-xl text-xs font-medium text-[#191919] outline-none transition-all placeholder:text-[#A1A1A0]"
                  required
                />
              </div>

              {/* 2. 연결된 슬롯 (고정/유지 안내) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#191919]">
                  연결된 기능 슬롯
                </label>
                <div className="p-2.5 bg-[#FBFBFA] border border-[#EBEBEA] rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#191919]">
                      {USER_FUNCTION_SLOTS.find(s => s.slot === editingFunc.slot)?.displayName || editingFunc.slot}
                    </span>
                    <span className="text-[10px] text-[#787774] ml-2">
                      (기본 슬롯 유지)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#787774]">
                    {editingFunc.arduinoFunction}()
                  </span>
                </div>
              </div>

              {/* 3. 기능 설명 (선택) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#191919]">
                  기능 설명 (선택)
                </label>
                <input
                  type="text"
                  value={funcDescInput}
                  onChange={(e) => setFuncDescInput(e.target.value)}
                  placeholder="예: 현재 시간을 화면에 표시"
                  className="w-full px-3 py-2 bg-white border border-[#E5E5E3] focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 rounded-xl text-xs font-medium text-[#191919] outline-none transition-all placeholder:text-[#A1A1A0]"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingFunc(null)}
                  className="flex-1 py-2.5 bg-white hover:bg-neutral-50 text-neutral-700 border border-[#E5E5E3] text-xs font-medium rounded-xl transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  수정 완료
                </button>
              </div>

            </form>

          </div>
        </div>
      )}



      {/* 3. Modal: 기능 삭제 확인 모달 (deletingFunc) */}
      {deletingFunc && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#E5E5E3] rounded-2xl max-w-sm sm:max-w-md w-full p-5 sm:p-6 shadow-xl space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E5E5E3] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 text-sm font-bold">
                  🗑️
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#191919]">
                    '{deletingFunc.name}' 기능을 삭제할까요?
                  </h3>
                  <p className="text-[11px] text-[#787774]">
                    {USER_FUNCTION_SLOTS.find(s => s.slot === deletingFunc.slot)?.displayName || deletingFunc.slot} ({deletingFunc.arduinoFunction}())
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setDeletingFunc(null)}
                className="w-7 h-7 rounded-lg bg-[#FBFBFA] border border-[#E5E5E3] flex items-center justify-center text-xs text-[#787774] hover:text-[#191919] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content & Warning */}
            <div className="p-3.5 bg-[#FBFBFA] border border-[#EBEBEA] rounded-xl space-y-2.5 text-xs leading-relaxed">
              <div className="flex items-start gap-2 text-neutral-700">
                <span className="text-amber-500 font-bold shrink-0">⚠️</span>
                <span>SODA TALK의 기능 등록과 버튼 연결이 삭제됩니다.</span>
              </div>
              <div className="flex items-start gap-2 text-emerald-800 bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200/80 font-medium text-[11px]">
                <span className="shrink-0">💡</span>
                <span>Arduino에 작성한 코드는 삭제되지 않습니다.</span>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDeletingFunc(null)}
                className="flex-1 py-2.5 bg-white hover:bg-neutral-50 text-neutral-700 border border-[#E5E5E3] text-xs font-medium rounded-xl transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFunction}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer"
              >
                삭제
              </button>
            </div>

          </div>
        </div>
      )}



      {/* Modal: 버튼에 빠른 연결 모달 (connectTargetFunc) */}
      {connectTargetFunc && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#E5E5E3] rounded-2xl max-w-sm w-full p-5 shadow-xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-[#E5E5E3] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🔗</span>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#191919]">물리 버튼 동작에 연결</h3>
                  <p className="text-[10px] text-[#787774]">{connectTargetFunc.name} ({connectTargetFunc.arduinoFunction}())</p>
                </div>
              </div>
              <button 
                onClick={() => setConnectTargetFunc(null)}
                className="w-6 h-6 rounded-lg bg-[#FBFBFA] border border-[#E5E5E3] flex items-center justify-center text-xs text-[#787774] hover:text-[#191919] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#787774]">
              어떤 버튼 동작에 <strong>'{connectTargetFunc.name}'</strong> 기능을 연결할까요?
            </p>

            <div className="space-y-2">
              <button
                onClick={() => handleConnectToButton(connectTargetFunc, 'single')}
                className="w-full p-3 bg-white hover:bg-neutral-50 border border-[#E5E5E3] hover:border-neutral-300 rounded-xl flex items-center justify-between transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2 text-left">
                  <span className="text-base">🔘</span>
                  <div>
                    <div className="text-xs font-bold text-[#191919] group-hover:text-blue-600">한 번 누름 (클릭)</div>
                    <div className="text-[10px] text-[#787774]">
                      현재: {btnSingleClick.startsWith('custom:') ? btnSingleClick.replace('custom:', '⚙️ ') : btnSingleClick}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#787774] group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                onClick={() => handleConnectToButton(connectTargetFunc, 'double')}
                className="w-full p-3 bg-white hover:bg-neutral-50 border border-[#E5E5E3] hover:border-neutral-300 rounded-xl flex items-center justify-between transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2 text-left">
                  <span className="text-base">⚡️</span>
                  <div>
                    <div className="text-xs font-bold text-[#191919] group-hover:text-blue-600">더블 클릭 (2회)</div>
                    <div className="text-[10px] text-[#787774]">
                      현재: {btnDoubleClick.startsWith('custom:') ? btnDoubleClick.replace('custom:', '⚙️ ') : btnDoubleClick}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#787774] group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                onClick={() => handleConnectToButton(connectTargetFunc, 'long')}
                className="w-full p-3 bg-white hover:bg-neutral-50 border border-[#E5E5E3] hover:border-neutral-300 rounded-xl flex items-center justify-between transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2 text-left">
                  <span className="text-base">⏳</span>
                  <div>
                    <div className="text-xs font-bold text-[#191919] group-hover:text-blue-600">길게 누름 (1초)</div>
                    <div className="text-[10px] text-[#787774]">
                      현재: {btnLongPress.startsWith('custom:') ? btnLongPress.replace('custom:', '⚙️ ') : btnLongPress}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#787774] group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>

            <button
              onClick={() => setConnectTargetFunc(null)}
              className="w-full py-2 text-xs font-semibold text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      )}



      {/* Modal 2: Custom Expression Studio Editor (showExprEditor - 2 Modes) */}
      {showExprEditor && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-[#E5E5E3] rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-5 max-h-[94vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E5E5E3] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-800 text-sm font-bold">
                  🎨
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#191919]">나만의 표정 편집기 (Expression Studio)</h3>
                  <p className="text-[11px] text-[#787774]">기존 표정을 불러와 정밀하게 다듬거나, 픽셀 캔버스에 자유롭게 그려보세요!</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowExprEditor(false)}
                className="w-7 h-7 rounded-lg bg-[#FBFBFA] border border-[#E5E5E3] flex items-center justify-center text-xs text-[#787774] hover:text-[#191919] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex bg-[#F5F5F3] p-1 rounded-xl border border-[#EBEBEA] text-xs font-medium">
              <button 
                type="button"
                onClick={() => setEditorTab('slider')}
                className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${editorTab === 'slider' ? 'bg-white text-[#191919] font-bold shadow-2xs' : 'text-[#787774]'}`}
              >
                🎛️ 파라미터 미세 조율 (표정 가져오기)
              </button>
              <button 
                type="button"
                onClick={() => setEditorTab('pixel')}
                className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${editorTab === 'pixel' ? 'bg-white text-[#191919] font-bold shadow-2xs' : 'text-[#787774]'}`}
              >
                ✍️ 픽셀 자유 드로잉 캔버스
              </button>
            </div>

            {/* 320x240 LCD Screen Live Preview (100% Exact 1:1 Hardware Pixel-Perfect Match) */}
            <div className="flex flex-col items-center gap-2 bg-[#111111] p-3.5 rounded-xl border border-neutral-800 shadow-inner select-none relative overflow-hidden">
              <div className="text-[10px] font-mono text-[#86868B] self-start flex items-center justify-between w-full">
                <span>2.0" LCD PREVIEW (320x240): <strong className="text-white">{editName} ({editEmoji})</strong></span>
                <span className="text-[9px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  1:1 HARDWARE ACCURATE
                </span>
              </div>

              {/* 320x240 Exact Ratio Display Frame */}
              <div className="w-full max-w-[340px] aspect-[4/3] bg-[#000000] rounded-lg border border-neutral-900 shadow-inner relative flex items-center justify-center overflow-hidden">
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
                        {/* Left Brow */}
                        <rect 
                          x={100 - eyeWidth / 2} 
                          y={120 - eyeHeight / 2 - 12 - Math.max(-15, Math.min(15, eyebrowTilt / 3))} 
                          width={eyeWidth} 
                          height={6} 
                          rx={3} 
                          fill={editColor} 
                        />
                        {/* Right Brow */}
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

                    {/* 2. Eyes */}
                    {editShape === 'happy' ? (
                      <g fill="none" stroke={editColor} strokeWidth="12" strokeLinecap="round">
                        <path d={`M ${100 - 36 + pupilX} ${132 + pupilY} A 36 36 0 0 1 ${100 + 36 + pupilX} ${132 + pupilY}`} />
                        <path d={`M ${220 - 36 + pupilX} ${132 + pupilY} A 36 36 0 0 1 ${220 + 36 + pupilX} ${132 + pupilY}`} />
                      </g>
                    ) : editShape === 'wink' ? (
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
                        <rect x={100 - eyeWidth / 2 - 2} y={120 - eyeHeight / 2 - 2} width={eyeWidth + 4} height={eyeHeight / 2} fill="#000000" />
                        <rect x={220 - eyeWidth / 2 - 2} y={120 - eyeHeight / 2 - 2} width={eyeWidth + 4} height={eyeHeight / 2} fill="#000000" />
                      </g>
                    ) : editShape === 'heart' ? (
                      <g fill={editColor === '#22D3EE' ? '#FF3264' : editColor}>
                        <circle cx={100 - 18 + pupilX} cy={120 - 20 + pupilY} r={19} />
                        <circle cx={100 + 18 + pupilX} cy={120 - 20 + pupilY} r={19} />
                        <polygon points={`${100 - 36 + pupilX},${120 - 14 + pupilY} ${100 + 36 + pupilX},${120 - 14 + pupilY} ${100 + pupilX},${120 + 26 + pupilY}`} />
                        <circle cx={220 - 18 + pupilX} cy={120 - 20 + pupilY} r={19} />
                        <circle cx={220 + 18 + pupilX} cy={120 - 20 + pupilY} r={19} />
                        <polygon points={`${220 - 36 + pupilX},${120 - 14 + pupilY} ${220 + 36 + pupilX},${120 - 14 + pupilY} ${220 + pupilX},${120 + 26 + pupilY}`} />
                      </g>
                    ) : editShape === 'angry' ? (
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
                        <polygon points={`${100 - eyeWidth / 2},${120 - eyeHeight / 2} ${100 + eyeWidth / 2},${120 - eyeHeight / 2} ${100 + eyeWidth / 2},${120 - eyeHeight / 2 + 25}`} fill="#000000" />
                        <polygon points={`${220 - eyeWidth / 2},${120 - eyeHeight / 2} ${220 + eyeWidth / 2},${120 - eyeHeight / 2} ${220 - eyeWidth / 2},${120 - eyeHeight / 2 + 25}`} fill="#000000" />
                      </g>
                    ) : editShape === 'cat' ? (
                      <g>
                        <g fill="none" stroke={editColor} strokeWidth="10" strokeLinecap="round">
                          <path d="M 64 132 A 36 36 0 0 1 136 132" />
                          <path d="M 184 132 A 36 36 0 0 1 256 132" />
                        </g>
                        <polygon points="160,142 153,154 167,154" fill={editColor} />
                        <g fill="none" stroke={editColor} strokeWidth="3">
                          <path d="M 140 156 A 8 8 0 0 0 160 156" />
                          <path d="M 160 156 A 8 8 0 0 0 180 156" />
                        </g>
                        <circle cx={55} cy={146} r={10} fill="#FF82AA" />
                        <circle cx={265} cy={146} r={10} fill="#FF82AA" />
                        <line x1={35} y1={135} x2={59} y2={135} stroke={editColor} strokeWidth="2" />
                        <line x1={40} y1={148} x2={62} y2={148} stroke={editColor} strokeWidth="2" />
                        <line x1={261} y1={135} x2={285} y2={135} stroke={editColor} strokeWidth="2" />
                        <line x1={258} y1={148} x2={280} y2={148} stroke={editColor} strokeWidth="2" />
                      </g>
                    ) : (
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

                    {/* 3. Gloss */}
                    {hasGloss && editShape !== 'heart' && editShape !== 'happy' && editShape !== 'cat' && (
                      <g fill="#FFFFFF">
                        <circle cx={100 - eyeWidth / 4 + pupilX} cy={120 - eyeHeight / 4 + pupilY} r={5} />
                        <circle cx={220 - eyeWidth / 4 + pupilX} cy={120 - eyeHeight / 4 + pupilY} r={5} />
                      </g>
                    )}

                    {/* 4. Sparkles */}
                    {hasSparkle && (
                      <g fill="#FFDC64" fontSize="24" fontFamily="monospace" fontWeight="bold">
                        <text x={100 + 36} y={120 - 36}>*</text>
                        <text x={220 + 36} y={120 - 36}>*</text>
                      </g>
                    )}

                    {/* 5. Mouth */}
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
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FBFBFA] p-2.5 rounded-xl border border-[#EBEBEA]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[#191919] mr-1">팔레트:</span>
                    {['#22D3EE', '#F59E0B', '#10B981', '#F43F5E', '#8B5CF6', '#FFFFFF', '#090D16'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setDrawColor(c)}
                        className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${drawColor === c ? 'ring-2 ring-neutral-900 scale-110' : 'border-neutral-200'}`}
                        style={{ backgroundColor: c }}
                        title={c === '#090D16' ? '지우개' : c}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsMirror(!isMirror)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors cursor-pointer ${isMirror ? 'bg-neutral-900 border-neutral-900 text-white' : 'bg-white border-[#E5E5E3] text-neutral-700'}`}
                    >
                      🔄 좌우대칭 {isMirror ? 'ON' : 'OFF'}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearPixelGrid}
                      className="px-2 py-1 bg-white hover:bg-rose-50 border border-[#E5E5E3] hover:border-rose-200 text-neutral-500 hover:text-rose-600 rounded-lg text-[10px] font-medium transition-colors cursor-pointer"
                    >
                      전체지우기
                    </button>
                  </div>
                </div>

                {/* 16x16 Drawing Grid */}
                <div className="flex flex-col items-center">
                  <div className="text-[10px] text-[#787774] mb-1 font-mono">마우스로 클릭하거나 드래그하여 픽셀 도안을 그려보세요</div>
                  <div 
                    onMouseDown={() => setIsMouseDown(true)}
                    onMouseUp={() => setIsMouseDown(false)}
                    onMouseLeave={() => setIsMouseDown(false)}
                    className="grid grid-cols-16 gap-[1.5px] bg-[#2C2C2E] p-2 rounded-xl border border-neutral-700 shadow-md select-none cursor-crosshair"
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
                  <span className="font-semibold text-[#191919] text-[11px]">추천 도안:</span>
                  <button type="button" onClick={() => handleLoadPixelPreset('heart')} className="px-2.5 py-1 bg-white hover:bg-neutral-50 text-neutral-700 rounded-lg text-[10px] font-medium border border-[#E5E5E3] cursor-pointer">
                    ❤️ 하트 픽셀
                  </button>
                  <button type="button" onClick={() => handleLoadPixelPreset('star')} className="px-2.5 py-1 bg-white hover:bg-neutral-50 text-neutral-700 rounded-lg text-[10px] font-medium border border-[#E5E5E3] cursor-pointer">
                    ⭐ 별 픽셀
                  </button>
                </div>

              </div>
            ) : (
              /* Editor Mode 2: Fine-Tuning Parameter Sliders with Base Preset Importer */
              <div className="space-y-4 text-xs">
                
                {/* 1. Base Preset Importer */}
                <div className="bg-[#FBFBFA] p-3 rounded-xl border border-[#EBEBEA] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-[#191919] flex items-center gap-1.5">
                      <span>📥</span> 1. 기존 기본 표정 불러오기
                    </label>
                    <span className="text-[10px] text-[#787774]">클릭 시 기본 형태를 가져옵니다</span>
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
                        className={`py-1.5 px-2 rounded-lg font-medium text-[11px] border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          editShape === p.id 
                            ? 'bg-neutral-900 border-neutral-900 text-white shadow-2xs font-bold' 
                            : 'bg-white hover:bg-neutral-50 border-[#E5E5E3] text-neutral-700'
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
                    <label className="font-bold text-[#191919]">표정 이름</label>
                    <input 
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="e.g. Sparkle Eyes"
                      className="w-full p-2 bg-white border border-[#E5E5E3] rounded-xl outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 font-medium transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-[#191919]">대표 이모지</label>
                    <select 
                      value={editEmoji}
                      onChange={(e) => setEditEmoji(e.target.value)}
                      className="w-full p-2 bg-white border border-[#E5E5E3] rounded-xl outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 font-medium cursor-pointer transition-all"
                    >
                      {['🥹', '😜', '🤩', '💖', '😈', '😭', '🐶', '🦄', '⭐', '✨', '🤖', '😆', '😡', '😢', '😴', '😲', '😉', '👀', '🐱'].map(e => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-[#191919]">눈 색상</label>
                    <div className="flex items-center gap-1.5 p-1 bg-white border border-[#E5E5E3] rounded-xl h-[38px]">
                      {['#22D3EE', '#F59E0B', '#10B981', '#F43F5E', '#8B5CF6', '#FFFFFF'].map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditColor(c)}
                          className={`flex-1 h-6 rounded-md transition-all cursor-pointer ${editColor === c ? 'ring-2 ring-neutral-900 scale-105 shadow-2xs' : 'opacity-70 hover:opacity-100'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Shape & Mouth Selectors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="font-bold text-[#191919]">기본 눈 모양 (Shape)</label>
                    <select
                      value={editShape}
                      onChange={(e: any) => setEditShape(e.target.value)}
                      className="w-full p-2 bg-white border border-[#E5E5E3] rounded-xl outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 font-medium cursor-pointer transition-all"
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
                    <label className="font-bold text-[#191919]">입 모양 (Mouth)</label>
                    <select
                      value={editMouth}
                      onChange={(e: any) => setEditMouth(e.target.value)}
                      className="w-full p-2 bg-white border border-[#E5E5E3] rounded-xl outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 font-medium cursor-pointer transition-all"
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
                <div className="grid grid-cols-2 gap-3 bg-[#FBFBFA] p-3.5 rounded-xl border border-[#EBEBEA]">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-medium text-[#191919]">
                      <span>눈 가로 폭</span>
                      <span className="font-mono text-neutral-600">{eyeWidth}px</span>
                    </div>
                    <input type="range" min={40} max={110} value={eyeWidth} onChange={e => setEyeWidth(+e.target.value)} className="w-full accent-blue-600 cursor-pointer" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-medium text-[#191919]">
                      <span>눈 세로 높이</span>
                      <span className="font-mono text-neutral-600">{eyeHeight}px</span>
                    </div>
                    <input type="range" min={20} max={90} value={eyeHeight} onChange={e => setEyeHeight(+e.target.value)} className="w-full accent-blue-600 cursor-pointer" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-medium text-[#191919]">
                      <span>동공 좌우 위치 (Pupil X)</span>
                      <span className="font-mono text-neutral-600">{pupilX}px</span>
                    </div>
                    <input type="range" min={-20} max={20} value={pupilX} onChange={e => setPupilX(+e.target.value)} className="w-full accent-blue-600 cursor-pointer" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-medium text-[#191919]">
                      <span>동공 상하 위치 (Pupil Y)</span>
                      <span className="font-mono text-neutral-600">{pupilY}px</span>
                    </div>
                    <input type="range" min={-20} max={20} value={pupilY} onChange={e => setPupilY(+e.target.value)} className="w-full accent-blue-600 cursor-pointer" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-medium text-[#191919]">
                      <span>눈썹 사선 각도</span>
                      <span className="font-mono text-neutral-600">{eyebrowTilt}°</span>
                    </div>
                    <input type="range" min={-45} max={45} value={eyebrowTilt} onChange={e => setEyebrowTilt(+e.target.value)} className="w-full accent-blue-600 cursor-pointer" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-medium text-[#191919]">
                      <span>모서리 둥글기 (Radius)</span>
                      <span className="font-mono text-neutral-600">{eyeRadius}px</span>
                    </div>
                    <input type="range" min={0} max={35} value={eyeRadius} onChange={e => setEyeRadius(+e.target.value)} className="w-full accent-blue-600 cursor-pointer" />
                  </div>
                </div>

                {/* 5. Overlays (반짝이 & 광택) */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setHasSparkle(!hasSparkle)}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${hasSparkle ? 'bg-neutral-900 border-neutral-900 text-white' : 'bg-white border-[#E5E5E3] text-neutral-700'}`}
                  >
                    ✨ 반짝이 오버레이 {hasSparkle ? 'ON' : 'OFF'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setHasGloss(!hasGloss)}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${hasGloss ? 'bg-neutral-900 border-neutral-900 text-white' : 'bg-white border-[#E5E5E3] text-neutral-700'}`}
                  >
                    💎 광택 하이라이트 {hasGloss ? 'ON' : 'OFF'}
                  </button>
                </div>

              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center gap-2 border-t border-[#E5E5E3] pt-4">
              <button 
                type="button"
                onClick={() => setShowExprEditor(false)}
                className="py-2.5 px-4 bg-white border border-[#E5E5E3] text-neutral-700 text-xs font-medium rounded-xl hover:bg-neutral-50 transition-colors cursor-pointer"
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
                className="flex-1 py-2.5 bg-white hover:bg-neutral-50 border border-[#E5E5E3] text-neutral-800 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Zap className="w-3.5 h-3.5 text-blue-600" />
                소다봇 화면에 즉시 테스트 ⚡
              </button>
              <button 
                type="button"
                onClick={handleSaveCustomExpr}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
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
