import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import multer from "multer";
import wavefilePkg from "wavefile";
const { WaveFile } = wavefilePkg;
import { pipeline, env } from "@xenova/transformers";
import mysql from "mysql2/promise";

env.allowLocalModels = false;

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// MySQL Connection Pool for Student Master DB (edupilot)
let mysqlPool: any = null;
function getMysqlPool() {
  if (!mysqlPool) {
    mysqlPool = mysql.createPool({
      host: process.env.DATABASE_HOST || "localhost",
      port: parseInt(process.env.DATABASE_PORT || "3306", 10),
      user: process.env.DATABASE_USER || "root",
      password: process.env.DATABASE_PASSWORD || "12345678",
      database: process.env.DATABASE_NAME || "edupilot",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return mysqlPool;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  modelUsed?: string;
}

interface ChatRoom {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  messages: Message[];
}

interface User {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  role?: "admin" | "student" | "user";
  canAccessChat?: boolean;
  personalApiKey?: string;
  lastGptDate?: string;
  gptUsageCount?: number;
  persona?: string;
}

interface CourseContent {
  id: string;
  week: number;
  title: string;
  description: string;
  filename: string;
  language: "arduino" | "python" | "cpp" | "json";
  tags: string[];
  pinMap?: string;
  code: string;
  contentType?: "code" | "circuit" | "doc" | "editor";
  imageUrl?: string;
  updatedAt?: string;
}

const FIRMWARE_DIR = path.join(process.cwd(), 'firmware');

function getFirmwareCode(filename: string, fallbackCode: string = ""): string {
  try {
    const fullPath = path.join(FIRMWARE_DIR, filename);
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, 'utf8');
    }
  } catch (err) {
    console.error(`[Firmware] Failed to read ${filename}:`, err);
  }
  return fallbackCode;
}

const DEFAULT_COURSE_CONTENTS: CourseContent[] = [
  {
    id: "content-week-1-circuit-diagram",
    week: 1,
    title: "[배선도] 버튼 + LED + 스피커 회로 연결도",
    description: "ESP32-S3 SuperMini 보드와 MAX98357A I2S 앰프, 버튼(GPIO4), LED(GPIO2)의 핀 연결 배선도 및 하드웨어 회로 가이드입니다.",
    filename: "circuit_btn_led_speaker.png",
    language: "json",
    contentType: "circuit",
    imageUrl: "/images/circuit_btn_led_speaker.png",
    tags: ["배선도", "회로도", "ESP32-S3", "MAX98357A", "하드웨어"],
    pinMap: "버튼: GPIO4, LED: GPIO2, BCLK: GPIO5, LRC: GPIO3, DOUT: GPIO44, 전원: 5V, GND(공통)",
    updatedAt: new Date().toISOString(),
    code: `// [1-2주차] 버튼 + LED + 스피커 하드웨어 연결 요약
// ===================================================
// 부품          | ESP32-S3 핀  | 연결 대상
// -------------+-------------+-----------------------
// 버튼 입력    | GPIO4       | 버튼 한쪽 ➔ GND (INPUT_PULLUP)
// LED 출력     | GPIO2       | 220Ω 저항 ➔ LED(+), LED(-) ➔ GND
// I2S BCLK     | GPIO5       | MAX98357A BCLK
// I2S LRCK     | GPIO3       | MAX98357A LRC
// I2S DOUT     | GPIO44      | MAX98357A DIN
// 전원 5V      | 5V          | MAX98357A VDD
// 공통 GND     | GND         | 버튼, LED(-), MAX98357A GND
// ===================================================
// 동작: 버튼을 누르면(LOW) LED 켜짐 + 도-미-솔 사운드 출력`
  },
  {
    id: "content-week-1-sound",
    week: 1,
    title: "1-1. 스피커테스트 도레미파솔라시도",
    description: "I2S 디지털 앰프/스피커 핀(BCLK:5, LRC:3, DOUT:44)을 초기화하고 도레미파솔라시도 음계를 재생하는 소다봇 사운드 기초 실습입니다.",
    filename: "soda-1-1.ino",
    language: "arduino",
    tags: ["I2S", "스피커", "사운드", "ESP32", "도레미파솔라시도"],
    pinMap: "BCLK: D5, LRC: D3, DOUT: D44",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-1-1.ino")
  },
  {
    id: "content-week-1-btn-led-sound",
    week: 1,
    title: "1-2. 버튼 + LED + 스피커",
    description: "버튼(D4)을 누르면 LED(D2)가 켜지며 MAX98357A I2S 앰프 스피커를 통해 도-미-솔 화음 사운드를 출력하는 인터랙션 예제입니다.",
    filename: "soda-1-2.ino",
    language: "arduino",
    tags: ["버튼", "LED", "I2S", "스피커", "ESP32", "사운드"],
    pinMap: "LED: D2, 버튼: D4, 스피커: BCLK: D5, LRC: D3, DOUT: D44",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-1-2.ino")
  },
  {
    id: "content-week-3-circuit-diagram",
    week: 3,
    title: "[배선도] 2.0\" LCD + 버튼 + LED + 스피커 회로 연결도",
    description: "Waveshare 2.0인치 ST7789 LCD(SPI), MAX98357A I2S 앰프, 버튼, LED를 ESP32-S3 SuperMini에 연결하는 3주차 통합 배선도입니다.",
    filename: "circuit_lcd_btn_led_speaker.png",
    language: "json",
    contentType: "circuit",
    imageUrl: "/images/circuit_lcd_btn_led_speaker.png",
    tags: ["배선도", "회로도", "ST7789", "LCD", "ESP32-S3", "3주차"],
    pinMap: "LCD(MOSI:11, CLK:12, CS:13, DC:7, RST:6, BL:5V), I2S(5/3/44), 버튼:4, LED:2",
    updatedAt: new Date().toISOString(),
    code: `// [3주차] 2.0" LCD + 버튼 + LED + 스피커 전체 핀 연결 요약
// =========================================================================
// 부품          | ESP32-S3 핀  | Waveshare 2.0" LCD / 앰프 / 부품 핀
// -------------+-------------+-------------------------------------------
// LCD VCC      | 3V3         | VCC (3.3V 전원)
// LCD GND      | GND         | GND (공통 접지)
// LCD DIN      | GPIO11      | MOSI (데이터 입력선)
// LCD CLK      | GPIO12      | SCLK (SPI 클럭선)
// LCD CS       | GPIO13      | CS (칩 셀렉트)
// LCD DC       | GPIO7       | DC (Data / Command 제어)
// LCD RST      | GPIO6       | RST (리셋선)
// LCD BL       | 5V / 3V3    | 백라이트 전원
// -------------+-------------+-------------------------------------------
// I2S BCLK     | GPIO5       | MAX98357A BCLK
// I2S LRC      | GPIO3       | MAX98357A LRC
// I2S DOUT     | GPIO44      | MAX98357A DIN (SuperMini RX 핀)
// I2S VIN/GND  | 5V / GND    | MAX98357A 전원 및 공통 GND
// -------------+-------------+-------------------------------------------
// BUTTON       | GPIO4       | 버튼 한쪽 ➔ GND (내부 풀업 INPUT_PULLUP)
// LED          | GPIO2       | 220Ω 저항 ➔ LED(+), LED(-) ➔ GND
// =========================================================================
// 동작 원리: 
// 1. ST7789 LCD 화면에 UI 그래픽 및 카운터가 표시됩니다.
// 2. 버튼을 누르면 카운터 증가 및 화면 색상 전환!
// 3. 동시에 LED 점등과 함께 I2S 스피커로 경쾌한 도-미-솔 사운드가 울립니다.`
  },
  {
    id: "content-week-3-lcd-hello",
    week: 3,
    title: "3-1. LCD 기본 출력 - Hello SODA!",
    description: "Waveshare 2.0인치 ST7789 LCD 디스플레이를 초기화하고 화면 중앙에 'Hello SODA!' 글씨를 출력하는 가장 기본적이고 심플한 3주차 첫 실습 코드입니다.",
    filename: "soda-3-1.ino",
    language: "arduino",
    tags: ["ST7789", "LCD", "Hello SODA!", "기본코드", "디스플레이", "ESP32"],
    pinMap: "LCD(MOSI:11, CLK:12, CS:13, DC:7, RST:6, BL:5V)",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-3-1.ino")
  },
  {
    id: "content-week-3-lcd-basic",
    week: 3,
    title: "3-2. LCD 기본코드 - 메인화면 표시 버튼클릭시 증가표시",
    description: "ST7789 2.0인치 LCD 화면에 메인 그래픽을 표시하고, 버튼을 누를 때마다 클릭 카운트 증가 화면 및 도-미-솔 사운드를 출력하는 3주차 실습입니다.",
    filename: "soda-3-2.ino",
    language: "arduino",
    tags: ["ST7789", "LCD", "SPI", "버튼", "카운터", "I2S"],
    pinMap: "LCD(MOSI:11, CLK:12, CS:13, DC:7, RST:6), 버튼:4, LED:2, I2S:5/3/44",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-3-2.ino")
  },
  {
    id: "content-week-3-lcd-shapes",
    week: 3,
    title: "3-3. LCD 다양한 도형 그리기",
    description: "ST7789 2.0인치 LCD 디스플레이에 선(Line), 사각형(Rect), 원(Circle), 채운 원(FillCircle) 등 다양한 2D 그래픽 도형을 2초 간격으로 순차 렌더링하는 3주차 실습입니다.",
    filename: "soda-3-3.ino",
    language: "arduino",
    tags: ["ST7789", "LCD", "도형", "GFX", "drawLine", "drawRect", "drawCircle", "ESP32"],
    pinMap: "LCD(MOSI:11, CLK:12, CS:13, DC:7, RST:6, BL:5V)",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-3-3.ino")
  },
  {
    id: "content-week-3-lcd-editor",
    week: 3,
    title: "3-4. 2.0\" LCD 화면편집기 (소다봇 표정 스튜디오)",
    description: "마우스로 소다봇 표정 및 픽셀 아트를 직접 그리고 2장 표정 전환 애니메이션을 아두이노 C++ 코드로 생성/다운로드하는 3주차 전용 그래픽 도구입니다.",
    filename: "soda-3-4.ino",
    language: "arduino",
    contentType: "editor",
    tags: ["LCD", "화면편집기", "표정에디터", "비트맵", "애니메이션", "도구"],
    pinMap: "LCD(MOSI:11, CLK:12, CS:13, DC:7, RST:6), 버튼:4, LED:2, I2S:5/3/44",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-3-4.ino")
  },
  // ====================================================
  // WEEK 04 — 공룡을 점프시켜라 (4개 실습)
  // ====================================================
  {
    id: "content-week-4-dino-basic",
    week: 4,
    title: "4-1. 공룡과 바닥 표시",
    description: "ST7789 2.0인치 LCD에 공룡 스프라이트 비트맵과 바닥 선을 선명하게 렌더링하는 4주차 첫 번째 실습입니다.",
    filename: "soda-4-1.ino",
    language: "arduino",
    tags: ["디노게임", "비트맵", "공룡", "LCD", "ST7789", "ESP32"],
    pinMap: "LCD(MOSI:11, CLK:12, CS:13, DC:7, RST:6, BL:5V)",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-4-1.ino")
  },
  {
    id: "content-week-4-button-jump-simple",
    week: 4,
    title: "4-2. 정해진 위치를 이용한 점프 애니메이션",
    description: "버튼(GPIO4)을 누르면 정해진 높이 단계 배열을 따라 공룡이 위로 올라갔다 내려오는 기초 점프 애니메이션을 구현합니다.",
    filename: "soda-4-2.ino",
    language: "arduino",
    tags: ["버튼점프", "GPIO4", "점프애니메이션", "인터랙션", "ESP32"],
    pinMap: "LCD(MOSI:11, CLK:12, CS:13, DC:7, RST:6), 버튼:4",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-4-2.ino")
  },
  {
    id: "content-week-4-dino-jump-physics",
    week: 4,
    title: "4-3. 점프 힘과 중력을 이용한 자연스러운 점프",
    description: "물리 엔진 개념(점프 속도 velocity와 중력 gravity)을 적용하여 진짜 게임처럼 부드럽고 찰진 공룡 점프를 완성합니다.",
    filename: "soda-4-3.ino",
    language: "arduino",
    tags: ["물리엔진", "중력", "속도", "자연스러운점프", "ESP32"],
    pinMap: "LCD(MOSI:11, CLK:12, CS:13, DC:7, RST:6), 버튼:4",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-4-3.ino")
  },
  {
    id: "content-week-4-dino-jump-final",
    week: 4,
    title: "4-4. 점프 효과음(I2S 스피커)과 완성 점프",
    description: "공룡 점프 시 MAX98357A I2S 앰프와 FreeRTOS 비동기 태스크를 통해 고품질 점프 신스 사운드를 재생하는 4주차 완성 실습입니다.",
    filename: "soda-4-4.ino",
    language: "arduino",
    tags: ["점프효과음", "I2S스피커", "MAX98357A", "FreeRTOS", "완성점프", "DINO_FINAL", "ESP32"],
    pinMap: "LCD(MOSI:11, CLK:12, CS:13, DC:7, RST:6), 버튼:4, I2S스피커(BCLK:5, LRC:3, DOUT:44), LED:2",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-4-4.ino")
  },
  // ====================================================
  // WEEK 05 — 진짜 게임을 완성하라 (4개 실습)
  // ====================================================
  {
    id: "content-week-5-cactus-move",
    week: 5,
    title: "5-1. X좌표로 선인장 이동",
    description: "오른쪽 끝에서 왼쪽으로 스스로 달려오는 장애물(선인장)의 X좌표 이동 및 I2S 점프 효과음을 구현합니다.",
    filename: "soda-5-1.ino",
    language: "arduino",
    tags: ["선인장", "장애물이동", "X좌표", "I2S스피커", "ESP32"],
    pinMap: "LCD(MOSI:11, CLK:12, CS:13, DC:7, RST:6), 버튼:4, I2S스피커(BCLK:5, LRC:3, DOUT:44), LED:2",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-5-1.ino")
  },
  {
    id: "content-week-5-collision-gameover",
    week: 5,
    title: "5-2. 충돌, 게임 종료, 다시 시작",
    description: "공룡과 선인장의 AABB 충돌 판정, GAME OVER 화면, 점프/충돌 I2S 사운드 및 버튼 재시작 흐름을 제작합니다.",
    filename: "soda-5-2.ino",
    language: "arduino",
    tags: ["충돌판정", "게임오버", "재시작", "AABB", "I2S스피커", "ESP32"],
    pinMap: "LCD(MOSI:11, CLK:12, CS:13, DC:7, RST:6), 버튼:4, I2S스피커(BCLK:5, LRC:3, DOUT:44), LED:2",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-5-2.ino")
  },
  {
    id: "content-week-5-score-level",
    week: 5,
    title: "5-3. 점수와 속도 증가",
    description: "실시간 점수(SCORE), 점수 획득/점프/충돌 사운드, 난이도에 따라 선인장 속도가 빨라지는 레벨업 시스템을 적용합니다.",
    filename: "soda-5-3.ino",
    language: "arduino",
    tags: ["점수시스템", "난이도조절", "레벨업", "I2S스피커", "ESP32"],
    pinMap: "LCD(MOSI:11, CLK:12, CS:13, DC:7, RST:6), 버튼:4, I2S스피커(BCLK:5, LRC:3, DOUT:44), LED:2",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-5-3.ino")
  },
  {
    id: "content-week-5-dino-game-final",
    week: 5,
    title: "5-4. 최고점 저장 & 완성형 디노 게임",
    description: "랜덤 선인장 간격, 공룡 발 애니메이션, I2S 멀티 사운드 엔진, Flash 최고 기록(BEST SCORE) 저장 기능이 모두 포함된 완성형 디노 게임입니다.",
    filename: "soda-5-4.ino",
    language: "arduino",
    tags: ["디노게임완성", "최고점수", "아케이드", "풀버전", "I2S스피커", "ESP32"],
    pinMap: "LCD(MOSI:11, CLK:12, CS:13, DC:7, RST:6), 버튼:4, I2S스피커(BCLK:5, LRC:3, DOUT:44), LED:2",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-5-4.ino")
  },
  {
    id: "content-week-6-settings",
    week: 6,
    title: "1. 소다봇 설정하기",
    description: "소다봇의 Wi-Fi, BLE 장치 이름, 기본 표정, 물리 버튼 동작을 설정하고 4개 파트(HEADERS, GLOBALS, SETUP, FUNCTION) 커스텀 아두이노 기능을 자동 병합하여 다운로드합니다.",
    filename: "soda-basic-template.ino",
    language: "arduino",
    contentType: "code",
    tags: ["6-7주차", "소다봇설정", "커스텀기능", "Wi-Fi", "BLE", "펌웨어"],
    pinMap: "LCD(11,12,13,7,6), 버튼:4, I2S스피커(5,3,44), I2S마이크(9,10,8)",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-basic-template.ino")
  },
  {
    id: "content-week-6-mic-circuit",
    week: 6,
    title: "2. [배선도] 마이크 추가 회로 연결도",
    description: "ESP32-S3 SuperMini 보드와 I2S 원형 마이크 모듈의 3.3V 전원 및 핀 연결 배선도(GPIO9/SCK, GPIO10/WS, GPIO8/SD) 가이드입니다.",
    filename: "circuit_mic_i2s.jpg",
    language: "json",
    contentType: "circuit",
    imageUrl: "/images/circuit_mic_i2s.jpg",
    tags: ["6-7주차", "배선도", "회로도", "마이크", "I2S", "ESP32-S3", "3.3V"],
    pinMap: "마이크 VDD: 3.3V, GND: 공통GND, SCK: GPIO9, WS: GPIO10, SD: GPIO8, L/R: GND",
    updatedAt: new Date().toISOString(),
    code: `// [6-7주차] ESP32 Super Mini ↔ I2S 마이크 연결 핀맵 요약
// =========================================================================
// 부품 핀 (Mic) | ESP32-S3 핀  | 기능                 | 배선 색상
// -------------+-------------+----------------------+---------------------
// VDD (3.3V)   | 3V3 (전원)  | 전원 (반드시 3.3V 레일)| 빨강 (Red)
// GND          | GND         | 접지 (공통 GND)      | 검정 (Black)
// SCK          | GPIO9       | SCK (I2S 비트 클럭)   | 초록 (Green)
// WS           | GPIO10      | WS (I2S 워드 클럭)    | 파랑 (Blue)
// SD           | GPIO8       | SD (I2S 오디오 데이터) | 주황 (Orange)
// L/R          | GND         | L/R 채널 선택 (기본)  | 보라 (Purple)
// =========================================================================
// ⚠️ 중요 주의사항:
// 1. VDD는 반드시 3.3V에 연결합니다. (5V에 연결하지 않습니다!)
// 2. 마이크 전원은 브레드보드 반대편 3.3V 전원 레일에서 가져옵니다.
// 3. 모든 부품의 GND는 공통(Common GND)으로 연결합니다.`
  }
];

interface DBStructure {
  users: User[];
  settings: {
    aiProvider?: string;
    openaiApiKey?: string;
    lmStudioUrl: string;
    modelName: string;
    fallbackMode: boolean; // default true for easy emulation
    temperature?: number;
    maxTokens?: number;
    language?: string;
    openaiTokensUsed?: number;
    hybridModeEnabled?: boolean;
    dailyGptQuota?: number;
  };
  chats: ChatRoom[];
  courseContents?: CourseContent[];
}

function initDB() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const defaultDB: DBStructure = {
      users: [
        { id: "user-1", username: "admin", displayName: "운영자", passwordHash: "admin123", role: "admin", canAccessChat: true },
        { id: "user-2", username: "muji", displayName: "무인양품", passwordHash: "muji123", role: "student", canAccessChat: false }
      ],
      settings: {
        lmStudioUrl: "https://granular-kindly-morally.ngrok-free.dev",
        modelName: "llama-3-korean-bllossom-8b",
        fallbackMode: true,
        hybridModeEnabled: false,
        dailyGptQuota: 3
      },
      chats: [
        {
          id: "chat-default",
          userId: "user-1",
          title: "소다봇 제작 & 코딩 세션 🤖",
          createdAt: new Date().toISOString(),
          messages: [
            {
              id: "msg-1",
              sender: "assistant",
              text: "안녕! 나는 디랩(D-Lab)의 인공지능 코딩 로봇 '소다봇'이야! 🤖 소다봇 하드웨어 제작, 회로 핀 연결, ESP32/아두이노 펌웨어 코딩 중 궁금한 점이 있으면 언제든 물어봐. 직접 코드를 작성하고 제어할 수 있도록 도와줄게!",
              timestamp: new Date().toISOString()
            }
          ]
        }
      ],
      courseContents: DEFAULT_COURSE_CONTENTS
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB, null, 2), "utf8");
  }
}

