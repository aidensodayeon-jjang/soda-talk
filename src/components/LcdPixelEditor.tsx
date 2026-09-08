import React, { useState, useEffect, useRef } from 'react';
import { 
  Palette, 
  Play, 
  Square, 
  Copy, 
  Check, 
  Download, 
  Sparkles, 
  Layers, 
  Code2, 
  ChevronRight, 
  Monitor, 
  Eraser, 
  PenTool, 
  PaintBucket, 
  FlipHorizontal, 
  Trash2,
  Image as ImageIcon,
  Film
} from 'lucide-react';

interface LcdPixelEditorProps {
  onExportCode?: (code: string) => void;
}

// 16비트 RGB565 색상 팔레트
interface ColorOption {
  name: string;
  hex: string;
  st77xx: string;
}

const COLOR_PALETTE: ColorOption[] = [
  { name: 'Black (배경)', hex: '#000000', st77xx: 'ST77XX_BLACK' },
  { name: 'White (흰색)', hex: '#FFFFFF', st77xx: 'ST77XX_WHITE' },
  { name: 'Cyan (시안/하늘)', hex: '#00FFFF', st77xx: 'ST77XX_CYAN' },
  { name: 'Yellow (노랑)', hex: '#FFE600', st77xx: 'ST77XX_YELLOW' },
  { name: 'Green (형광초록)', hex: '#00FF66', st77xx: 'ST77XX_GREEN' },
  { name: 'Magenta (핑크)', hex: '#FF00FF', st77xx: 'ST77XX_MAGENTA' },
  { name: 'Orange (주황)', hex: '#FF8800', st77xx: 'ST77XX_ORANGE' },
  { name: 'Red (빨강)', hex: '#FF2244', st77xx: 'ST77XX_RED' },
  { name: 'Blue (파랑)', hex: '#0088FF', st77xx: 'ST77XX_BLUE' }
];