initDB();

function readDB(): DBStructure {
  initDB();
  const raw = fs.readFileSync(DB_FILE, "utf8");
  const db: DBStructure = JSON.parse(raw);
  let changed = false;
  if (!db.courseContents || !Array.isArray(db.courseContents)) {
    db.courseContents = DEFAULT_COURSE_CONTENTS;
    changed = true;
  } else {
    // Ensure all default week contents exist (e.g. newly added week 6-7 items)
    const existingIds = new Set(db.courseContents.map(c => c.id));
    for (const defaultItem of DEFAULT_COURSE_CONTENTS) {
      if (!existingIds.has(defaultItem.id)) {
        db.courseContents.push(defaultItem);
        changed = true;
      }
    }
  }
  if (db.users && Array.isArray(db.users)) {
    db.users.forEach(u => {
      if (!u.personalApiKey) {
        u.personalApiKey = "sk-soda-" + crypto.randomBytes(16).toString("hex");
        changed = true;
      }
    });
  }
  if (changed) {
    writeDB(db);
  }
  return db;
}

function writeDB(data: DBStructure) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

function checkHybridQuotaAndRoute(user: User, db: DBStructure) {
  const currentDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  
  if (user.lastGptDate !== currentDate) {
    user.lastGptDate = currentDate;
    user.gptUsageCount = 0;
  }

  let useGpt = false;
  if (db.settings.hybridModeEnabled) {
    const quota = db.settings.dailyGptQuota || 3;
    if ((user.gptUsageCount || 0) < quota) {
      useGpt = true;
      user.gptUsageCount = (user.gptUsageCount || 0) + 1;
    }
  } else {
    useGpt = db.settings.aiProvider === "openai";
  }

  if (useGpt) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      auth: `Bearer ${db.settings.openaiApiKey || ""}`,
      routedToGpt: true
    };
  } else {
    return {
      url: `${db.settings.lmStudioUrl}/v1/chat/completions`,
      auth: "Bearer lm-studio",
      routedToGpt: false
    };
  }
}

// ----------------------------------------------------
// SODA API Gateway (Hardware Proxy)
// ----------------------------------------------------
app.post('/v1/chat/completions', express.json(), async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "");
  const db = readDB();
  const user = db.users.find(u => u.personalApiKey === token);
  if (!user) return res.status(403).json({ error: "Invalid SODA API Key" });

  const routeConfig = checkHybridQuotaAndRoute(user, db);
  writeDB(db); // Save quota increments immediately

  try {
    const openaiRes = await fetch(routeConfig.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": routeConfig.auth
      },
      body: JSON.stringify({
        ...req.body,
        model: routeConfig.routedToGpt ? req.body.model : db.settings.modelName
      })
    });

    const data = await openaiRes.json();
    
    // Log to DB
    const promptMessage = req.body.messages?.[req.body.messages.length - 1]?.content || "No prompt";
    const replyMessage = data.choices?.[0]?.message?.content || "No reply";
    const modelUsed = data.model || (routeConfig.routedToGpt ? req.body.model : db.settings.modelName) || "Unknown Model";

    let chat = db.chats.find(c => c.userId === user.id && c.title === "아두이노 소다봇 대화");
    if (!chat) {
      chat = {
        id: "chat-hw-" + Date.now(),
        userId: user.id,
        title: "아두이노 소다봇 대화",
        createdAt: new Date().toISOString(),
        messages: []
      };
      db.chats.push(chat);
    }
    
    chat.messages.push({
      id: "msg-" + Date.now() + "1",
      sender: "user",
      text: promptMessage,
      timestamp: new Date().toISOString()
    });
    chat.messages.push({
      id: "msg-" + Date.now() + "2",
      sender: "assistant",
      text: replyMessage,
      timestamp: new Date().toISOString(),
      modelUsed: modelUsed
    });
    writeDB(db);

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const upload = multer({ storage: multer.memoryStorage() });