// 샘플 표정 프리셋
const EXPRESSION_PRESETS: { [key: string]: { name: string; icon: string; f1: number[][]; f2: number[][] } } = {
  smile: {
    name: "기본 미소 (눈 깜빡임)",
    icon: "😊",
    f1: [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,1,1,1,0,0,0,0,0,0,1,1,1,0,0],
      [0,1,1,1,1,1,0,0,0,0,1,1,1,1,1,0],
      [0,1,1,0,1,1,0,0,0,0,1,1,0,1,1,0],
      [0,1,1,0,1,1,0,0,0,0,1,1,0,1,1,0],
      [0,1,1,1,1,1,0,0,0,0,1,1,1,1,1,0],
      [0,0,1,1,1,0,0,0,0,0,0,1,1,1,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,2,0,0,0,0,0,0,0,0,0,0,0,0,2,0],
      [0,2,2,0,0,0,0,0,0,0,0,0,0,2,2,0],
      [0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0],
      [0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0],
      [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ],
    f2: [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,1,1,1,1,1,0,0,0,0,1,1,1,1,1,0],
      [0,1,1,1,1,1,0,0,0,0,1,1,1,1,1,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,2,0,0,0,0,0,0,0,0,0,0,0,0,2,0],
      [0,2,2,0,0,0,0,0,0,0,0,0,0,2,2,0],
      [0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ]
  },
  wink: {
    name: "윙크 & 활짝 웃기",
    icon: "😉",
    f1: [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
      [0,1,1,1,1,1,0,0,0,0,0,1,1,0,0,0],
      [0,1,1,0,1,1,0,0,0,0,1,1,1,1,0,0],
      [0,1,1,0,1,1,0,0,0,1,1,0,0,1,1,0],
      [0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0],
      [0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,2,2,0,0,0,0,0,0,0,0,0,0,2,2,0],
      [0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ],
    f2: [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0],
      [0,1,1,1,1,0,0,0,0,0,0,1,1,1,1,0],
      [1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,2,2,0,0,0,0,0,0,0,0,0,0,2,2,0],
      [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ]
  },
  heart: {
    name: "하트눈 (사랑에 빠짐)",
    icon: "😍",
    f1: [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,1,1,0,1,1,0,0,1,1,0,1,1,0,0],
      [0,1,2,2,1,2,2,1,1,2,2,1,2,2,1,0],
      [0,1,2,2,2,2,2,1,1,2,2,2,2,2,1,0],
      [0,1,2,2,2,2,2,1,1,2,2,2,2,2,1,0],
      [0,0,1,2,2,2,1,0,0,1,2,2,2,1,0,0],
      [0,0,0,1,2,1,0,0,0,0,1,2,1,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,2,2,0,0,0,0,0,0,0,0,0,0,2,2,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0],
      [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ],
    f2: [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,1,2,2,0,2,2,1,0,1,2,2,0,2,2,1],
      [1,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2],
      [1,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2],
      [1,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2],
      [0,1,2,2,2,2,2,1,0,1,2,2,2,2,2,1],
      [0,0,1,2,2,2,1,0,0,0,1,2,2,2,1,0],
      [0,0,0,1,2,1,0,0,0,0,0,1,2,1,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      [0,2,2,0,0,0,0,0,0,0,0,0,0,2,2,0],
      [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ]
  },
  surprise: {
    name: "깜짝 놀람 (동공 확장)",
    icon: "😮",
    f1: [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,1,1,1,0,0,0,0,0,0,1,1,1,0,0],
      [0,1,1,1,1,1,0,0,0,0,1,1,1,1,1,0],
      [0,1,1,0,1,1,0,0,0,0,1,1,0,1,1,0],
      [0,1,1,1,1,1,0,0,0,0,1,1,1,1,1,0],
      [0,0,1,1,1,0,0,0,0,0,0,1,1,1,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
      [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
      [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
      [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
      [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ],
    f2: [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,1,1,1,1,1,0,0,0,0,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1],
      [1,1,0,0,0,1,1,0,0,1,1,0,0,0,1,1],
      [1,1,0,0,0,1,1,0,0,1,1,0,0,0,1,1],
      [1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,0,0,0,0,1,1,1,1,1,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0],
      [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0],
      [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0],
      [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ]
  }
};

const GRID_SIZES = [16, 24, 32];

export default function LcdPixelEditor({ onExportCode }: LcdPixelEditorProps) {
  // 모드 선택: 1장(단일 정지 화면) vs 2장(애니메이션)
  const [frameMode, setFrameMode] = useState<1 | 2>(2);
  const [activeFrame, setActiveFrame] = useState<1 | 2>(1);

  const [gridSize, setGridSize] = useState<number>(16);
  const [selectedTool, setSelectedTool] = useState<'pen' | 'eraser' | 'fill'>('pen');
  const [selectedColor, setSelectedColor] = useState<string>('#FFFFFF');
  const [accentColor, setAccentColor] = useState<string>('#FF2244'); // 볼터치/포인트 컬러

  // 프레임 데이터
  const createEmptyGrid = (size: number) => Array(size).fill(0).map(() => Array(size).fill(0));

  const [frame1, setFrame1] = useState<number[][]>(() => EXPRESSION_PRESETS.smile.f1);
  const [frame2, setFrame2] = useState<number[][]>(() => EXPRESSION_PRESETS.smile.f2);

  // 시뮬레이터 애니메이션 재생 상태
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [animFps, setAnimFps] = useState<number>(2); // 초당 2회 (0.5초 간격)
  const [simCurrentFrame, setSimCurrentFrame] = useState<1 | 2>(1);

  // 코드 생성 및 복사 상태
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'code'>('editor');

  const isDrawing = useRef(false);

  // 2장 모드일 때 애니메이션 루프
  useEffect(() => {
    if (frameMode === 1 || !isPlaying) {
      setSimCurrentFrame(activeFrame);
      return;
    }
    const interval = setInterval(() => {
      setSimCurrentFrame(prev => (prev === 1 ? 2 : 1));
    }, 1000 / animFps);

    return () => clearInterval(interval);
  }, [frameMode, isPlaying, animFps, activeFrame]);

  // 그리드 리사이즈 시 초기화
  const handleGridSizeChange = (newSize: number) => {
    setGridSize(newSize);
    setFrame1(createEmptyGrid(newSize));
    setFrame2(createEmptyGrid(newSize));
  };

  // 프리셋 로드
  const loadPreset = (presetKey: string) => {
    const p = EXPRESSION_PRESETS[presetKey];
    if (!p) return;
    setGridSize(16);
    setFrame1(JSON.parse(JSON.stringify(p.f1)));
    setFrame2(JSON.parse(JSON.stringify(p.f2)));
  };

  const currentGrid = (frameMode === 1 || activeFrame === 1) ? frame1 : frame2;
  const setCurrentGrid = (newGrid: number[][]) => {
    if (frameMode === 1 || activeFrame === 1) setFrame1(newGrid);
    else setFrame2(newGrid);
  };

  // 픽셀 클릭/드래그 핸들러
  const handlePixelAction = (r: number, c: number) => {
    const newGrid = currentGrid.map(row => [...row]);
    let val = 0;
    if (selectedTool === 'pen') {
      val = selectedColor === accentColor ? 2 : 1;
    } else if (selectedTool === 'eraser') {
      val = 0;
    } else if (selectedTool === 'fill') {
      const targetVal = newGrid[r][c];
      const fillVal = selectedColor === accentColor ? 2 : 1;
      if (targetVal === fillVal) return;

      const floodFill = (row: number, col: number) => {
        if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) return;
        if (newGrid[row][col] !== targetVal) return;
        newGrid[row][col] = fillVal;
        floodFill(row + 1, col);
        floodFill(row - 1, col);
        floodFill(row, col + 1);
        floodFill(row, col - 1);
      };
      floodFill(r, c);
      setCurrentGrid(newGrid);
      return;
    }
    newGrid[r][c] = val;
    setCurrentGrid(newGrid);
  };

  // 전체 지우기
  const handleClear = () => {
    if (window.confirm("현재 캔버스를 모두 지우시겠습니까?")) {
      setCurrentGrid(createEmptyGrid(gridSize));
    }
  };

  // 좌우 반전
  const handleFlip = () => {
    const newGrid = currentGrid.map(row => [...row].reverse());
    setCurrentGrid(newGrid);
  };

  // 1번 프레임 -> 2번 프레임 복사
  const handleCopyFrame1To2 = () => {
    if (activeFrame === 1) {
      setFrame2(JSON.parse(JSON.stringify(frame1)));
      alert("프레임 1의 그림이 프레임 2로 복사되었습니다!");
    } else {
      setFrame1(JSON.parse(JSON.stringify(frame2)));
      alert("프레임 2의 그림이 프레임 1로 복사되었습니다!");
    }
  };

  // 비트맵 C++ 아두이노 코드 생성기
  const generateArduinoCode = () => {
    const generateArrayCode = (grid: number[][], varName: string) => {
      let lines = `// ${varName} (${gridSize}x${gridSize} RGB565 비트맵)\n`;
      lines += `const uint16_t ${varName}[${gridSize * gridSize}] PROGMEM = {\n`;
      
      const flat: string[] = [];
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          const val = grid[r][c];
          if (val === 1) flat.push("ST77XX_WHITE");
          else if (val === 2) flat.push("ST77XX_RED");
          else flat.push("ST77XX_BLACK");
        }
      }

      for (let i = 0; i < flat.length; i += 8) {
        const slice = flat.slice(i, i + 8);
        lines += "  " + slice.join(", ") + (i + 8 < flat.length ? ",\n" : "\n");
      }
      lines += `};\n`;
      return lines;
    };

    if (frameMode === 1) {
      // 1장 단일 정지 화면 코드
      const f1Code = generateArrayCode(frame1, "face_image");
      return `#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <SPI.h>

// ==========================================
// 핀 설정 (소다봇 2.0" LCD)
// ==========================================
#define TFT_MOSI 11
#define TFT_CLK  12
#define TFT_CS   13
#define TFT_DC   7
#define TFT_RST  6

SPIClass hspi(HSPI);
Adafruit_ST7789 tft = Adafruit_ST7789(&hspi, TFT_CS, TFT_DC, TFT_RST);

#define ICON_SIZE ${gridSize}
#define SCALE 7   // 화면 확대 배율

// ==========================================
// 🎨 소다봇 1장 단일 화면 비트맵 데이터
// ==========================================
${f1Code}

// 비트맵 렌더링 함수
void drawFace(const uint16_t* bitmap, int startX, int startY, int scale) {
  for (int r = 0; r < ICON_SIZE; r++) {
    for (int c = 0; c < ICON_SIZE; c++) {
      uint16_t color = pgm_read_word(&bitmap[r * ICON_SIZE + c]);
      tft.fillRect(startX + c * scale, startY + r * scale, scale, scale, color);
    }
  }
}

void setup() {
  Serial.begin(115200);

  // LCD 초기화
  hspi.begin(TFT_CLK, -1, TFT_MOSI, TFT_CS);
  tft.init(240, 320);
  tft.setSPISpeed(4000000);
  tft.setRotation(3);       // 320x240 가로 모드
  tft.invertDisplay(true);
  tft.fillScreen(ST77XX_BLACK);

  // 상단 바
  tft.fillRect(0, 0, 320, 24, 0x18E3);
  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(2);
  tft.setCursor(10, 4);
  tft.print("SODABOT Face");

  // 화면 중앙에 표정 출력 (1장 정지 화면)
  int centerX = (320 - ICON_SIZE * SCALE) / 2;
  int centerY = 30 + (200 - ICON_SIZE * SCALE) / 2;
  drawFace(face_image, centerX, centerY, SCALE);
}

void loop() {
  // 1장 단일 화면 유지
}
`;
    }

    // 2장 애니메이션 코드 (1초 간격 자동 깜빡임 / 전환)
    const f1Code = generateArrayCode(frame1, "face_frame_1");
    const f2Code = generateArrayCode(frame2, "face_frame_2");

    return `#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <SPI.h>

// ==========================================
// 핀 설정 (소다봇 2.0" LCD)
// ==========================================
#define TFT_MOSI 11
#define TFT_CLK  12
#define TFT_CS   13
#define TFT_DC   7
#define TFT_RST  6

SPIClass hspi(HSPI);
Adafruit_ST7789 tft = Adafruit_ST7789(&hspi, TFT_CS, TFT_DC, TFT_RST);

#define ICON_SIZE ${gridSize}
#define SCALE 7   // 화면 확대 배율

// ==========================================
// 🎨 소다봇 2장 애니메이션 비트맵 데이터
// ==========================================
${f1Code}
${f2Code}

// 비트맵 렌더링 함수
void drawFace(const uint16_t* bitmap, int startX, int startY, int scale) {
  for (int r = 0; r < ICON_SIZE; r++) {
    for (int c = 0; c < ICON_SIZE; c++) {
      uint16_t color = pgm_read_word(&bitmap[r * ICON_SIZE + c]);
      tft.fillRect(startX + c * scale, startY + r * scale, scale, scale, color);
    }
  }
}

void setup() {
  Serial.begin(115200);

  // LCD 초기화
  hspi.begin(TFT_CLK, -1, TFT_MOSI, TFT_CS);
  tft.init(240, 320);
  tft.setSPISpeed(4000000);
  tft.setRotation(3);       // 320x240 가로 모드
  tft.invertDisplay(true);
  tft.fillScreen(ST77XX_BLACK);

  // 상단 바
  tft.fillRect(0, 0, 320, 24, 0x18E3);
  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(2);
  tft.setCursor(10, 4);
  tft.print("SODABOT Animation");
}

void loop() {
  int centerX = (320 - ICON_SIZE * SCALE) / 2;
  int centerY = 30 + (200 - ICON_SIZE * SCALE) / 2;

  // 1. 프레임 1 (기본 표정) 출력
  drawFace(face_frame_1, centerX, centerY, SCALE);
  delay(1200); // 1.2초 유지

  // 2. 프레임 2 (깜빡임/반응 표정) 출력
  drawFace(face_frame_2, centerX, centerY, SCALE);
  delay(400);  // 0.4초 깜빡임
}
`;
  };

  const handleCopyCode = async () => {
    const code = generateArduinoCode();
    let copiedSuccess = false;

    // 1. Modern Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(code);
        copiedSuccess = true;
      } catch (e) {
        console.warn('Clipboard API error, trying fallback', e);
      }
    }

    // 2. Textarea Fallback
    if (!copiedSuccess) {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = code;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copiedSuccess = document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch (err) {
        console.error("ExecCommand copy failed", err);
      }
    }

    if (copiedSuccess) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      window.prompt("아래 코드를 복사(Ctrl+C / Cmd+C)하세요:", code);
    }
  };

  const handleDownloadIno = () => {
    const code = generateArduinoCode();
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = frameMode === 1 ? 'soda-3-4-face-single.ino' : 'soda-3-4-face-anim.ino';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF9F6] overflow-hidden relative">
      {/* 복사 완료 안내 토스트 */}
      {copied && (
        <div className="fixed top-20 right-8 z-50 bg-[#181825] text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            ✓
          </div>
          <div>
            <p className="text-xs font-black text-emerald-300">클립보드에 코드 복사 완료!</p>
            <p className="text-[11px] text-[#A6ADC8]">아두이노 IDE 에디터에 <kbd className="px-1 py-0.5 bg-neutral-800 rounded font-mono text-[10px] text-amber-300">Ctrl+V</kbd> 또는 <kbd className="px-1 py-0.5 bg-neutral-800 rounded font-mono text-[10px] text-amber-300">Cmd+V</kbd> 로 붙여넣으세요.</p>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="px-6 py-3.5 bg-white border-b border-[#EAE6DF] flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-100">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-tight text-[#1D1D1F]">2.0" LCD 화면편집기 (소다봇 표정 스튜디오)</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                3주차 도구
              </span>
            </div>
            <p className="text-xs text-[#86868B]">마우스로 픽셀을 그리고, 1장 정지 화면 또는 2장 애니메이션 아두이노 코드를 바로 생성하세요.</p>
          </div>
        </div>

        {/* 1장 vs 2장 모드 선택 및 복사/다운로드 툴바 */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 심플한 1장 / 2장 모드 선택기 */}
          <div className="flex bg-[#F5F2EC] p-1 rounded-2xl border border-[#EAE6DF] shadow-inner">
            <button
              onClick={() => { setFrameMode(1); setActiveFrame(1); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                frameMode === 1
                  ? 'bg-white text-indigo-700 shadow-sm border border-[#EAE6DF]'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
              1장 정지 화면
            </button>
            <button
              onClick={() => setFrameMode(2)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                frameMode === 2
                  ? 'bg-white text-purple-700 shadow-sm border border-[#EAE6DF]'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              <Film className="w-3.5 h-3.5 text-purple-500" />
              2장 애니메이션
            </button>
          </div>

          <div className="h-5 w-px bg-[#EAE6DF]" />

          {/* 탭 전환 (캔버스 vs 코드) */}
          <div className="flex bg-[#F5F2EC] p-1 rounded-xl border border-[#EAE6DF]">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'editor' ? 'bg-white text-indigo-700 shadow-xs' : 'text-[#86868B] hover:text-[#1D1D1F]'}`}
            >
              <Palette className="w-3.5 h-3.5" /> 캔버스
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'code' ? 'bg-white text-indigo-700 shadow-xs' : 'text-[#86868B] hover:text-[#1D1D1F]'}`}
            >
              <Code2 className="w-3.5 h-3.5" /> 코드 보기
            </button>
          </div>

          {/* 복사 및 다운로드 */}
          <button
            onClick={handleCopyCode}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-md ${
              copied
                ? "bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400 shadow-emerald-900/30"
                : "bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-indigo-500/25"
            }`}
          >
            {copied ? <Check className="w-4 h-4 text-emerald-200 animate-bounce" /> : <Copy className="w-4 h-4" />}
            {copied ? '복사 완료!' : '📋 코드 전체 복사하기'}
          </button>

          <button
            onClick={handleDownloadIno}
            className="px-3.5 py-2 bg-white hover:bg-[#F5F2EC] active:scale-98 text-[#1D1D1F] border border-[#EAE6DF] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <Download className="w-4 h-4 text-indigo-600" /> .ino 저장
          </button>
        </div>
      </div>

      {activeTab === 'editor' ? (
        <div className="flex-1 flex overflow-hidden p-6 gap-6">
          {/* Left Column: Preset Templates & Frame Switcher (if 2 frames) */}
          <div className="w-72 flex flex-col gap-4 overflow-y-auto pr-1">
            {/* 2장 애니메이션 모드일 때만 프레임 1 / 프레임 2 선택 표시 */}
            {frameMode === 2 ? (
              <div className="bg-white p-4 rounded-3xl border border-[#EAE6DF] shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#1D1D1F] flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-purple-600" /> 프레임 전환 (2장)
                  </span>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    애니메이션 모드
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setActiveFrame(1)}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${activeFrame === 1 ? 'border-indigo-600 bg-indigo-50/80 shadow-xs ring-2 ring-indigo-300/50' : 'border-[#EAE6DF] hover:border-gray-300 bg-[#FAF9F6]'}`}
                  >
                    <span className="block text-xs font-black text-[#1D1D1F]">Frame 1</span>
                    <span className="text-[10px] text-indigo-600 font-bold">기본 표정</span>
                  </button>

                  <button
                    onClick={() => setActiveFrame(2)}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${activeFrame === 2 ? 'border-purple-600 bg-purple-50/80 shadow-xs ring-2 ring-purple-300/50' : 'border-[#EAE6DF] hover:border-gray-300 bg-[#FAF9F6]'}`}
                  >
                    <span className="block text-xs font-black text-[#1D1D1F]">Frame 2</span>
                    <span className="text-[10px] text-purple-600 font-bold">변화 표정</span>
                  </button>
                </div>

                <button
                  onClick={handleCopyFrame1To2}
                  className="w-full py-2 px-3 bg-[#FAF9F6] hover:bg-[#F5F2EC] border border-[#EAE6DF] rounded-xl text-[11px] font-bold text-[#5C5B57] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-indigo-500" />
                  {activeFrame === 1 ? '프레임 1 ➔ 프레임 2로 복사' : '프레임 2 ➔ 프레임 1로 복사'}
                </button>
              </div>
            ) : (
              <div className="bg-indigo-50/60 p-4 rounded-3xl border border-indigo-200/80 shadow-xs flex items-center gap-3">
                <div className="w-8 h-8 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-indigo-950">1장 정지 화면 편집 중</h4>
                  <p className="text-[10px] text-indigo-700">단일 표정/아이콘을 깔끔하게 그립니다.</p>
                </div>
              </div>
            )}

            {/* Presets List */}
            <div className="bg-white p-4 rounded-3xl border border-[#EAE6DF] shadow-xs space-y-3">
              <span className="text-xs font-black text-[#1D1D1F] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" /> 추천 표정 프리셋
              </span>
              <div className="space-y-1.5">
                {Object.entries(EXPRESSION_PRESETS).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => loadPreset(key)}
                    className="w-full px-3 py-2 rounded-xl text-left border border-[#EAE6DF] hover:border-indigo-300 hover:bg-indigo-50/50 flex items-center justify-between transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{p.icon}</span>
                      <span className="text-xs font-bold text-[#1D1D1F] group-hover:text-indigo-700">{p.name}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[#86868B] group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>

            {/* Grid Size Option */}
            <div className="bg-white p-4 rounded-3xl border border-[#EAE6DF] shadow-xs space-y-2">
              <span className="text-xs font-black text-[#1D1D1F]">캔버스 해상도</span>
              <div className="grid grid-cols-3 gap-1.5">
                {GRID_SIZES.map(size => (
                  <button
                    key={size}
                    onClick={() => handleGridSizeChange(size)}
                    className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${gridSize === size ? 'bg-indigo-600 text-white shadow-xs' : 'bg-[#FAF9F6] text-[#5C5B57] hover:bg-[#F5F2EC] border border-[#EAE6DF]'}`}
                  >
                    {size}x{size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Center Column: Pixel Canvas & Drawing Tools */}
          <div className="flex-1 bg-white p-6 rounded-3xl border border-[#EAE6DF] shadow-xs flex flex-col items-center justify-between">
            {/* Tool Bar */}
            <div className="w-full flex items-center justify-between pb-4 border-b border-[#EAE6DF]">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSelectedTool('pen')}
                  className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${selectedTool === 'pen' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-[#FAF9F6] text-[#5C5B57] hover:bg-[#F5F2EC] border border-[#EAE6DF]'}`}
                  title="펜 그리기"
                >
                  <PenTool className="w-4 h-4" /> 펜
                </button>
                <button
                  onClick={() => setSelectedTool('eraser')}
                  className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${selectedTool === 'eraser' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-[#FAF9F6] text-[#5C5B57] hover:bg-[#F5F2EC] border border-[#EAE6DF]'}`}
                  title="지우개"
                >
                  <Eraser className="w-4 h-4" /> 지우개
                </button>
                <button
                  onClick={() => setSelectedTool('fill')}
                  className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${selectedTool === 'fill' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-[#FAF9F6] text-[#5C5B57] hover:bg-[#F5F2EC] border border-[#EAE6DF]'}`}
                  title="영역 채우기"
                >
                  <PaintBucket className="w-4 h-4" /> 채우기
                </button>
              </div>

              {/* Color Palette */}
              <div className="flex items-center gap-1.5 bg-[#FAF9F6] p-1.5 rounded-2xl border border-[#EAE6DF]">
                <span className="text-[10px] font-bold text-[#86868B] px-1.5">색상:</span>
                {COLOR_PALETTE.map(c => (
                  <button
                    key={c.hex}
                    onClick={() => { setSelectedColor(c.hex); setSelectedTool('pen'); }}
                    className={`w-6 h-6 rounded-lg transition-transform cursor-pointer border ${selectedColor === c.hex ? 'scale-115 ring-2 ring-indigo-500 shadow-sm' : 'hover:scale-105 border-black/10'}`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  />
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleFlip}
                  className="p-2 bg-[#FAF9F6] hover:bg-[#F5F2EC] text-[#5C5B57] border border-[#EAE6DF] rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="좌우 대칭 반전"
                >
                  <FlipHorizontal className="w-4 h-4" /> 좌우반전
                </button>
                <button
                  onClick={handleClear}
                  className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="전체 지우기"
                >
                  <Trash2 className="w-4 h-4" /> 지우기
                </button>
              </div>
            </div>

            {/* Pixel Grid Canvas */}
            <div className="my-auto flex items-center justify-center">
              <div 
                className="bg-black p-3 rounded-2xl border-4 border-[#2C2C2E] shadow-xl select-none"
                onMouseDown={() => { isDrawing.current = true; }}
                onMouseUp={() => { isDrawing.current = false; }}
                onMouseLeave={() => { isDrawing.current = false; }}
              >
                <div 
                  className="grid gap-[1px] bg-neutral-900"
                  style={{
                    gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                    width: gridSize === 16 ? '320px' : gridSize === 24 ? '360px' : '400px',
                    height: gridSize === 16 ? '320px' : gridSize === 24 ? '360px' : '400px',
                  }}
                >
                  {currentGrid.map((row, r) => 
                    row.map((val, c) => {
                      let cellColor = '#000000';
                      if (val === 1) cellColor = selectedColor || '#FFFFFF';
                      else if (val === 2) cellColor = accentColor || '#FF2244';

                      return (
                        <div
                          key={`${r}-${c}`}
                          onMouseDown={() => handlePixelAction(r, c)}
                          onMouseEnter={() => {
                            if (isDrawing.current) handlePixelAction(r, c);
                          }}
                          className="w-full h-full cursor-crosshair transition-colors hover:brightness-125"
                          style={{ backgroundColor: cellColor }}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Status Footer */}
            <div className="w-full flex items-center justify-between pt-3 border-t border-[#EAE6DF] text-xs text-[#86868B]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>
                  {frameMode === 1 ? (
                    <b>1장 정지 화면 편집 모드</b>
                  ) : (
                    <span>현재 편집 중: <b className="text-[#1D1D1F]">프레임 {activeFrame} ({activeFrame === 1 ? '기본 표정' : '변화 표정'})</b></span>
                  )}
                </span>
              </div>
              <span className="text-[11px] font-mono">해상도 {gridSize}x{gridSize} | ST7789 RGB565</span>
            </div>
          </div>

          {/* Right Column: 2.0" LCD Hardware Live Preview */}
          <div className="w-80 bg-white p-5 rounded-3xl border border-[#EAE6DF] shadow-xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#1D1D1F] flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-indigo-600" /> 2.0" LCD 실시간 화면
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-neutral-900 text-amber-400">
                  ST7789 320x240
                </span>
              </div>

              {/* LCD Display Device Bezel */}
              <div className="bg-[#1C1C1E] p-3 rounded-2xl border-4 border-[#3A3A3C] shadow-lg">
                <div className="bg-black w-full h-48 rounded-lg overflow-hidden flex flex-col justify-between p-2.5 relative">
                  {/* Top Bar of simulated LCD */}
                  <div className="flex items-center justify-between text-[8px] font-mono text-cyan-400 border-b border-neutral-800 pb-1">
                    <span>SODABOT 2.0" LCD</span>
                    <span>{frameMode === 1 ? 'SINGLE' : `ANIM (F${simCurrentFrame})`}</span>
                  </div>

                  {/* Centered Graphic on Simulated LCD */}
                  <div className="my-auto flex items-center justify-center">
                    <div 
                      className="grid gap-[0.5px]"
                      style={{
                        gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                        width: '110px',
                        height: '110px',
                      }}
                    >
                      {(frameMode === 1 ? frame1 : (isPlaying ? (simCurrentFrame === 1 ? frame1 : frame2) : currentGrid)).map((row, r) => 
                        row.map((val, c) => {
                          let color = '#000000';
                          if (val === 1) color = selectedColor || '#FFFFFF';
                          else if (val === 2) color = accentColor || '#FF2244';
                          return (
                            <div
                              key={`sim-${r}-${c}`}
                              style={{ backgroundColor: color }}
                              className="w-full h-full"
                            />
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Bottom info on simulated LCD */}
                  <div className="flex items-center justify-between text-[7px] font-mono text-[#86868B] pt-1 border-t border-neutral-900">
                    <span>ESP32-S3 SuperMini</span>
                    <span className="text-emerald-400 font-bold">● Display Ready</span>
                  </div>
                </div>
              </div>

              {/* 애니메이션 모드(2장)일 때만 재생/속도 컨트롤러 표시 */}
              {frameMode === 2 && (
                <div className="space-y-2 pt-2 bg-[#FAF9F6] p-3 rounded-2xl border border-[#EAE6DF]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#1D1D1F]">애니메이션 미리보기</span>
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${isPlaying ? 'bg-purple-600 text-white' : 'bg-white text-[#5C5B57] border border-[#EAE6DF]'}`}
                    >
                      {isPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                      {isPlaying ? '일시정지' : '재생'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#86868B]">
                    <span>전환 속도:</span>
                    <div className="flex items-center gap-1 font-bold text-[#1D1D1F]">
                      {[1, 2, 4].map(fps => (
                        <button
                          key={fps}
                          onClick={() => setAnimFps(fps)}
                          className={`px-2 py-0.5 rounded-md text-[10px] cursor-pointer ${animFps === fps ? 'bg-purple-100 text-purple-700 font-black' : 'text-[#86868B] hover:text-[#1D1D1F]'}`}
                        >
                          {fps}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 하단 안내 카드 */}
            <div className="p-3 bg-[#FAF9F6] rounded-2xl border border-[#EAE6DF] text-[11px] text-[#5C5B57] space-y-1">
              <p className="font-bold text-[#1D1D1F]">💡 아두이노 업로드 팁</p>
              <p className="text-[10px] text-[#86868B] leading-relaxed">
                {frameMode === 1
                  ? '상단의 [📋 코드 전체 복사하기]를 눌러 아두이노 IDE에 붙여넣고 업로드하면 화면에 그림이 나타납니다.'
                  : '상단의 [📋 코드 전체 복사하기]를 눌러 업로드하면 1.2초마다 눈을 깜빡이는 표정 애니메이션이 자동 재생됩니다.'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Code Tab: Live Generated Arduino C++ Source Code */
        <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-[#EAE6DF]">
            <div>
              <h3 className="text-sm font-bold text-[#1D1D1F]">
                {frameMode === 1 ? '생성된 2.0" LCD 1장 정지 화면 코드' : '생성된 2.0" LCD 2장 애니메이션 코드'}
              </h3>
              <p className="text-xs text-[#86868B]">
                {frameMode === 1
                  ? '선택한 비트맵 데이터를 화면 중앙에 선명하게 출력하는 완성형 아두이노 코드입니다.'
                  : '1번 표정과 2번 표정이 1초 간격으로 자동 깜빡이는 완성형 아두이노 애니메이션 코드입니다.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyCode}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                {copied ? '복사 완료!' : '코드 전체 복사'}
              </button>
              <button
                onClick={handleDownloadIno}
                className="px-4 py-2 bg-white hover:bg-[#F5F2EC] text-[#1D1D1F] border border-[#EAE6DF] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-indigo-600" /> .ino 다운로드
              </button>
            </div>
          </div>

          <div className="flex-1 bg-[#1E1E1E] rounded-3xl p-5 overflow-auto shadow-inner border border-neutral-800">
            <pre className="text-xs font-mono text-[#D4D4D4] leading-relaxed select-text">
              <code>{generateArduinoCode()}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