let transcriber: any = null;
async function getTranscriber() {
  if (!transcriber) {
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
      // you can configure options if needed
    });
  }
  return transcriber;
}

app.post('/api/hw/audio-chat', upload.single('file'), async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "");
  const db = readDB();
  const user = db.users.find(u => u.personalApiKey === token);
  if (!user) return res.status(403).json({ error: "Invalid SODA API Key" });

  if (!req.file) return res.status(400).json({ error: "No audio file provided" });

  try {
    // 1. STT (Audio to Text) using OpenAI Whisper API
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(req.file.buffer)], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('model', 'whisper-1');
    formData.append('language', 'ko');
    formData.append('prompt', '소다봇에게 말하는 내용입니다.');

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${db.settings.openaiApiKey || ""}`
      },
      body: formData as any
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error("Whisper API error:", errText);
      throw new Error(`Whisper API failed: ${whisperRes.status}`);
    }

    const output = await whisperRes.json();
    let transcript = output.text;
    if (Array.isArray(transcript)) transcript = transcript.join(" ");
    transcript = transcript.trim();

    if (!transcript || transcript.length === 0) {
      return res.json({ text: "", reply: "음성을 인식하지 못했어요." });
    }

    // 2. LLM (Text to Text)
    const routeConfig = checkHybridQuotaAndRoute(user, db);
    writeDB(db);

    const openaiRes = await fetch(routeConfig.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": routeConfig.auth
      },
      body: JSON.stringify({
        model: routeConfig.routedToGpt ? "gpt-4o-mini" : db.settings.modelName,
        messages: [
          { role: "system", content: "너는 초등학생이 만든 AI 반려봇 소다봇이야. 한국어로 아주 짧고 귀엽게 말해." },
          { role: "user", content: transcript }
        ],
        max_tokens: 80
      })
    });

    const data = await openaiRes.json();
    const replyMessage = data.choices?.[0]?.message?.content || "앗, 오류가 났어요.";

    // 3. Save to DB
    let chat = db.chats.find(c => c.userId === user.id && c.title === "아두이노 소다봇 대화");
    if (!chat) {
      chat = {
        id: "chat-hw-" + Date.now(),
        userId: user.id,
        title: "아두이노 소다봇 대화",
        createdAt: new Date().toISOString(),
        messages: []
      };
      db.chats.push(chat);
    }
    
    chat.messages.push({
      id: "msg-" + Date.now() + "1",
      sender: "user",
      text: transcript,
      timestamp: new Date().toISOString()
    });
    chat.messages.push({
      id: "msg-" + Date.now() + "2",
      sender: "assistant",
      text: replyMessage,
      timestamp: new Date().toISOString(),
      modelUsed: data.model || "Unknown Model"
    });
    writeDB(db);

    // 4. Return result
    res.json({ text: transcript, reply: replyMessage });
  } catch (err: any) {
    console.error("Audio-chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.use('/v1', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "");
  const db = readDB();
  
  const user = db.users.find(u => u.personalApiKey === token);
  if (!user) return res.status(403).json({ error: "Invalid SODA API Key" });

  req.headers.authorization = `Bearer ${db.settings.openaiApiKey || ""}`;
  next();
}, createProxyMiddleware({
  target: 'https://api.openai.com',
  changeOrigin: true
}));

app.use(express.json());

// ----------------------------------------------------
// Authentication API
// ----------------------------------------------------
interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "student" | "user";
  canAccessChat: boolean;
  personalApiKey?: string;
}

const sessions = new Map<string, SessionUser>();

function ensureUserApiKey(user: User, db: DBStructure): string {
  if (!user.personalApiKey) {
    user.personalApiKey = "sk-soda-" + crypto.randomBytes(16).toString("hex");
    writeDB(db);
  }
  return user.personalApiKey;
}

app.post("/api/auth/login", async (req, res) => {
  const { loginType, name, phone, username, password } = req.body;
  const db = readDB();

  // 1. ADMIN LOGIN MODE
  if (loginType === "admin" || (!name && username)) {
    const targetUsername = (username || name)?.trim();
    const targetPassword = (password || phone)?.trim();

    if (!targetUsername || !targetPassword) {
      return res.status(400).json({ error: "관리자 아이디와 비밀번호를 모두 입력해 주세요." });
    }

    // 마스터 관리자 프리패스
    if ((targetUsername === "admin" && (targetPassword === "password123" || targetPassword === "admin123")) ||
        (targetUsername === "aiden" && (targetPassword === "3531" || targetPassword === "1234"))) {
      let adminUser = db.users.find(u => u.username === targetUsername);
      if (!adminUser) {
        adminUser = {
          id: "admin-" + Date.now(),
          username: targetUsername,
          displayName: targetUsername === "aiden" ? "에이든 (관리자)" : "운영자",
          passwordHash: targetPassword,
          role: "admin",
          canAccessChat: true
        };
        db.users.push(adminUser);
      }
      const apiKey = ensureUserApiKey(adminUser, db);

      const sessionUser: SessionUser = {
        id: adminUser.id,
        username: adminUser.username,
        displayName: adminUser.displayName,
        role: "admin",
        canAccessChat: true,
        personalApiKey: apiKey
      };
      const sessionId = Math.random().toString(36).substring(2, 15);
      sessions.set(sessionId, sessionUser);
      return res.json({ success: true, sessionId, user: sessionUser });
    }

    // DB 내 사용자 인증
    const user = db.users.find(u => u.username === targetUsername);
    if (!user || user.passwordHash !== targetPassword) {
      return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
    }

    const apiKey = ensureUserApiKey(user, db);
    const isUserAdmin = user.username === "admin" || user.role === "admin";
    const sessionUser: SessionUser = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: isUserAdmin ? "admin" : (user.role || "student"),
      canAccessChat: isUserAdmin ? true : (user.canAccessChat ?? false),
      personalApiKey: apiKey
    };
    const sessionId = Math.random().toString(36).substring(2, 15);
    sessions.set(sessionId, sessionUser);
    return res.json({ success: true, sessionId, user: sessionUser });
  }

  // 2. STUDENT LOGIN MODE (Name + Phone 4 digits via soda-home MySQL)
  const studentName = (name || username)?.trim();
  const phoneLast4 = (phone || password)?.trim();

  if (!studentName || !phoneLast4) {
    return res.status(400).json({ error: "학생 이름과 전화번호 뒷 4자리를 모두 입력해 주세요." });
  }

  // 마스터 관리자 체크
  if (studentName === "aiden" && phoneLast4 === "3531") {
    let aidenUser = db.users.find(u => u.username === "aiden");
    if (!aidenUser) {
      aidenUser = {
        id: "admin-aiden",
        username: "aiden",
        displayName: "Aiden (Master Admin)",
        passwordHash: "3531",
        role: "admin",
        canAccessChat: true
      };
      db.users.push(aidenUser);
    }
    const apiKey = ensureUserApiKey(aidenUser, db);
    const sessionUser: SessionUser = {
      id: aidenUser.id,
      username: "aiden",
      displayName: "Aiden (Master Admin)",
      role: "admin",
      canAccessChat: true,
      personalApiKey: apiKey
    };
    const sessionId = Math.random().toString(36).substring(2, 15);
    sessions.set(sessionId, sessionUser);
    return res.json({ success: true, sessionId, user: sessionUser });
  }

  try {
    const pool = getMysqlPool();
    const [rows] = await pool.execute(
      `SELECT id, name, phone_parent, grade, status
       FROM api_studentmaster
       WHERE name = ? AND RIGHT(REPLACE(phone_parent, '-', ''), 4) = ?
       ORDER BY (status = "재원생") DESC, id DESC
       LIMIT 1`,
      [studentName, phoneLast4]
    );

    const students = rows as any[];

    if (students.length === 0) {
      const [nameCheck] = await pool.execute(
        'SELECT id FROM api_studentmaster WHERE name = ? LIMIT 1',
        [studentName]
      );
      if ((nameCheck as any[]).length === 0) {
        return res.status(401).json({ error: "등록된 학생 정보를 찾을 수 없습니다. 이름을 다시 확인해 주세요." });
      }
      return res.status(401).json({ error: "전화번호 뒷 4자리가 일치하지 않습니다." });
    }

    const student = students[0];
    const studentUsername = `student_${student.id}`;

    // Upsert to local db.json
    let localUser = db.users.find(u => u.username === studentUsername || u.id === `student-${student.id}`);
    if (!localUser) {
      localUser = {
        id: `student-${student.id}`,
        username: studentUsername,
        displayName: student.name,
        passwordHash: phoneLast4,
        role: "student",
        canAccessChat: false // 기본 승인 대기 상태
      };
      db.users.push(localUser);
    } else {
      localUser.displayName = student.name;
    }
    const apiKey = ensureUserApiKey(localUser, db);

    const sessionUser: SessionUser = {
      id: localUser.id,
      username: localUser.username,
      displayName: localUser.displayName,
      role: "student",
      canAccessChat: localUser.canAccessChat ?? false,
      personalApiKey: apiKey
    };

    const sessionId = Math.random().toString(36).substring(2, 15);
    sessions.set(sessionId, sessionUser);

    return res.json({ success: true, sessionId, user: sessionUser });

  } catch (err: any) {
    console.error("Student login MySQL query error:", err);
    // Fallback: Check local db.json if MySQL is temporarily offline
    const fallbackUser = db.users.find(
      u => (u.displayName === studentName || u.username === studentName) && u.passwordHash === phoneLast4
    );
    if (fallbackUser) {
      const apiKey = ensureUserApiKey(fallbackUser, db);
      const sessionUser: SessionUser = {
        id: fallbackUser.id,
        username: fallbackUser.username,
        displayName: fallbackUser.displayName,
        role: fallbackUser.role || "student",
        canAccessChat: fallbackUser.canAccessChat ?? false,
        personalApiKey: apiKey
      };
      const sessionId = Math.random().toString(36).substring(2, 15);
      sessions.set(sessionId, sessionUser);
      return res.json({ success: true, sessionId, user: sessionUser });
    }

    return res.status(500).json({ error: "학생 인증 데이터베이스에 접속할 수 없습니다. 관리자에게 문의하세요." });
  }
});

app.post("/api/auth/signup", (req, res) => {
  const { username, displayName, password } = req.body;
  if (!username || !displayName || !password) {
    return res.status(400).json({ error: "모든 항목을 입력해 주세요." });
  }

  const db = readDB();
  const exists = db.users.some(u => u.username === username);
  if (exists) {
    return res.status(400).json({ error: "이미 존재하는 아이디입니다." });
  }

  const newUser: User = {
    id: "user-" + Date.now(),
    username,
    displayName,
    passwordHash: password,
    role: "student",
    canAccessChat: false // 기본적으로 대화 권한 비활성화 (개발 탭만 오픈)
  };

  const apiKey = ensureUserApiKey(newUser, db);
  db.users.push(newUser);
  writeDB(db);

  const sessionId = Math.random().toString(36).substring(2, 15);
  const sessionUser: SessionUser = {
    id: newUser.id,
    username: newUser.username,
    displayName: newUser.displayName,
    role: "student",
    canAccessChat: false,
    personalApiKey: apiKey
  };
  sessions.set(sessionId, sessionUser);

  res.json({ success: true, sessionId, user: sessionUser });
});

app.post("/api/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    sessions.delete(token);
  }
  res.json({ success: true });
});

app.get("/api/auth/me", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "인증되지 않은 사용자입니다." });
  }
  const token = authHeader.replace("Bearer ", "");
  let session = sessions.get(token);
  const db = readDB();

  // 세션이 메모리에 없을 때 (서버 재시작 등) DB 또는 기본 유저 매칭 복구
  if (!session) {
    const matchedUser = db.users.find(u => u.id === token || u.username === token || u.personalApiKey === token) || db.users[0];
    if (matchedUser) {
      const isUserAdmin = matchedUser.username === "admin" || matchedUser.role === "admin";
      const apiKey = ensureUserApiKey(matchedUser, db);
      session = {
        id: matchedUser.id,
        username: matchedUser.username,
        displayName: matchedUser.displayName,
        role: isUserAdmin ? "admin" : (matchedUser.role || "student"),
        canAccessChat: isUserAdmin ? true : (matchedUser.canAccessChat ?? false),
        personalApiKey: apiKey
      };
      sessions.set(token, session);
    } else {
      return res.status(401).json({ error: "세션이 만료되었습니다." });
    }
  }

  // DB 최신 권한 상태와 실시간 동기화
  const dbUser = db.users.find(u => u.id === session!.id);
  if (dbUser) {
    const isUserAdmin = dbUser.username === "admin" || dbUser.role === "admin";
    const apiKey = ensureUserApiKey(dbUser, db);
    session.displayName = dbUser.displayName;
    session.role = isUserAdmin ? "admin" : (dbUser.role || "student");
    session.canAccessChat = isUserAdmin ? true : (dbUser.canAccessChat ?? false);
    session.personalApiKey = apiKey;
  }

  res.json({ user: session });
});

app.get("/api/auth/current-key", (req, res) => {
  const db = readDB();
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    const session = sessions.get(token);
    if (session) {
      const dbUser = db.users.find(u => u.id === session.id);
      if (dbUser) {
        return res.json({ apiKey: ensureUserApiKey(dbUser, db) });
      }
    }
    const userByToken = db.users.find(u => u.id === token || u.username === token);
    if (userByToken) {
      return res.json({ apiKey: ensureUserApiKey(userByToken, db) });
    }
  }
  // 기본 키 반환 (첫 번째 유저 또는 admin)
  const defaultUser = db.users.find(u => u.username === "admin") || db.users[0];
  const key = defaultUser ? ensureUserApiKey(defaultUser, db) : ("sk-soda-" + crypto.randomBytes(16).toString("hex"));
  res.json({ apiKey: key });
});

// ----------------------------------------------------
// Admin API
// ----------------------------------------------------
const requireAdmin = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증되지 않은 사용자입니다." });
  
  const token = authHeader.replace("Bearer ", "");
  const session = sessions.get(token);
  if (!session || (session.username !== "admin" && session.role !== "admin")) {
    return res.status(403).json({ error: "운영자 권한이 필요합니다." });
  }
  next();
};

app.get("/api/admin/users", requireAdmin, (req, res) => {
  const db = readDB();
  // Ensure each user has default canAccessChat
  const users = db.users.map(u => ({
    ...u,
    canAccessChat: u.username === "admin" || u.role === "admin" ? true : (u.canAccessChat ?? false),
    role: u.username === "admin" ? "admin" : (u.role || "student")
  }));
  res.json({ users });
});

app.post("/api/admin/users", requireAdmin, (req, res) => {
  const { username, displayName, password, canAccessChat } = req.body;
  const db = readDB();
  if (db.users.some(u => u.username === username)) return res.status(400).json({ error: "이미 존재하는 아이디입니다." });
  
  const newUser: User = {
    id: "user-" + Date.now(),
    username,
    displayName,
    passwordHash: password,
    role: "student",
    canAccessChat: Boolean(canAccessChat)
  };
  db.users.push(newUser);
  writeDB(db);
  res.json({ success: true, user: newUser });
});

// 개별 사용자 권한 설정
app.put("/api/admin/users/:id/permission", requireAdmin, (req, res) => {
  const { canAccessChat } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "유저를 찾을 수 없습니다." });

  if (user.username === "admin") {
    user.canAccessChat = true;
  } else {
    user.canAccessChat = Boolean(canAccessChat);
  }

  writeDB(db);

  // 활성 세션 업데이트
  for (const session of sessions.values()) {
    if (session.id === user.id) {
      session.canAccessChat = user.canAccessChat;
    }
  }

  res.json({ success: true, user });
});

// 전체 학생 권한 일괄 설정
app.post("/api/admin/users/batch-permission", requireAdmin, (req, res) => {
  const { canAccessChat } = req.body;
  const db = readDB();
  
  db.users.forEach(user => {
    if (user.username !== "admin" && user.id !== "user-1") {
      user.canAccessChat = Boolean(canAccessChat);
    }
  });

  writeDB(db);

  // 활성 세션 일괄 업데이트
  for (const session of sessions.values()) {
    if (session.username !== "admin" && session.id !== "user-1") {
      session.canAccessChat = Boolean(canAccessChat);
    }
  }

  res.json({ success: true, message: `모든 학생의 대화 권한이 ${canAccessChat ? "활성화" : "비활성화"}되었습니다.` });
});

app.put("/api/admin/users/:id", requireAdmin, (req, res) => {
  const { displayName, password, canAccessChat } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "유저를 찾을 수 없습니다." });
  
  if (displayName) user.displayName = displayName;
  if (password) user.passwordHash = password;
  if (canAccessChat !== undefined && user.username !== "admin") {
    user.canAccessChat = Boolean(canAccessChat);
  }
  writeDB(db);
  res.json({ success: true, user });
});

app.delete("/api/admin/users/:id", requireAdmin, (req, res) => {
  if (req.params.id === "user-1") return res.status(400).json({ error: "최고 관리자는 삭제할 수 없습니다." });
  const db = readDB();
  db.users = db.users.filter(u => u.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

app.post("/api/admin/users/:id/apikey", requireAdmin, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "유저를 찾을 수 없습니다." });
  
  const newApiKey = "sk-soda-" + crypto.randomBytes(16).toString("hex");
  user.personalApiKey = newApiKey;
  writeDB(db);
  res.json({ success: true, apiKey: newApiKey });
});

// ----------------------------------------------------
// Course Contents API (주차별 컨텐츠 관리)
// ----------------------------------------------------
app.get("/api/course-contents", (req, res) => {
  const db = readDB();
  const rawContents = db.courseContents && db.courseContents.length > 0 ? db.courseContents : DEFAULT_COURSE_CONTENTS;
  
  // firmware 폴더에 실제 파일이 있다면 실시간 파일 내용으로 동기화하여 제공
  const contents = rawContents.map(c => {
    if (c.filename && c.filename.endsWith('.ino')) {
      const liveCode = getFirmwareCode(c.filename, c.code);
      return { ...c, code: liveCode };
    }
    return c;
  }).sort((a, b) => a.week - b.week);

  res.json({ contents });
});

app.post("/api/admin/course-contents", requireAdmin, (req, res) => {
  const { week, title, description, filename, language, tags, pinMap, code } = req.body;
  if (!title || !code) {
    return res.status(400).json({ error: "제목과 코드는 필수 입력 항목입니다." });
  }

  const db = readDB();
  if (!db.courseContents) db.courseContents = DEFAULT_COURSE_CONTENTS;

  const targetFilename = (filename || `sodabot_week${week || 1}_code.ino`).trim();

  // firmware 폴더에도 파일 저장
  if (targetFilename.endsWith('.ino')) {
    try {
      fs.writeFileSync(path.join(FIRMWARE_DIR, targetFilename), code, 'utf8');
    } catch (e) {
      console.error('[Firmware Save Error]', e);
    }
  }

  const newContent: CourseContent = {
    id: "content-" + Date.now(),
    week: Number(week) || 1,
    title: title.trim(),
    description: (description || "").trim(),
    filename: targetFilename,
    language: language || "arduino",
    tags: Array.isArray(tags) ? tags : (typeof tags === "string" ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : []),
    pinMap: pinMap ? pinMap.trim() : undefined,
    code: code,
    updatedAt: new Date().toISOString()
  };

  db.courseContents.push(newContent);
  writeDB(db);
  res.json({ success: true, content: newContent });
});

app.put("/api/admin/course-contents/:id", requireAdmin, (req, res) => {
  const { week, title, description, filename, language, tags, pinMap, code } = req.body;
  const db = readDB();
  if (!db.courseContents) db.courseContents = DEFAULT_COURSE_CONTENTS;

  const content = db.courseContents.find(c => c.id === req.params.id);
  if (!content) {
    return res.status(404).json({ error: "해당 컨텐츠를 찾을 수 없습니다." });
  }

  if (week !== undefined) content.week = Number(week);
  if (title !== undefined) content.title = title.trim();
  if (description !== undefined) content.description = description.trim();
  if (filename !== undefined) content.filename = filename.trim();
  if (language !== undefined) content.language = language;
  if (tags !== undefined) {
    content.tags = Array.isArray(tags) ? tags : (typeof tags === "string" ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : []);
  }
  if (pinMap !== undefined) content.pinMap = pinMap.trim();
  if (code !== undefined) {
    content.code = code;
    // firmware 폴더에도 동기화
    if (content.filename && content.filename.endsWith('.ino')) {
      try {
        fs.writeFileSync(path.join(FIRMWARE_DIR, content.filename), code, 'utf8');
      } catch (e) {
        console.error('[Firmware Save Error]', e);
      }
    }
  }
  content.updatedAt = new Date().toISOString();

  writeDB(db);
  res.json({ success: true, content });
});

app.delete("/api/admin/course-contents/:id", requireAdmin, (req, res) => {
  const db = readDB();
  if (!db.courseContents) db.courseContents = DEFAULT_COURSE_CONTENTS;

  db.courseContents = db.courseContents.filter(c => c.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

app.post("/api/admin/course-contents/reset-default", requireAdmin, (req, res) => {
  const db = readDB();
  db.courseContents = DEFAULT_COURSE_CONTENTS;
  writeDB(db);
  res.json({ success: true, message: "기본 주차별 실습 컨텐츠로 복원되었습니다.", contents: DEFAULT_COURSE_CONTENTS });
});

app.get("/api/admin/users/:id/stats", requireAdmin, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "유저를 찾을 수 없습니다." });

  const userChats = db.chats.filter(c => c.userId === user.id);
  const totalMessages = userChats.reduce((acc, chat) => acc + chat.messages.length, 0);

  res.json({
    user: {
      username: user.username,
      displayName: user.displayName,
      lastGptDate: user.lastGptDate || null,
      gptUsageCount: user.gptUsageCount || 0
    },
    stats: {
      totalChats: userChats.length,
      totalMessages: totalMessages
    },
    settings: {
      hybridModeEnabled: db.settings.hybridModeEnabled,
      dailyGptQuota: db.settings.dailyGptQuota || 3
    }
  });
});

app.get("/api/admin/stats/all", requireAdmin, (req, res) => {
  const db = readDB();
  const allUsersStats = db.users.map(u => {
    const userChats = db.chats.filter(c => c.userId === u.id);
    const totalMessages = userChats.reduce((acc, chat) => acc + chat.messages.length, 0);
    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      totalChats: userChats.length,
      totalMessages: totalMessages,
      lastGptDate: u.lastGptDate || null,
      gptUsageCount: u.gptUsageCount || 0
    };
  });

  res.json({
    users: allUsersStats,
    settings: {
      hybridModeEnabled: db.settings.hybridModeEnabled,
      dailyGptQuota: db.settings.dailyGptQuota || 3
    }
  });
});

app.get("/api/admin/chats", requireAdmin, (req, res) => {
  const db = readDB();
  // We want to return chats enriched with user display names
  const chatsWithUsers = db.chats.map(chat => {
    const user = db.users.find(u => u.id === chat.userId);
    return {
      ...chat,
      username: user ? user.displayName : "알 수 없는 유저"
    };
  });
  // Sort by latest message timestamp, fallback to chat creation time
  chatsWithUsers.sort((a, b) => {
    const timeA = a.messages.length > 0 ? new Date(a.messages[a.messages.length - 1].timestamp).getTime() : new Date(a.createdAt).getTime();
    const timeB = b.messages.length > 0 ? new Date(b.messages[b.messages.length - 1].timestamp).getTime() : new Date(b.createdAt).getTime();
    return timeB - timeA;
  });
  res.json(chatsWithUsers);
});

// ----------------------------------------------------
// System Status API
// ----------------------------------------------------
app.get("/api/system/status", (req, res) => {
  const db = readDB();
  const memoryUsage = {
    total: os.totalmem(),
    free: os.freemem()
  };
  const openaiUsage = {
    used: db.settings.openaiTokensUsed || 3240, // Mock or real token usage
    limit: 10000 // Monthly limit mock
  };
  res.json({ memoryUsage, openaiUsage });
});

// ----------------------------------------------------
// LM Studio Settings API
// ----------------------------------------------------
app.get("/api/lmstudio/config", (req, res) => {
  const db = readDB();
  res.json(db.settings);
});

app.post("/api/lmstudio/config", (req, res) => {
  const { aiProvider, openaiApiKey, lmStudioUrl, modelName, fallbackMode, temperature, maxTokens, language, hybridModeEnabled, dailyGptQuota } = req.body;
  const db = readDB();

  if (aiProvider !== undefined) db.settings.aiProvider = aiProvider;
  if (openaiApiKey !== undefined) db.settings.openaiApiKey = openaiApiKey;
  if (lmStudioUrl !== undefined) db.settings.lmStudioUrl = lmStudioUrl;
  if (modelName !== undefined) db.settings.modelName = modelName;
  if (fallbackMode !== undefined) db.settings.fallbackMode = fallbackMode;
  if (temperature !== undefined) db.settings.temperature = temperature;
  if (maxTokens !== undefined) db.settings.maxTokens = maxTokens;
  if (language !== undefined) db.settings.language = language;
  if (hybridModeEnabled !== undefined) db.settings.hybridModeEnabled = hybridModeEnabled;
  if (dailyGptQuota !== undefined) db.settings.dailyGptQuota = dailyGptQuota;

  writeDB(db);
  res.json({ success: true, settings: db.settings });
});

app.post("/api/lmstudio/test", async (req, res) => {
  // Global state for LM Studio settings (mocked persistence)
  let globalLmStudioUrl = "https://granular-kindly-morally.ngrok-free.dev";
  let globalLmStudioConnected = false;
  
  const { lmStudioUrl } = req.body;
  const targetUrl = lmStudioUrl || globalLmStudioUrl;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 sec timeout

    const response = await fetch(`${targetUrl}/v1/models`, {
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return res.json({
        connected: true,
        message: "LM Studio 서버와 원활히 소통 중입니다!",
        models: data.data || []
      });
    } else {
      return res.json({
        connected: false,
        message: `LM Studio 응답 코드 에러: ${response.status}`
      });
    }
  } catch (err: any) {
    return res.json({
      connected: false,
      message: `연결 상태: 대기 모드 (LM Studio 원격 연결 불가능시 인공지능 에뮬레이터 모드가 정상 대체 지원됩니다)`
    });
  }
});

// Streaming proxy to LM Studio with virtual emulator fallback
app.post("/api/lmstudio/stream", async (req, res) => {
  req.socket.setNoDelay(true);
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });

  const token = authHeader.replace("Bearer ", "");
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const db = readDB();
  const user = db.users.find(u => u.id === session.id);
  
  let fetchUrl = `${db.settings.lmStudioUrl}/v1/chat/completions`;
  let authHeaderValue = "Bearer lm-studio";

  let routedToGpt = false;
  if (user) {
    const routeConfig = checkHybridQuotaAndRoute(user, db);
    fetchUrl = routeConfig.url;
    authHeaderValue = routeConfig.auth;
    routedToGpt = routeConfig.routedToGpt;
    writeDB(db);
  }

  const fallbackMode = db.settings.fallbackMode;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const streamFallback = async () => {
    const fallbackText = "안녕! 지금 엔진이 오프라인 상태라서 가상 에뮬레이터 모드로 동작 중이야. 🤖\n\nAI 엔진 설정을 올바르게 입력하면 진짜 인공지능과 대화할 수 있어! 어떤 코딩 힌트가 필요해? 🌱";
    const segments = fallbackText.split(/(\s+)/);
    for (const segment of segments) {
      if (segment) {
        const chunk = {
          choices: [
            {
              delta: { content: segment },
              finish_reason: null
            }
          ]
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 300s timeout

    const lmResponse = await fetch(fetchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeaderValue,
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify({
        ...req.body,
        model: routedToGpt ? "gpt-4o-mini" : req.body.model
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!lmResponse.ok) {
      throw new Error(`LM Studio returned status ${lmResponse.status}`);
    }

    if (!lmResponse.body) {
      throw new Error("ReadableStream not supported on backend response");
    }

    const reader = lmResponse.body.getReader();
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        res.write(value);
      }
    }
    res.end();
  } catch (err: any) {
    console.warn("LM Studio streaming failed:", err.message || err);
    if (fallbackMode) {
      await streamFallback();
    } else {
      const errChunk = {
        choices: [
          {
            delta: {
              content: `[LM Studio 연결 실패: ${err.message || err}]`
            }
          }
        ]
      };
      res.write(`data: ${JSON.stringify(errChunk)}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
});


// ----------------------------------------------------
// Chats & Message History API (ChatGPT Vibe)
// ----------------------------------------------------
app.get("/api/chats", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });

  const token = authHeader.replace("Bearer ", "");
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const db = readDB();
  const userChats = db.chats.filter(c => c.userId === session.id);
  res.json(userChats);
});

app.post("/api/chats", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });

  const token = authHeader.replace("Bearer ", "");
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { title } = req.body;
  const db = readDB();

  const newChat: ChatRoom = {
    id: "chat-" + Date.now(),
    userId: session.id,
    title: title || "새로운 대화 ✨",
    createdAt: new Date().toISOString(),
    messages: []
  };

  db.chats.push(newChat);
  writeDB(db);

  res.json(newChat);
});

app.delete("/api/chats/:id", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });

  const token = authHeader.replace("Bearer ", "");
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { id } = req.params;
  const db = readDB();

  const chatIdx = db.chats.findIndex(c => c.id === id && c.userId === session.id);
  if (chatIdx !== -1) {
    db.chats.splice(chatIdx, 1);
    writeDB(db);
    return res.json({ success: true });
  }

  res.status(404).json({ error: "대화방을 찾을 수 없습니다." });
});

// Sync Messages from Client (for client-side LM Studio fetching)
app.post("/api/chats/:id/sync", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });

  const token = authHeader.replace("Bearer ", "");
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { id } = req.params;
  const { messages, title } = req.body;

  const db = readDB();
  const chat = db.chats.find(c => c.id === id && c.userId === session.id);

  if (!chat) {
    return res.status(404).json({ error: "대화방을 찾을 수 없습니다." });
  }

  if (title) chat.title = title;
  if (messages && Array.isArray(messages)) {
    chat.messages.push(...messages);
  }

  writeDB(db);
  res.json({ success: true, chat });
});


// ==========================================
// Auto-Memory Extraction (Background Task)
// ==========================================
async function extractAndSaveMemory(userId, chatMessages, settings) {
  try {
    const textHistory = chatMessages.map(m => `${m.sender === 'user' ? '사용자' : 'AI'}: ${m.text}`).join('\n');
    const prompt = `다음은 사용자와 AI의 최근 대화 기록입니다. 
사용자에 대한 새롭고 중요한 사실(취향, 직업, 가족관계, 중요한 경험 등)을 발견하면 간결한 한 문장씩 요약해 주세요. 
새로 기억할 만한 내용이 없으면 반드시 '없음'이라고만 대답하세요.

대화 기록:
${textHistory}

요약:`;

    // Local LLM 
    const targetUrl = settings.lmStudioUrl || "https://granular-kindly-morally.ngrok-free.dev";
    const lmResponse = await fetch(`${targetUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer lm-studio" },
      body: JSON.stringify({
        model: settings.modelName || "llama-3-korean-bllossom-8b",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 150
      })
    });

    if (lmResponse.ok) {
      const resData = await lmResponse.json();
      let extraction = resData.choices?.[0]?.message?.content?.trim() || "없음";
      if (!extraction.includes("없음") && extraction.length > 3) {
        // Update DB
        const db = readDB();
        const u = db.users.find(u => u.id === userId);
        if (u) {
          const currentPersona = u.persona || "";
          // Only append if it's new
          u.persona = currentPersona ? `${currentPersona}\n- ${extraction}` : `- ${extraction}`;
          writeDB(db);
          console.log(`[Auto-Memory] Updated memory for ${userId}: ${extraction}`);
        }
      }
    }
  } catch (err) {
    console.warn("[Auto-Memory] Background extraction failed:", err.message);
  }
}

// Send Message & Get Stream-compatible response from LM Studio (or Fallback Emulator)
app.post("/api/chats/:id/messages", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });

  const token = authHeader.replace("Bearer ", "");
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { id } = req.params;
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "메시지 텍스트를 입력해 주세요." });
  }

  const db = readDB();
  const dbUser = db.users.find(u => u.id === session.id);
  const isAuthorized = session.username === "admin" || session.role === "admin" || (dbUser && (dbUser.canAccessChat ?? false));
  if (!isAuthorized) {
    return res.status(403).json({ error: "대화 기능 접근 권한이 없습니다. 운영자의 승인을 기다려주세요." });
  }

  const chat = db.chats.find(c => c.id === id && c.userId === session.id);

  if (!chat) {
    return res.status(404).json({ error: "대화방을 찾을 수 없습니다." });
  }

  // 1. Add User Message
  const userMsg: Message = {
    id: "msg-" + Date.now() + "-user",
    sender: "user",
    text,
    timestamp: new Date().toISOString()
  };
  chat.messages.push(userMsg);

  // Auto rename chat title if it's the first message and placeholder
  if (chat.messages.filter(m => m.sender === "user").length === 1 && (chat.title === "새로운 대화 ✨" || chat.title.startsWith("새로운 대화"))) {
    chat.title = text.substring(0, 16) + (text.length > 16 ? "..." : "");
  }

  const settings = db.settings;

  // 5. Trigger Auto-Memory Extraction every 2 messages (1 turn) for easier testing
  if (chat.messages.length % 2 === 0) {
    // Run asynchronously so it doesn't block the API response
    // We send the last 10 messages for context extraction
    const recentMessages = chat.messages.slice(-10);
    extractAndSaveMemory(session.id, recentMessages, settings).catch(console.error);
  }

  let assistantOutput = "";

  // Compile full prompt context from previous messages
  // 성능 및 속도 최적화를 위해 과거 컨텍스트를 최근 2개(1턴)로 슬라이싱합니다.
  const windowedMessages = chat.messages.slice(-2);
  const conversationHistory = windowedMessages.map(m => ({
    role: m.sender === "user" ? "user" : "assistant",
    content: m.text
  }));

  // 관리자가 유저에게 부여한 맞춤형 페르소나가 있다면 로드합니다.
  const userRecord = db.users.find(u => u.id === session.id);
  let sodabotPersona = "코딩 학원 '디랩(D-Lab)'의 인공지능 코딩 반려봇 '소다봇'이야. 초등학생 눈높이의 친근한 한국어 반말 구어체(~했어?, ~야!)와 이모지를 적극 사용해. 에러에는 깊이 공감해주고, 코딩 질문에는 정답 대신 단계별 힌트만 줘.";
  
  if (userRecord && userRecord.persona) {
    sodabotPersona = `${sodabotPersona}\n\n[특별 지시사항: 사용자에 맞게 다음 페르소나를 반드시 적용할 것]\n${userRecord.persona}`;
  }

  const actualModel = settings.modelName || "llama-3-korean-bllossom-8b";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 300s timeout for local LLM

    const targetUrl = settings.lmStudioUrl || "https://granular-kindly-morally.ngrok-free.dev";
    
    const lmResponse = await fetch(`${targetUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer lm-studio" // Dummy key to bypass API key checks
      },
      body: JSON.stringify({
        model: actualModel,
        messages: [
          { role: "system", content: sodabotPersona },
          ...conversationHistory
        ],
        temperature: 0.7,
        max_tokens: 1024
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (lmResponse.ok) {
      const resData = await lmResponse.json();
      assistantOutput = resData.choices?.[0]?.message?.content || "";
    } else {
      console.warn("LM Studio returned an error:", lmResponse.status, lmResponse.statusText);
      assistantOutput = "로컬 엔진이 잠시 쉬고 있어! 잠시 후 다시 시도해줘.";
    }
  } catch (err: any) {
    console.warn("LM Studio connection failed or timed out:", err.message || err);
    assistantOutput = "로컬 엔진이 잠시 쉬고 있어! 잠시 후 다시 시도해줘.";
  }

  // 4. Save Assistant Message
  const assistantMsg: any = {
    id: "msg-" + Date.now() + "-assistant",
    sender: "assistant",
    text: assistantOutput,
    timestamp: new Date().toISOString(),
    modelUsed: actualModel
  };
  chat.messages.push(assistantMsg);
  writeDB(db);

  res.json({
    success: true,
    userMessage: userMsg,
    assistantMessage: assistantMsg,
    usedEmulator: false,
    chatTitle: chat.title
  });
});

// ----------------------------------------------------
// Front-End Integration via Vite & Static Hosting
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
