import { compileAiSkillPrompt, normalizeSkillSlots } from './src/utils/aiSkillUtils';
import { reserveGptRoute, withProviderFallback } from './src/utils/aiRouting';
import { createRequestCapacity } from './src/utils/requestCapacity';
import { fetchHardwareSpeech } from './src/utils/hardwareTts';
import { quizTurn, parseQuizQuestion, hasUntrackedQuiz, type QuizState } from './src/utils/quiz';
import { normalizeFriendSettings, validateFriendSettings, friendToneInstruction, resolveFriendUser } from './src/utils/friendSettings';
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
const aiCapacity = createRequestCapacity(8, req => {
  const token = String(req.headers.authorization || "").replace(/^Bearer /, "").trim();
  if (!token) return "";
  const session = getSession(token);
  return session?.id || findUserByApiKey(token, readDB())?.id || token;
});
const PORT = parseInt(process.env.PORT || "7989", 10);

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
  source?: "web" | "sodabot";
  deviceId?: string | null;
}

interface ChatRoom {
  quizState?: QuizState;
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
  friendSettings?: {
    persona?: any;
    profile?: any;
    memories?: any[];
  };
  aiSkillState?: {
    appliedSkill?: any;
    activeSkillId?: string;
    skills?: any[];
    testLogs?: any[];
    versionSnapshots?: any[];
    report?: any;
  };
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
  contentType?: "code" | "circuit" | "doc" | "editor" | "interactive";
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
    id: "content-week-2-breadboard-secret",
    week: 2,
    title: "2-1. 브레드보드의 비밀 (인터랙티브 탐구)",
    description: "브레드보드 내부 금속 핀의 연결 구조와 전원 레일(VCC/GND)의 원리를 3D 모션그래픽으로 탐구하고, 직접 2가지 회로 연결 미션을 해결해보는 인터랙티브 시뮬레이션입니다.",
    filename: "breadboard_secret.html",
    language: "json",
    contentType: "interactive",
    imageUrl: "/simulations/breadboard_secret.html",
    tags: ["브레드보드", "시뮬레이션", "인터랙티브", "회로탐구", "전원레일", "GND"],
    pinMap: "세로 5핀 내부 연결(A-E, F-J), 가로 전원 레일(+ VCC, - GND)",
    updatedAt: new Date().toISOString(),
    code: `<!-- [2주차 1차시] 브레드보드의 비밀 인터랙티브 시뮬레이션 -->
<!-- 브레드보드 내부 연결 구조 & 2가지 미션 실습 모듈 -->
<!-- 파일 경로: /simulations/breadboard_secret.html -->

[핵심 학습 포인트]
1. 세로 5개 구멍 (A~E, F~J)은 안쪽 금속 클립으로 하나로 연결되어 있습니다.
2. 가운데 홈(분리대)을 기준으로 위/아래는 서로 단절되어 있습니다.
3. 양쪽 끝의 긴 가로 레일(+, -)은 전원(VCC)과 접지(GND)를 여러 부품에 동시에 공급합니다.
4. 부품의 다리를 같은 번호 라인에 꽂으면 별도의 전선 납땜 없이 바로 회로가 연결됩니다.`
  },
  {
    id: "content-week-2-circuit-lab",
    week: 2,
    title: "2-2. LED를 다시 켜라!",
    description: "직접 부품을 배치하고 배선과 Arduino 코드를 완성하는 가상 회로 실습입니다.",
    filename: "index.html",
    language: "json",
    contentType: "interactive",
    imageUrl: "/simulations/circuit-lab/index.html",
    tags: ["LED", "회로 시뮬레이션", "ESP32-S3", "Arduino"],
    code: "MISSION 01 — LED를 다시 켜라!\n부품 배치 → GPIO2 / GND 배선 → 코드 작성 → 실행 → 깜빡임 도전",
  },
  {
    id: "content-week-2-sound-lab",
    week: 2,
    title: "2-3. 버튼 · LED · 스피커",
    description: "버튼, LED, 저항, MAX98357A 앰프와 스피커를 직접 배치하고 배선하는 실습입니다.",
    filename: "button-led.ino",
    language: "arduino",
    contentType: "interactive",
    imageUrl: "/simulations/sound-lab/index.html",
    tags: ["버튼", "LED", "MAX98357A", "스피커", "I2S"],
    pinMap: "버튼 GPIO4 · LED GPIO2 · BCLK GPIO5 · LRC GPIO3 · DIN GPIO44 · VDD 5V · GND",
    code: "void setup() {\n  pinMode(2, OUTPUT);\n  pinMode(4, INPUT_PULLUP);\n}\n\nvoid loop() {\n  if (digitalRead(4) == LOW) {\n    digitalWrite(2, HIGH);\n  }\n  else {\n    digitalWrite(2, LOW);\n  }\n}",
  },
  {
    id: "content-week-2-circuit-diagram",
    week: 3,
    title: "[배선도] 버튼 + LED + 스피커 회로 연결도",
    description: "ESP32-S3 SuperMini 보드와 MAX98357A I2S 앰프, 버튼(GPIO4), LED(GPIO2)의 핀 연결 배선도 및 하드웨어 회로 가이드입니다.",
    filename: "circuit_btn_led_speaker.png",
    language: "json",
    contentType: "circuit",
    imageUrl: "/images/circuit_btn_led_speaker.png",
    tags: ["배선도", "회로도", "ESP32-S3", "MAX98357A", "하드웨어", "2주차"],
    pinMap: "버튼: GPIO4, LED: GPIO2, BCLK: GPIO5, LRC: GPIO3, DOUT: GPIO44, 전원: 5V, GND(공통)",
    updatedAt: new Date().toISOString(),
    code: `// [2주차] 버튼 + LED + 스피커 하드웨어 연결 요약
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
    id: "content-week-2-amplifier-lab", week: 3,
    title: "3-1. 앰프 · 스피커 추가하기",
    description: "LED와 버튼이 연결된 회로에 MAX98357A 앰프와 스피커를 추가하는 회로 실습입니다.",
    filename: "soda-1-1.ino", language: "arduino", contentType: "interactive",
    imageUrl: "/simulations/amplifier-lab/index.html",
    tags: ["I2S", "앰프", "스피커", "시뮬레이션"],
    code: getFirmwareCode("soda-1-1.ino"),
  },
  {
    id: "content-week-2-sound",
    week: 3,
    title: "3-2. 스피커테스트 도레미파솔라시도",
    description: "I2S 디지털 앰프/스피커 핀(BCLK:5, LRC:3, DOUT:44)을 초기화하고 도레미파솔라시도 음계를 재생하는 소다봇 사운드 기초 실습입니다.",
    filename: "soda-1-1.ino",
    language: "arduino",
    tags: ["I2S", "스피커", "사운드", "ESP32", "도레미파솔라시도"],
    pinMap: "BCLK: D5, LRC: D3, DOUT: D44",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-1-1.ino")
  },
  {
    id: "content-week-2-btn-led-sound",
    week: 3,
    title: "3-3. 버튼 + LED + 스피커",
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
    id: "content-week-3-lcd-lab", week: 3,
    title: "3-4. LCD 연결하기",
    description: "기존 회로에 ST7789 LCD를 추가하고 문구와 색상을 출력하는 가상 실습입니다.",
    filename: "soda-3-1.ino", language: "arduino", contentType: "interactive",
    imageUrl: "/simulations/lcd-lab/index.html", tags: ["LCD", "ST7789", "시뮬레이션"],
    code: getFirmwareCode("soda-3-1.ino"),
  },
  {
    id: "content-week-3-lcd-hello",
    week: 3,
    title: "3-5. LCD 기본 출력 - Hello SODA!",
    description: "Waveshare 2.0인치 ST7789 LCD 디스플레이를 초기화하고 화면 중앙에 'Hello SODA!' 글씨를 출력하는 가장 기본적이고 심플한 3주차 첫 실습 코드입니다.",
    filename: "soda-3-1.ino",
    language: "arduino",
    tags: ["ST7789", "LCD", "Hello SODA!", "기본코드", "디스플레이", "ESP32"],
    pinMap: "LCD(MOSI:11, CLK:12, CS:13, DC:7, RST:6, BL:5V)",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-3-1.ino")
  },
  {
    id: "content-week-4-lcd-code-lab", week: 4,
    title: "4-1. LCD 코드 실습",
    description: "완성된 LCD 회로에서 soda-3-2.ino 코드와 버튼 카운트 코드를 실행하는 실습입니다.",
    filename: "soda-3-2.ino", language: "arduino", contentType: "interactive",
    imageUrl: "/simulations/lcd-code-lab/index.html", tags: ["LCD", "코드 실습", "시뮬레이션"],
    code: getFirmwareCode("soda-3-2.ino"),
  },
  {
    id: "content-week-3-lcd-basic",
    week: 4,
    title: "4-2. LCD 기본코드 - 메인화면 표시 버튼클릭시 증가표시",
    description: "ST7789 2.0인치 LCD 화면에 메인 그래픽을 표시하고, 버튼을 누를 때마다 클릭 카운트 증가 화면 및 도-미-솔 사운드를 출력하는 3주차 실습입니다.",
    filename: "soda-3-2.ino",
    language: "arduino",
    tags: ["ST7789", "LCD", "SPI", "버튼", "카운터", "I2S"],
    pinMap: "LCD(MOSI:11, CLK:12, CS:13, DC:7, RST:6), 버튼:4, LED:2, I2S:5/3/44",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-3-2.ino")
  },
  {
    id: "content-week-4-lcd-shapes-lab", week: 4, title: "4-3. LCD 도형 실습",
    description: "완성된 LCD 회로에서 선·사각형·원·채운 도형을 직접 코딩하고 실행하는 실습입니다.",
    filename: "soda-3-3.ino", language: "arduino", contentType: "interactive",
    imageUrl: "/simulations/lcd-shapes-lab/index.html", tags: ["LCD", "도형", "코드 실습"], code: getFirmwareCode("soda-3-3.ino"),
  },
  {
    id: "content-week-3-lcd-shapes",
    week: 4,
    title: "4-4. LCD 다양한 도형 그리기",
    description: "ST7789 2.0인치 LCD 디스플레이에 선(Line), 사각형(Rect), 원(Circle), 채운 원(FillCircle) 등 다양한 2D 그래픽 도형을 2초 간격으로 순차 렌더링하는 3주차 실습입니다.",
    filename: "soda-3-3.ino",
    language: "arduino",
    tags: ["ST7789", "LCD", "도형", "GFX", "drawLine", "drawRect", "drawCircle", "ESP32"],
    pinMap: "LCD(MOSI:11, CLK:12, CS:13, DC:7, RST:6, BL:5V)",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-3-3.ino")
  },
  {
    id: "content-week-4-lcd-frame-lab", week: 4, title: "4-5. 나만의 액자 만들기",
    description: "색상·장식·제목을 직접 수정해 나만의 LCD 액자를 만드는 미션 실습입니다.",
    filename: "soda-frame.ino", language: "arduino", contentType: "interactive",
    imageUrl: "/simulations/lcd-frame-lab/index.html", tags: ["LCD", "액자", "미션"], code: getFirmwareCode("soda-frame.ino"),
  },
  {
    id: "content-week-3-lcd-editor",
    week: 4,
    title: "4-6. 2.0\" LCD 화면편집기 (소다봇 표정 스튜디오)",
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
    id: "content-week-4-lcd-expression-lab", week: 4, title: "4-7. 버튼으로 표정 바꾸기",
    description: "버튼을 누르면 LCD 표정·효과음·LED가 함께 반응하는 통합 미션입니다.",
    filename: "soda-expression.ino", language: "arduino", contentType: "interactive",
    imageUrl: "/simulations/lcd-expression-lab/index.html", tags: ["LCD", "표정", "버튼", "LED", "효과음"], code: getFirmwareCode("soda-expression.ino"),
  },
  {
    id: "content-week-4-dino-basic",
    week: 5,
    title: "5-1. 공룡과 바닥 표시",
    description: "ST7789 2.0인치 LCD에 공룡 스프라이트 비트맵과 바닥 선을 선명하게 렌더링하는 5주차 첫 번째 실습입니다.",
    filename: "soda-4-1.ino",
    language: "arduino",
    tags: ["디노게임", "비트맵", "공룡", "LCD", "ST7789", "ESP32"],
    pinMap: "LCD(MOSI:11, CLK:12, CS:13, DC:7, RST:6, BL:5V)",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-4-1.ino")
  },
  {
    id: "content-week-4-button-jump-simple",
    week: 5,
    title: "5-2. 정해진 위치를 이용한 점프 애니메이션",
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
    week: 5,
    title: "5-3. 점프 힘과 중력을 이용한 자연스러운 점프",
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
    week: 5,
    title: "5-4. 점프 효과음(I2S 스피커)과 완성 점프",
    description: "공룡 점프 시 MAX98357A I2S 앰프와 FreeRTOS 비동기 태스크를 통해 고품질 점프 신스 사운드를 재생하는 5주차 완성 실습입니다.",
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
    week: 6,
    title: "6-1. X좌표로 선인장 이동",
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
    week: 6,
    title: "6-2. 충돌, 게임 종료, 다시 시작",
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
    week: 6,
    title: "6-3. 점수와 속도 증가",
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
    week: 6,
    title: "6-4. 최고점 저장 & 완성형 디노 게임",
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
    week: 7,
    title: "1. 소다봇 설정하기",
    description: "소다봇의 Wi-Fi, BLE 장치 이름, 기본 표정, 물리 버튼 동작을 설정하고 4개 파트(HEADERS, GLOBALS, SETUP, FUNCTION) 커스텀 아두이노 기능을 자동 병합하여 다운로드합니다.",
    filename: "soda-basic-template.ino",
    language: "arduino",
    contentType: "code",
    tags: ["7-8주차", "소다봇설정", "커스텀기능", "Wi-Fi", "BLE", "펌웨어"],
    pinMap: "LCD(11,12,13,7,6), 버튼:4, I2S스피커(5,3,44), I2S마이크(9,10,8)",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-basic-template.ino")
  },
  {
    id: "content-week-6-mic-circuit",
    week: 7,
    title: "2. [배선도] 마이크 추가 회로 연결도",
    description: "ESP32-S3 SuperMini 보드와 I2S 원형 마이크 모듈의 3.3V 전원 및 핀 연결 배선도(GPIO9/SCK, GPIO10/WS, GPIO8/SD) 가이드입니다.",
    filename: "circuit_mic_i2s.jpg",
    language: "json",
    contentType: "circuit",
    imageUrl: "/images/circuit_mic_i2s.jpg",
    tags: ["7-8주차", "배선도", "회로도", "마이크", "I2S", "ESP32-S3", "3.3V"],
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
  },
  {
    id: "content-week-6-firmware-v4",
    week: 7,
    title: "3. 소다봇 기본 펌웨어 (마이크 통합 v4)",
    description: "ESP32-S3 기반 소다봇 표준 펌웨어 v4입니다. BLE, Wi-Fi, WebSocket, 2.0인치 ST7789 LCD, MAX98357A I2S 스피커, INMP441 I2S 마이크, 물리 버튼 및 NVS 설정 저장이 모두 통합되어 있습니다.",
    filename: "soda-6-3.ino",
    language: "arduino",
    contentType: "code",
    tags: ["7-8주차", "기본펌웨어", "마이크통합v4", "ESP32-S3", "ST7789", "MAX98357A", "INMP441", "BLE", "WebSocket"],
    pinMap: "LCD(MOSI:11, CLK:12, CS:13, DC:7, RST:6), 버튼:4, I2S스피커(5,3,44), I2S마이크(9,10,8)",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-6-3.ino")
  },
  {
    id: "content-week-8-firmware",
    week: 9,
    title: "1. 소다봇 기본 펌웨어",
    description: "9주차 소다봇 빌더 실습을 위한 표준 아두이노 펌웨어입니다. BLE, Wi-Fi, WebSocket, 2.0인치 ST7789 LCD, MAX98357A I2S 스피커, INMP441 I2S 마이크, Push-to-Talk 실시간 음성인식, 인터넷 실시간 시계(NTP) 및 커스텀 기능이 모두 통합되어 있습니다.",
    filename: "soda-8-1.ino",
    language: "arduino",
    contentType: "code",
    tags: ["9주차", "기본펌웨어", "소다봇빌더", "음성대화", "NTP시계", "ESP32-S3", "soda-8-1"],
    pinMap: "LCD(MOSI:11, CLK:12, CS:13, DC:7, RST:6), 버튼:4, I2S스피커(5,3,44), I2S마이크(9,10,8)",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-8-1.ino")
  },
  {
    id: "content-week-9-firmware",
    week: 10,
    title: "1. 소다봇 PCB 기본 펌웨어",
    description: "10주차 소다봇 전용 PCB(v1.1) 실습을 위한 표준 아두이노 펌웨어입니다. SODA-AIBOT v1.1 PCB 배선 및 TX(GPIO43) 버튼 입력, I2S 스피커/마이크, ST7789 LCD 및 실시간 음성 대화 기능이 연결되어 있습니다.",
    filename: "soda-9-1.ino",
    language: "arduino",
    contentType: "code",
    tags: ["10주차", "PCB기본펌웨어", "소다봇PCB", "음성대화", "soda-9-1", "ESP32-S3"],
    pinMap: "PCB v1.1: LCD(MOSI:11, CLK:12, CS:13, DC:7, RST:6), 버튼:GPIO43(TX), I2S스피커(5,3,44), I2S마이크(9,10,8)",
    updatedAt: new Date().toISOString(),
    code: getFirmwareCode("soda-9-1.ino")
  }
];

export interface SodabotPublicProfile {
  userId: string;
  botName: string;
  nickname: string;
  description: string;
  avatarUrl?: string;
  isPublic: boolean;
  isOnline?: boolean;
  lastSeenAt?: string;
}

export interface Friendship {
  id: string;
  requesterId: string;
  receiverId: string;
  status: "pending" | "accepted" | "rejected" | "blocked";
  createdAt: string;
  acceptedAt?: string;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  status: "sent" | "delivered" | "read";
  playedOnSodabot?: boolean;
}

export interface GroupChatRoom {
  id: string;
  name: string;
  creatorId: string;
  memberIds: string[];
  createdAt: string;
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    createdAt: string;
  };
}

export interface GroupChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  createdAt: string;
  readBy: string[];
  playedOnSodabot?: boolean;
}

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
  circuitProgress?: Record<string, { updatedAt: string; data: any }>;
  curriculumWeekShiftVersion?: number;
  courseContents?: CourseContent[];
  friendProfiles?: SodabotPublicProfile[];
  friendships?: Friendship[];
  directMessages?: DirectMessage[];
  groupChatRooms?: GroupChatRoom[];
  groupChatMessages?: GroupChatMessage[];
  userPresences?: Record<string, string>; // userId -> ISO timestamp (lastSeenAt)
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
        dailyGptQuota: 30
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
      curriculumWeekShiftVersion: 1,
      courseContents: DEFAULT_COURSE_CONTENTS,
      friendProfiles: [],
      friendships: [],
      directMessages: [],
      userPresences: {}
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB, null, 2), "utf8");
  }
}

initDB();

let sharedDB: DBStructure | undefined;
function readDB(): DBStructure {
  if (sharedDB) return sharedDB;
  initDB();
  const raw = fs.readFileSync(DB_FILE, "utf8");
  const db: DBStructure = JSON.parse(raw);
  sharedDB = db;
  let changed = false;
  if (!db.curriculumWeekShiftVersion) {
    for (const item of db.courseContents || []) {
    if (item.id === "content-week-4-lcd-code-lab" && item.filename === "soda-3-1.ino") {
      item.filename = "soda-3-2.ino";
      item.code = getFirmwareCode("soda-3-2.ino");
      changed = true;
    }
      if (Number(item.week) >= 4) {
        const oldWeek = Number(item.week);
        item.week = oldWeek + 1;
        item.title = item.title.replace(new RegExp("^" + oldWeek + "-(\\d+\\.)"), String(item.week) + "-$1");
      }
    }
    db.curriculumWeekShiftVersion = 1;
    changed = true;
  }

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
  for (const item of db.courseContents || []) {
    const movedToWeek3 = ["content-week-2-circuit-diagram", "content-week-2-amplifier-lab", "content-week-2-sound", "content-week-2-btn-led-sound"];
    const week3Numbers: Record<string, string> = {
      "content-week-2-amplifier-lab": "3-1.", "content-week-2-sound": "3-2.", "content-week-2-btn-led-sound": "3-3.",
      "content-week-3-lcd-hello": "3-5.", "content-week-3-lcd-basic": "4-2.", "content-week-3-lcd-shapes": "4-4.", "content-week-3-lcd-editor": "4-6."
    };
    if (movedToWeek3.includes(item.id) && item.week !== 3) { item.week = 3; changed = true; }
    if (["content-week-3-lcd-basic", "content-week-3-lcd-shapes", "content-week-3-lcd-editor"].includes(item.id) && item.week !== 4) { item.week = 4; changed = true; }
    const prefix = week3Numbers[item.id];
    if (prefix) {
      const title = item.title.replace(/^[234]-\d+\./, prefix);
      if (title !== item.title) { item.title = title; changed = true; }
    }

    if (item.id === "content-week-2-sound-lab" && item.filename === "soda-1-1.ino") {
      const updated = DEFAULT_COURSE_CONTENTS.find(c => c.id === item.id)!;
      item.filename = updated.filename; item.code = updated.code; changed = true;
    }
    if (["content-week-2-circuit-lab", "content-week-2-sound-lab"].includes(item.id) && item.title.includes("SODA CIRCUIT LAB — ")) {
      item.title = item.title.replace("SODA CIRCUIT LAB — ", "");
      changed = true;
    }
  }
  if (!db.friendProfiles || !Array.isArray(db.friendProfiles)) {
    db.friendProfiles = [];
    changed = true;
  }
  if (!db.friendships || !Array.isArray(db.friendships)) {
    db.friendships = [];
    changed = true;
  }
  if (!db.directMessages || !Array.isArray(db.directMessages)) {
    db.directMessages = [];
    changed = true;
  }
  if (!db.userPresences || typeof db.userPresences !== "object") {
    db.userPresences = {};
    changed = true;
  }
  if (db.users && Array.isArray(db.users)) {
    db.users.forEach(u => {
      if (u.aiSkillState) {
        const slots = normalizeSkillSlots(u.aiSkillState.skills || []);
        if (JSON.stringify(slots) !== JSON.stringify(u.aiSkillState.skills)) { u.aiSkillState.skills = slots; changed = true; }
        if (!slots.some(s => s.id === u.aiSkillState!.activeSkillId)) { u.aiSkillState.activeSkillId = 'skill-english-buddy'; changed = true; }
      }

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
  const temp = DB_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(temp, DB_FILE);
  sharedDB = data;
}

function checkHybridQuotaAndRoute(user: User, db: DBStructure) {
  const useGpt = reserveGptRoute(user, db.settings);

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

function providerConfig(gpt: boolean, db: DBStructure) {
  return {url:gpt ? "https://api.openai.com/v1/chat/completions" : `${db.settings.lmStudioUrl}/v1/chat/completions`,
    auth:gpt ? `Bearer ${db.settings.openaiApiKey || ""}` : "Bearer lm-studio",
    model:gpt ? "gpt-4o-mini" : db.settings.modelName};
}
async function completeWithFallback(user: User, db: DBStructure, body: any) {
  const primary = checkHybridQuotaAndRoute(user,db).routedToGpt;
  writeDB(db);
  return withProviderFallback(primary, async gpt => {
    if (gpt && !db.settings.openaiApiKey) throw new Error("GPT API key is not configured");
    const config=providerConfig(gpt,db);
    const response=await fetch(config.url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:config.auth},body:JSON.stringify({...body,model:config.model,stream:false})});
    if(!response.ok) { await response.body?.cancel(); throw new Error(`AI HTTP ${response.status}`); }
    const data=await response.json();
    if(!data.choices?.[0]?.message?.content?.trim()) throw new Error("Empty AI response");
    return data;
  });
}

function getJosa(word: string, type: '은는' | '을를' | '이가' | '아야' | '이야'): string {
  if (!word) return '';
  const lastChar = word.charCodeAt(word.length - 1);
  const isHangul = lastChar >= 0xac00 && lastChar <= 0xd7a3;
  const hasJong = isHangul ? (lastChar - 0xac00) % 28 > 0 : true;

  switch (type) {
    case '은는': return hasJong ? `${word}은` : `${word}는`;
    case '을를': return hasJong ? `${word}을` : `${word}를`;
    case '이가': return hasJong ? `${word}이` : `${word}가`;
    case '아야': return hasJong ? `${word}아` : `${word}야`;
    case '이야': return hasJong ? `${word}이야` : `${word}야`;
    default: return word;
  }
}

function compileSkillPromptForServer(skill: any): string {
  return skill ? compileAiSkillPrompt(skill) : "";
}

function buildSharedSystemPrompt(user: User, isHardwareVoice: boolean = false): string {
  const {persona, profile, memories} = normalizeFriendSettings(user.friendSettings, user.displayName);
  const botName = persona.name;
  const studentName = profile.userName || '친구';
  const activeConfig = user.aiSkillState?.appliedSkill || user.aiSkillState?.skills?.find(s => s.id === user.aiSkillState?.activeSkillId);
  const customSkill = activeConfig?.type === 'custom' ? activeConfig : undefined;
  if (customSkill) {
    let customPrompt = compileSkillPromptForServer(customSkill);
    if (memories.length) customPrompt += `\n[사용자가 확인한 기억: 해당 대상과 관련된 경우에만 활용]\n${memories.map(m => m.text).join('\n')}`;
    if (isHardwareVoice) customPrompt += '\n음성으로 자연스럽게 읽을 수 있는 짧은 문장으로 답하세요. 특수문자와 이모지는 쓰지 마세요.';
    return customPrompt;
  }
  let prompt = `당신은 사용자 '${studentName}'의 AI 로봇 '${botName}'입니다.
[사용자 정보]
- 이름과 부르는 이름: ${studentName}
- 학교: ${profile.school || '미설정'}
- 관심사: ${profile.interests.join(', ') || '미설정'}
- 목표: ${profile.goal || '미설정'}
입력되지 않은 학교, 취미, 목표, 가족·반려동물 정보는 만들어내지 마세요. 모르는 정보는 사용자에게 물어보세요.
[AI 친구 정보]
- 이름: ${botName}
- 소개: ${persona.intro || '미설정'}
- 역할: ${persona.role}
- 성격: ${persona.personality}
- 말투: ${friendToneInstruction(persona.tone)}
사용자와 로봇의 이름을 혼동하지 마세요.`;

  if (memories.length > 0) {
    prompt += `\n\n[3. 우리가 함께 나눈 기억들]:\n` + memories.map((m: any, idx: number) => `  ${idx + 1}. ${m.text || m.content}`).join("\n");
  }

  // 10~11주차 AI 스킬 주입
  const aiSkillState = user.aiSkillState;
  if (aiSkillState && aiSkillState.activeSkillId && aiSkillState.skills) {
    const activeSkill = aiSkillState.appliedSkill || aiSkillState.skills.find((s: any) => s.id === aiSkillState.activeSkillId);
    if (activeSkill) {
      const skillPrompt = compileSkillPromptForServer(activeSkill);
      if (skillPrompt) {
        prompt += `\n\n[4. 현재 장착된 AI 스킬 (최우선 행동 규칙)]:\n${skillPrompt}`;
      }
    }
  }

  if (isHardwareVoice) {
    prompt += `\n\n[실물 소다봇 음성 출력 지침]:
- 특수문자, 괄호, 별표(*), 이모지는 일체 제외하고 1~2문장 이내로 생생하고 자연스럽게 대답해 주세요.`;
  }

  return prompt;
}

function buildDeterministicIdentityReply(user: User, message: string): string | null {
  const normalized = message.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
  const {persona, profile} = normalizeFriendSettings(user.friendSettings, user.displayName);
  const studentName = profile.userName || '친구';
  const polite = persona.tone !== '친근한 친구말';
  const asksAboutUser = ['나는누구','난누구','내가누구','내이름','내취미','내가좋아하는'].some(p => normalized.includes(p));
  if (asksAboutUser) {
    const details = [profile.school ? `학교는 ${profile.school}` : '', profile.interests.length ? `관심사는 ${profile.interests.join(', ')}` : ''].filter(Boolean).join(', ');
    return polite ? `${studentName}님이시죠.${details ? ` ${details}입니다.` : ' 아직 학교와 관심사는 알려주지 않으셨어요.'}`
      : `${studentName}${getJosa(studentName, '이야').slice(studentName.length)}!${details ? ` ${details}${getJosa(details, '이야').slice(details.length)}.` : ' 학교와 관심사도 알려줄래?'}`;
  }
  const asksAboutBot = ['너는누구','넌누구','네이름','니이름','자기소개'].some(p => normalized.includes(p));
  if (asksAboutBot) return polite ? `안녕하세요 ${studentName}님! 저는 ${persona.role} ${persona.name}입니다. 오늘 무엇을 도와드릴까요?`
    : `안녕 ${studentName}! 나는 너의 ${persona.role} ${getJosa(persona.name, '이야')}! 오늘 어떤 이야기를 해볼까?`;
  return null;
}

function findUserByApiKey(token: string, db: DBStructure): User | undefined {
  const cleanToken = token.trim();
  const session = cleanToken ? getSession(cleanToken) : null;
  return resolveFriendUser(cleanToken, db.users, session?.id);
}

// ----------------------------------------------------
// SODA API Gateway (Hardware Proxy)
// ----------------------------------------------------
app.post('/v1/chat/completions', express.json(), async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "").trim();
  const db = readDB();
  const user = findUserByApiKey(token, db);
  if (!user) return res.status(403).json({ error: "Invalid SODA API Key" });

  let responseData: any = null;
  let modelUsed = "Unknown Model";
  let promptMessage = req.body.messages?.[req.body.messages.length - 1]?.content || "No prompt";
  let replyMessage = "No reply";

  try {
    responseData=await completeWithFallback(user,db,req.body);
    modelUsed=responseData.model || "AI";
    replyMessage=responseData.choices[0].message.content;
  }catch(error){console.warn("[Hardware Gateway] 두 모델 연결 실패");}

  if (responseData) {
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

    return res.json(responseData);
  }

  // 둘 다 실패한 경우 친절한 에러 반환
  res.status(503).json({
    error: "AI 엔진(LM Studio 및 OpenAI) 연결에 실패했습니다. 설정을 확인해 주세요."
  });
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

// ESP32용 TTS: 완전한 24kHz 16-bit mono PCM만 전달하고 중간 수신 실패는 한 번 재시도한다.
app.post('/api/hw/tts', aiCapacity, express.json({ limit: '16kb' }), async (req, res) => {
  const authHeader = req.headers.authorization;
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  console.log(`[HW-TTS] 요청 수신: ${text.length}자`);

  const token = authHeader ? authHeader.replace("Bearer ", "").trim() : "";
  const db = readDB();
  const user = findUserByApiKey(token, db);
  if (!user) return res.status(403).json({ error: "Invalid SODA API Key" });

  if (!text) return res.status(400).json({ error: "No text provided" });
  if (text.length > 1000) return res.status(400).json({ error: "Text is too long" });
  if (!db.settings.openaiApiKey) {
    return res.status(503).json({ error: "OpenAI API key is not configured" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("TTS timeout")), 70000);
  const onClose = () => { if (!res.writableEnded) controller.abort(); };
  res.on("close", onClose);
  try {
    const pcmBuffer = await fetchHardwareSpeech(db.settings.openaiApiKey, text, controller.signal);
    if (res.destroyed) return;
    res.status(200);
    res.setHeader("Content-Type", "audio/pcm");
    res.setHeader("Content-Length", String(pcmBuffer.length));
    res.setHeader("Cache-Control", "no-store");
    res.end(pcmBuffer);
  } catch (err: any) {
    if (res.destroyed) return;
    console.error("[HW-TTS] 음성 수신 실패:", err?.cause?.code || err?.name || "Error");
    res.status(controller.signal.aborted ? 504 : 502).json({ error: "음성을 가져오지 못했습니다. 다시 요청해주세요." });
  } finally {
    clearTimeout(timeout);
    res.off("close", onClose);
  }
});

app.get('/api/user/friend-settings', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "").trim();
  const db = readDB();
  const session = getSession(token);
  const user = session ? db.users.find(u => u.id === session.id) : findUserByApiKey(token, db);
  if (!user) return res.status(401).json({ error: "User not found" });

  res.json(normalizeFriendSettings(user.friendSettings, user.displayName));
});

app.post('/api/user/friend-settings', express.json(), (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "").trim();
  const db = readDB();
  const session = getSession(token);
  const user = session ? db.users.find(u => u.id === session.id) : findUserByApiKey(token, db);
  if (!user) return res.status(401).json({ error: "User not found" });

  const validation = validateFriendSettings(req.body);
  if (validation) return res.status(400).json({ error: validation });
  user.friendSettings = normalizeFriendSettings(req.body, user.displayName);
  writeDB(db);
  res.json({ success: true, friendSettings: user.friendSettings });
});

// ----------------------------------------------------
// 10~11주차 프로젝트: AI 스킬 API
// ----------------------------------------------------
app.get('/api/user/ai-skills', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "").trim();
  const db = readDB();
  const session = getSession(token);
  const user = session ? db.users.find(u => u.id === session.id) : findUserByApiKey(token, db);
  if (!user) return res.status(401).json({ error: "User not found" });

  res.json({
    success: true,
    aiSkillState: user.aiSkillState || {
      activeSkillId: 'skill-english-buddy',
      skills: [],
      testLogs: [],
      versionSnapshots: [],
      report: null
    }
  });
});

app.post('/api/user/ai-skills', express.json({limit:'4mb'}), (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "").trim();
  const db = readDB();
  const session = getSession(token);
  const user = session ? db.users.find(u => u.id === session.id) : findUserByApiKey(token, db);
  if (!user) return res.status(401).json({ error: "User not found" });

  const { activeSkillId, skills, testLogs, versionSnapshots, report } = req.body;
  if ((skills !== undefined && (!Array.isArray(skills) || skills.length > 50 || skills.some(s => !s || typeof s.id !== "string" || typeof s.name !== "string" || !["english","coding","study","daily","presentation","custom"].includes(s.type)))) || (testLogs !== undefined && !Array.isArray(testLogs)) || (versionSnapshots !== undefined && !Array.isArray(versionSnapshots))) return res.status(400).json({error:"스킬 저장 형식이 올바르지 않습니다."});
  if (activeSkillId && !(skills || user.aiSkillState?.skills || []).some(s => s.id === activeSkillId)) return res.status(400).json({error:"활성 스킬이 목록에 없습니다."});
  const previousApplied = user.aiSkillState?.appliedSkill || user.aiSkillState?.skills?.find(s => s.id === user.aiSkillState?.activeSkillId);
  if (req.body.applySkillId && !(skills || user.aiSkillState?.skills || []).some(s => s.id === req.body.applySkillId)) return res.status(400).json({error:"적용할 스킬이 없습니다."});
  user.aiSkillState = {
    appliedSkill: previousApplied ? JSON.parse(JSON.stringify(previousApplied)) : undefined,
    activeSkillId: req.body.applySkillId || user.aiSkillState?.activeSkillId || activeSkillId || 'skill-english-buddy',
    skills: skills || user.aiSkillState?.skills || [],
    testLogs: testLogs || user.aiSkillState?.testLogs || [],
    versionSnapshots: versionSnapshots || user.aiSkillState?.versionSnapshots || [],
    report: report !== undefined ? report : (user.aiSkillState?.report || null)
  };

  user.aiSkillState.skills = normalizeSkillSlots(user.aiSkillState.skills);
  if (!user.aiSkillState.skills.some(s => s.id === user.aiSkillState!.activeSkillId)) user.aiSkillState.activeSkillId = 'skill-english-buddy';
  if (req.body.applySkillId || !user.aiSkillState.appliedSkill) user.aiSkillState.appliedSkill = JSON.parse(JSON.stringify(user.aiSkillState.skills.find(s => s.id === user.aiSkillState!.activeSkillId)));
  writeDB(db);
  res.json({ success: true, aiSkillState: user.aiSkillState });
});

app.post('/api/user/ai-skills/activate', express.json(), (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "").trim();
  const db = readDB();
  const session = getSession(token);
  const user = session ? db.users.find(u => u.id === session.id) : findUserByApiKey(token, db);
  if (!user) return res.status(401).json({ error: "User not found" });

  const { skillId } = req.body;
  if (!user.aiSkillState?.skills?.some(s => s.id === skillId)) return res.status(400).json({error:"저장된 스킬을 선택해주세요."});
  if (!user.aiSkillState) {
    user.aiSkillState = { activeSkillId: skillId, skills: [], testLogs: [], versionSnapshots: [] };
  } else {
    user.aiSkillState.activeSkillId = skillId;
    user.aiSkillState.appliedSkill = JSON.parse(JSON.stringify(user.aiSkillState.skills.find(s => s.id === skillId)));
  }

  writeDB(db);
  res.json({ success: true, activeSkillId: skillId });
});

app.post('/api/user/ai-skills/test-log', express.json(), (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "").trim();
  const db = readDB();
  const session = getSession(token);
  const user = session ? db.users.find(u => u.id === session.id) : findUserByApiKey(token, db);
  if (!user) return res.status(401).json({ error: "User not found" });

  const newLog = req.body;
  if (!user.aiSkillState) {
    user.aiSkillState = { activeSkillId: 'skill-english-buddy', skills: [], testLogs: [], versionSnapshots: [] };
  }
  if (!user.aiSkillState.testLogs) {
    user.aiSkillState.testLogs = [];
  }

  user.aiSkillState.testLogs.unshift({
    id: 'log-' + Date.now(),
    timestamp: new Date().toISOString(),
    ...newLog
  });

  writeDB(db);
  res.json({ success: true, testLogs: user.aiSkillState.testLogs });
});

function generateSkillSimulatedResponse(skill: any, userText: string, user: User): string {
  const friendSettings = user.friendSettings || {};
  const persona = friendSettings.persona || {};
  const botName = persona.name || persona.robotName || "소다봇";
  const studentName = normalizeFriendSettings(user.friendSettings, user.displayName).profile.userName || "친구";

  const skillType = skill?.type || 'english';

  if (skillType === 'english') {
    const opts = skill.englishOptions || {};
    const hasCorrection = opts.grammarCorrection;
    const hasHint = opts.koreanHint;
    const isQuiz = opts.wordQuiz;
    const isRoleplay = opts.roleplay;

    if (userText.toLowerCase().includes('hello') || userText.toLowerCase().includes('hi') || userText.includes('안녕')) {
      let res = `Hello ${studentName}! It's so wonderful to talk with you today! 🌟`;
      if (hasHint) res += `\n(안녕 ${studentName}! 오늘 너와 이야기하게 되어 정말 기뻐!)`;
      if (isQuiz) res += `\n\n[💡 Quick Quiz!]: 'Robot'의 철자 뜻을 알고 있니? What does a robot do best?`;
      return res;
    } else if (userText.toLowerCase().includes('name') || userText.includes('이름')) {
      let res = `My name is ${botName}! I am your AI English buddy. What about you?`;
      if (hasHint) res += `\n(내 이름은 ${botName}이야! 나는 너의 AI 영어 친구야. 너는 어때?)`;
      return res;
    } else {
      let res = `That is very interesting! You said: "${userText}". Keep speaking in English, you are doing awesome! 🚀`;
      if (hasCorrection && userText.length > 5 && !userText.includes('.')) {
        res += `\n\n[💡 교정 팁: "${userText}." 처럼 문장 끝에 마침표를 붙이거나 자연스러운 표현으로 말해보면 더 좋아요!]`;
      }
      if (hasHint) res += `\n(정말 흥미로운 이야기야! 영어로 계속 말해봐, 아주 잘하고 있어!)`;
      return res;
    }
  } else if (skillType === 'coding') {
    const opts = skill.codingOptions || {};
    const mode = opts.codeGenMode || 'hint';
    const isError = userText.includes('에러') || userText.includes('error') || userText.includes('오류') || userText.includes('안돼') || userText.includes('안 켜져');

    if (isError) {
      return `앗, 코드나 회로 동작 중에 문제가 생겼구나! 괜찮아, 버그를 잡는 게 진짜 멋진 코딩의 시작이야 🛠️\n\n1. 회로 연결: ESP32 GPIO 핀 번호(예: 버튼은 GPIO4, LED는 GPIO2)가 맞게 꽂혀 있는지 확인해봐!\n2. C++ 코드: \`pinMode(4, INPUT_PULLUP);\` 처럼 핀 모드가 올바르게 선언되었는지 체크해볼까?\n\n어떤 오류 메시지가 뜨는지 알려주면 한 단계씩 같이 고쳐보자!`;
    } else if (mode === 'hint') {
      return `좋은 코딩 질문이야! 💡\n\n힌트를 줄게: 소다봇의 ST7789 LCD는 SPI 통신(MOSI:11, CLK:12, CS:13, DC:7, RST:6)을 사용해. 한 번에 모든 코드를 복사하기보다, 먼저 \`tft.init()\`과 \`tft.fillScreen()\` 함수부터 한 줄씩 테스트해보는 걸 추천해!\n\n직접 시도해보고 잘 안 풀리는 부분을 말해줘!`;
    } else {
      return `소다봇 코딩 튜터 ${botName}이야! 🤖\n\n\`\`\`cpp\n// 소다봇 동작 기본 예제\nvoid setup() {\n  Serial.begin(115200);\n  pinMode(4, INPUT_PULLUP); // 버튼 핀 설정\n}\n\nvoid loop() {\n  if (digitalRead(4) == LOW) {\n    Serial.println("버튼 클릭됨!");\n  }\n}\n\`\`\`\n\n이 코드를 실행해보고 궁금한 점이 있으면 언제든 물어봐!`;
    }
  } else if (skillType === 'study') {
    const opts = skill.studyOptions || {};
    const method = opts.method || 'socratic';

    if (method === 'socratic') {
      return `와, 정말 훌륭한 질문이야! 👏\n\n너는 "${userText}"에 대해 왜 그렇게 된다고 생각하니? 주변에서 비슷한 현상을 본 적이 있니?\n\n너의 생각을 한 문장으로 편하게 들려줘!`;
    } else {
      return `이 개념을 일상 속 비유로 쉽게 설명해줄게! 🌱\n\n컴퓨터의 CPU가 우리의 '두뇌'라면, 메모리(RAM)는 책을 펼쳐두는 '책상'과 같아. 책상이 넓을수록 여러 책을 한꺼번에 보며 공부할 수 있지!\n\n[📌 3줄 핵심 요약]\n1. CPU는 연산과 생각을 담당해요.\n2. RAM은 현재 작업 중인 데이터를 기억해요.\n3. 차근차근 원리를 이해하면 과학이 훨씬 쉬워져요!`;
    }
  } else if (skillType === 'daily') {
    return `안녕 ${studentName}! 오늘 하루도 정말 수고 많았어! 💖\n\n오늘 기분은 어때? 밥은 든든하게 잘 챙겨 먹었니? 오늘 학교에서 재미있었던 일이나 나누고 싶은 이야기가 있다면 다 들려줘! 언제나 네 곁에 있을게 ✨`;
  } else if (skillType === 'presentation') {
    return `발표 코치 ${botName}이야! 🎤\n\n네가 말해준 "${userText}" 발표 내용은 핵심이 아주 명확해! \n\n[💡 스피치 코칭 팁]:\n- 첫 문장에서 청중의 시선을 사로잡는 질문을 던져보세요: "여러분은 혹시 ~를 상상해보신 적이 있나요?"\n- 결론에서는 소다봇을 만들며 배운 점을 당당한 목소리로 강조해보세요!\n\n[모의 예상 질문 (Q&A)]: "만약 배터리가 부족할 때는 어떻게 동작하나요?"라는 질문을 받는다면 어떻게 답변해볼까?`;
  } else {
    const custom = skill.customInputs || {};
    return `안녕! 나는 '${custom.skillName || skill.name || '맞춤 AI'}'이야! ✨\n\n네가 말해준 "${userText}"에 대해 규칙대로 성심껏 답변할게! ${custom.mustDo ? `(${custom.mustDo})` : ''} 무엇이든 신나게 물어봐!`;
  }
}

app.post('/api/ai-skills/test-chat', aiCapacity, express.json(), async (req, res) => {
  const { text, skill, history } = req.body;
  if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "메시지 텍스트가 필요합니다." });

  const authHeader = req.headers.authorization;
  const db = readDB();
  let user: User | null = null;
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "").trim();
    const session = getSession(token);
    user = session ? db.users.find(u => u.id === session.id) || null : findUserByApiKey(token, db);
  }
  if (!user) return res.status(401).json({error:'로그인 또는 유효한 SODA API 키가 필요합니다.'});

  // 통합 시스템 프롬프트 구성 (사용자 프로필 + 친구설정 + 기억 + 현재 선택된 AI 스킬 규칙)
  const testState = skill ? {activeSkillId:skill.id,skills:[skill],testLogs:[],versionSnapshots:[]} : undefined;
  const systemPrompt = buildSharedSystemPrompt({...user,aiSkillState:testState}, false);

  const conversationHistory = Array.isArray(history)
    ? history.slice(-6).map((m: any) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text
      }))
    : [];

  try {
    const data=await completeWithFallback(user,db,{messages:[{role:"system",content:systemPrompt},...conversationHistory,{role:"user",content:text}],temperature:0.7,max_tokens:1024});
    res.json({success:true,reply:data.choices[0].message.content,model:data.model,simulated:false,timestamp:new Date().toISOString()});
  }catch(error){res.status(502).json({error:"AI 테스트 연결에 실패했습니다. 이 응답은 테스트 기록에 저장되지 않습니다."});}
});

app.post('/api/user/ai-skills/report', express.json({limit:'4mb'}), (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "").trim();
  const db = readDB();
  const session = getSession(token);
  const user = session ? db.users.find(u => u.id === session.id) : findUserByApiKey(token, db);
  if (!user) return res.status(401).json({ error: "User not found" });

  const report = req.body;
  if (!user.aiSkillState) {
    user.aiSkillState = { activeSkillId: 'skill-english-buddy', skills: [], testLogs: [], versionSnapshots: [] };
  }
  user.aiSkillState.report = {
    ...report,
    updatedAt: new Date().toISOString()
  };

  writeDB(db);
  res.json({ success: true, report: user.aiSkillState.report });
});

app.post('/api/hw/audio-chat', aiCapacity, upload.single('file'), async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "").trim();
  const db = readDB();
  const user = findUserByApiKey(token, db);
  if (!user) return res.status(403).json({ error: "Invalid SODA API Key" });

  if (!req.file) return res.status(400).json({ error: "No audio file provided" });

  try {
    // 1. STT (Audio to Text) using OpenAI Whisper API
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(req.file.buffer)], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('model', 'whisper-1');
    formData.append('language', 'ko');
    formData.append('prompt', '소다봇에게 말하는 한국어 대화입니다.');

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

    // 2. 웹과 동일한 대화방 문맥 및 친구 프로필 사용
    const voiceSystemPrompt = buildSharedSystemPrompt(user, true);
    let chat = db.chats
      .filter(c => c.userId === user.id)
      .sort((a, b) => {
        const lastA = a.messages[a.messages.length - 1]?.timestamp || a.createdAt;
        const lastB = b.messages[b.messages.length - 1]?.timestamp || b.createdAt;
        return new Date(lastB).getTime() - new Date(lastA).getTime();
      })[0];

    if (!chat) {
      chat = {
        id: "chat-" + crypto.randomUUID(),
        userId: user.id,
        title: "소다와 대화하기 ✨",
        createdAt: new Date().toISOString(),
        messages: []
      };
      db.chats.push(chat);
    }

    const recentHistory = (chat?.messages || [])
      .filter(m => !m.text.includes("로컬 엔진이 잠시 쉬고 있어"))
      .slice(-19)
      .map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text
      }));

    // 신원 질문은 작은 로컬 모델의 대명사 혼동을 피하고 웹과 완전히 같은 프로필 답변을 보장한다.
    const quizReply = await handleQuiz(chat, transcript, user, db);
    let replyMessage = quizReply ?? buildDeterministicIdentityReply(user, transcript);
    let modelUsed = quizReply !== null ? "SODA Quiz" : "SODA Profile";

    if (!replyMessage) {
      const data = await completeWithFallback(user,db,{
        messages:[{role:"system",content:voiceSystemPrompt},...recentHistory,{role:"user",content:transcript}],
        temperature:db.settings.temperature ?? 0.7,max_tokens:Math.min(db.settings.maxTokens || 1024,1024)
      });
      replyMessage=data.choices[0].message.content;
      modelUsed=data.model || "AI";
    }

    replyMessage = replyMessage.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "").trim();

    // 3. Save to Unified DB Conversation Thread


    const hwUserMsg: Message = {
      id: "msg-" + Date.now() + "-hw-user",
      sender: "user",
      text: transcript,
      timestamp: new Date().toISOString(),
      source: "sodabot",
      deviceId: "SODABOT-01"
    };

    const hwBotMsg: Message = {
      id: "msg-" + (Date.now() + 1) + "-hw-bot",
      sender: "assistant",
      text: replyMessage,
      timestamp: new Date().toISOString(),
      source: "sodabot",
      deviceId: "SODABOT-01",
      modelUsed
    };

    chat.messages.push(hwUserMsg, hwBotMsg);
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

  const token = authHeader.replace("Bearer ", "").trim();
  const db = readDB();
  
  const user = findUserByApiKey(token, db);
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
  friendSettings?: any;
  lastActivity: number;
}

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30분 무동작 시 세션 만료

const sessions = new Map<string, SessionUser>();

function getSession(token: string): SessionUser | undefined {
  if (!token) return undefined;
  const session = sessions.get(token);
  if (!session) return undefined;

  const now = Date.now();
  if (session.lastActivity && now - session.lastActivity > SESSION_TIMEOUT_MS) {
    sessions.delete(token);
    return undefined;
  }

  session.lastActivity = now;
  return session;
}

// 1분마다 만료된 세션 메모리 자동 정리
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.lastActivity && now - session.lastActivity > SESSION_TIMEOUT_MS) {
      sessions.delete(token);
    }
  }
}, 60 * 1000);

function createSession(userData: Omit<SessionUser, "lastActivity">): { sessionId: string; sessionUser: SessionUser } {
  const sessionId = Math.random().toString(36).substring(2, 15);
  const sessionUser: SessionUser = {
    ...userData,
    lastActivity: Date.now()
  };
  sessions.set(sessionId, sessionUser);
  return { sessionId, sessionUser };
}

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

  const identifier = (username || name)?.trim();
  const secret = (password || phone)?.trim();

  if (!identifier || !secret) {
    return res.status(400).json({ error: "아이디(또는 이름)와 비밀번호(또는 전화번호 뒷자리)를 모두 입력해 주세요." });
  }

  // 1. 마스터 관리자 프리패스
  if ((identifier === "admin" && (secret === "password123" || secret === "admin123")) ||
      (identifier === "aiden" && (secret === "3531" || secret === "1234"))) {
    let adminUser = db.users.find(u => u.username === identifier);
    if (!adminUser) {
      adminUser = {
        id: "admin-" + Date.now(),
        username: identifier,
        displayName: identifier === "aiden" ? "에이든 (관리자)" : "운영자",
        passwordHash: secret,
        role: "admin",
        canAccessChat: true
      };
      db.users.push(adminUser);
    }
    const apiKey = ensureUserApiKey(adminUser, db);

    const { sessionId, sessionUser } = createSession({
      id: adminUser.id,
      username: adminUser.username,
      displayName: adminUser.displayName,
      role: "admin",
      canAccessChat: true,
      personalApiKey: apiKey
    });
    return res.json({ success: true, sessionId, user: sessionUser });
  }

  // 2. 관리자 명시 로그인 요청인 경우 로컬 DB 검사
  if (loginType === "admin") {
    const user = db.users.find(u => u.username === identifier);
    if (!user || user.passwordHash !== secret) {
      return res.status(401).json({ error: "관리자 아이디 또는 비밀번호가 올바르지 않습니다." });
    }
    const apiKey = ensureUserApiKey(user, db);
    const isUserAdmin = user.username === "admin" || user.role === "admin";
    const { sessionId, sessionUser } = createSession({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: isUserAdmin ? "admin" : (user.role || "student"),
      canAccessChat: isUserAdmin ? true : (user.canAccessChat ?? false),
      personalApiKey: apiKey
    });
    return res.json({ success: true, sessionId, user: sessionUser });
  }

  // 3. 로컬 DB(db.users) 계정 검사 (관리자 또는 기존 등록된 사용자/학생 ID)
  const localMatched = db.users.find(u => 
    (u.username === identifier || u.displayName === identifier || u.id === identifier) && 
    (u.passwordHash === secret || (!u.passwordHash && secret === "1234"))
  );
  if (localMatched) {
    const apiKey = ensureUserApiKey(localMatched, db);
    const isUserAdmin = localMatched.username === "admin" || localMatched.role === "admin";
    const { sessionId, sessionUser } = createSession({
      id: localMatched.id,
      username: localMatched.username,
      displayName: localMatched.displayName,
      role: isUserAdmin ? "admin" : (localMatched.role || "student"),
      canAccessChat: isUserAdmin ? true : (localMatched.canAccessChat ?? false),
      personalApiKey: apiKey
    });
    return res.json({ success: true, sessionId, user: sessionUser });
  }

  // 4. 학생 MySQL 인증 (Name + Phone 4 digits via soda-home MySQL)
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
    const { sessionId, sessionUser } = createSession({
      id: aidenUser.id,
      username: "aiden",
      displayName: "Aiden (Master Admin)",
      role: "admin",
      canAccessChat: true,
      personalApiKey: apiKey
    });
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
    const isRumi = student.name === "김루미" || studentUsername === "김루미";
    if (!localUser) {
      localUser = {
        id: `student-${student.id}`,
        username: studentUsername,
        displayName: student.name,
        passwordHash: phoneLast4,
        role: "student",
        canAccessChat: isRumi ? true : false
      };
      db.users.push(localUser);
    } else {
      localUser.displayName = student.name;
      if (isRumi) {
        localUser.canAccessChat = true;
      }
      writeDB(db);
    }
    const apiKey = ensureUserApiKey(localUser, db);
    const isRumiOrAdmin = isRumi || localUser?.canAccessChat;
    const { sessionId, sessionUser } = createSession({
      id: localUser.id,
      username: localUser.username,
      displayName: localUser.displayName,
      role: "student",
      canAccessChat: Boolean(isRumiOrAdmin || localUser.canAccessChat),
      personalApiKey: apiKey
    });

    return res.json({ success: true, sessionId, user: sessionUser });

  } catch (err: any) {
    console.error("Student login MySQL query error:", err);
    // Fallback: Check local db.json if MySQL is temporarily offline
    const fallbackUser = db.users.find(
      u => (u.displayName === studentName || u.username === studentName) && u.passwordHash === phoneLast4
    );
    if (fallbackUser) {
      const apiKey = ensureUserApiKey(fallbackUser, db);
      const { sessionId, sessionUser } = createSession({
        id: fallbackUser.id,
        username: fallbackUser.username,
        displayName: fallbackUser.displayName,
        role: fallbackUser.role || "student",
        canAccessChat: fallbackUser.canAccessChat ?? false,
        personalApiKey: apiKey
      });
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

  const { sessionId, sessionUser } = createSession({
    id: newUser.id,
    username: newUser.username,
    displayName: newUser.displayName,
    role: "student",
    canAccessChat: false,
    personalApiKey: apiKey
  });

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
  let session = getSession(token);
  const db = readDB();

  // 세션이 메모리에 없을 때 (서버 재시작 등) DB 또는 기본 유저 매칭 복구
  if (!session) {
    const matchedUser = db.users.find(u => u.personalApiKey === token);
    if (matchedUser) {
      const isUserAdmin = matchedUser.username === "admin" || matchedUser.role === "admin";
      const apiKey = ensureUserApiKey(matchedUser, db);
      session = {
        id: matchedUser.id,
        username: matchedUser.username,
        displayName: matchedUser.displayName,
        role: isUserAdmin ? "admin" : (matchedUser.role || "student"),
        canAccessChat: isUserAdmin ? true : (matchedUser.canAccessChat ?? false),
        personalApiKey: apiKey,
        lastActivity: Date.now()
      };
      sessions.set(token, session);
    } else {
      return res.status(401).json({ error: "세션이 만료되었습니다." });
    }
  }

  // DB 최신 권한 상태와 실시간 동기화
  const dbUser = db.users.find(u => u.id === session!.id);
  if (dbUser) {
    const isUserAdmin = dbUser.username === "admin" || dbUser.role === "admin" || dbUser.displayName === "김루미" || dbUser.username === "김루미";
    const apiKey = ensureUserApiKey(dbUser, db);
    session.displayName = dbUser.displayName;
    session.role = isUserAdmin ? "admin" : (dbUser.role || "student");
    session.canAccessChat = isUserAdmin ? true : (dbUser.canAccessChat ?? false);
    session.personalApiKey = apiKey;
    session.friendSettings = dbUser.friendSettings || null;
  }

  res.json({ user: session });
});

app.post("/api/sodabot/speak", express.json(), async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const { text } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Text is required" });
  }

  // 브로드캐스트 또는 웹소켓/서버 버퍼를 통해 실물 소다봇에게 전달 가능하도록 처리
  console.log(`[SODABOT-SPEAK] 전달 요청된 텍스트: "${text}"`);
  res.json({ success: true, message: "Transmitted to SODABOT for speech output", text });
});

app.get("/api/auth/current-key", (req, res) => {
  const db = readDB();
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    const session = getSession(token);
    if (session) {
      const dbUser = db.users.find(u => u.id === session.id);
      if (dbUser) {
        return res.json({ apiKey: ensureUserApiKey(dbUser, db) });
      }
    }
  }
  return res.status(401).json({error:"로그인이 필요합니다."});
});

// ----------------------------------------------------
// Admin API
// ----------------------------------------------------
const requireAdmin = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증되지 않은 사용자입니다." });
  
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
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
app.get("/api/circuit-progress", (req, res) => {
  const session = getSession((req.headers.authorization || "").replace(/^Bearer /, ""));
  if (!session) return res.status(401).json({ error: "로그인이 필요합니다." });
  res.json({ userId: session.id, progress: readDB().circuitProgress?.[session.id] || null });
});
app.put("/api/circuit-progress", (req, res) => {
  const session = getSession((req.headers.authorization || "").replace(/^Bearer /, ""));
  if (!session) return res.status(401).json({ error: "로그인이 필요합니다." });
  const data = req.body;
  if (data?.version !== 1 || !Array.isArray(data.wires) || data.wires.length > 500 || typeof data.code !== "string" || data.code.length > 20000) return res.status(400).json({ error: "잘못된 회로 데이터입니다." });
  const db = readDB();
  db.circuitProgress ||= {};
  db.circuitProgress[session.id] = { updatedAt: new Date().toISOString(), data };
  writeDB(db);
  res.json({ success: true });
});
app.get("/api/admin/circuit-progress", requireAdmin, (req, res) => {
  const db = readDB();
  res.json({ results: Object.entries(db.circuitProgress || {}).map(([userId, result]) => ({ userId, displayName: db.users.find(u => u.id === userId)?.displayName || userId, ...result })) });
});

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
  }).sort((a, b) => {
    const rank = (id: string) => ({
      "content-week-2-breadboard-secret": -5, "content-week-2-circuit-lab": -4, "content-week-2-sound-lab": -3,
      "content-week-2-circuit-diagram": -4, "content-week-2-amplifier-lab": -3, "content-week-2-sound": -2, "content-week-2-btn-led-sound": -1, "content-week-4-lcd-code-lab": -1, "content-week-3-lcd-lab": 0.5, "content-week-3-lcd-hello": 1, "content-week-3-lcd-basic": 2, "content-week-4-lcd-shapes-lab": 2.5, "content-week-3-lcd-shapes": 3, "content-week-4-lcd-frame-lab": 3.5, "content-week-3-lcd-editor": 4, "content-week-4-lcd-expression-lab": 5
    }[id] || 0);
    return a.week - b.week || rank(a.id) - rank(b.id);
  });

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
      dailyGptQuota: db.settings.dailyGptQuota ?? 30
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
      dailyGptQuota: db.settings.dailyGptQuota ?? 30
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
function getLocalNetworkIps(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (netList) {
      for (const net of netList) {
        if (net.family === 'IPv4' && !net.internal) {
          ips.push(net.address);
        }
      }
    }
  }
  return ips;
}

app.get("/api/server-info", (req, res) => {
  const localIps = getLocalNetworkIps();
  const primaryIp = localIps.find(ip => ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) || localIps[0] || '127.0.0.1';
  res.json({
    port: PORT,
    localIps,
    primaryIp,
    lanUrl: `http://${primaryIp}:${PORT}`
  });
});

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

async function handleQuiz(chat: ChatRoom, text: string, user: User, db: DBStructure) {
  const state = chat.quizState || {topic:""};
  const reply = await quizTurn(state, text, async topic => {
    const result = await completeWithFallback(user,db,{
      messages:[{role:"system",content:'한국어 객관식 퀴즈 한 문제. 요청한 주제와 난이도를 따르고 정확한 사실만 사용하세요. 정답 하나, 보기 3개. JSON만 출력: {"question":"질문","choices":["보기1","보기2","보기3"],"answer":1,"explanation":"정답 이유"}. answer는 1~3 정수.'},{role:"user",content:topic}],temperature:0.7,max_tokens:600
    });
    return parseQuizQuestion(result.choices?.[0]?.message?.content || "");
  });
  if (reply !== null) chat.quizState = state;
  if (reply === null && !state.question && hasUntrackedQuiz(chat.messages)) {
    return '이전 문제는 정답이 저장되지 않아 정확하게 채점할 수 없어요. 앞서 맞다고 한 답변도 신뢰할 수 없어요. “새 퀴즈 내줘”라고 말하면 정답을 저장한 새 문제로 시작할게요.';
  }
  return reply;
}

// Streaming proxy to LM Studio with virtual emulator fallback
app.post("/api/lmstudio/stream", aiCapacity, async (req, res) => {
  req.socket.setNoDelay(true);
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });

  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const db = readDB();
  const user = db.users.find(u => u.id === session.id);
  
  const quizChat = req.body.chatId ? db.chats.find(c => c.id === req.body.chatId && c.userId === session.id) : undefined;
  if (req.body.chatId && !quizChat) return res.status(404).json({error:"대화방을 찾을 수 없습니다."});
  const latestText = Array.isArray(req.body.messages) ? [...req.body.messages].reverse().find(m => m.role === "user")?.content : undefined;
  if (quizChat && user && typeof latestText === "string") {
    const reply = await handleQuiz(quizChat, latestText, user, db);
    if (reply !== null) {
      writeDB(db);
      res.setHeader("Content-Type","text/event-stream");
      res.setHeader("Cache-Control","no-cache");
      res.write(`data: ${JSON.stringify({model:"SODA Quiz",choices:[{delta:{content:reply},finish_reason:"stop"}]})}\n\n`);
      return res.end("data: [DONE]\n\n");
    }
  }
  delete req.body.chatId;
  if (user && Array.isArray(req.body.messages)) {
    req.body.messages = [{role:"system",content:buildSharedSystemPrompt(user,false)},...req.body.messages.filter(m => m.role !== "system")];
  }
  if (!user) return res.status(401).json({error:"사용자를 찾을 수 없습니다."});
  const primary=checkHybridQuotaAndRoute(user,db).routedToGpt;
  writeDB(db);
  res.setHeader("Content-Type","text/event-stream");
  res.setHeader("Cache-Control","no-cache");
  const controller=new AbortController();
  res.once("close",()=>{if(!res.writableEnded)controller.abort();});
  let started=false;
  for (const gpt of [primary,!primary]) {
    try {
      const config=providerConfig(gpt,db);
      const upstream=await fetch(config.url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:config.auth},body:JSON.stringify({...req.body,model:config.model,stream:true}),signal:controller.signal});
      if(!upstream.ok || !upstream.body) {await upstream.body?.cancel();throw new Error(`AI HTTP ${upstream.status}`);}
      const reader=upstream.body.getReader();
      while(true) {
        const {value,done}=await reader.read();
        if(done)break;
        if(value?.length){started=true;res.write(value);}
      }
      if(!started)throw new Error("Empty AI stream");
      return res.end();
    }catch(error){
      if(res.destroyed || controller.signal.aborted)return;
      // Never concatenate a second model's answer onto a partial answer.
      if(started)break;
      console.warn(`[AI] ${gpt ? "GPT" : "LM Studio"} 실패, 대체 모델 시도`);
    }
  }
  res.write(`data: ${JSON.stringify({choices:[{delta:{content:"\n응답 연결이 중단됐습니다. 두 모델의 연결 상태를 확인해주세요."}}]})}\n\n`);
  res.end("data: [DONE]\n\n");
});


// ----------------------------------------------------
// Chats & Message History API (ChatGPT Vibe)
// ----------------------------------------------------
app.get("/api/chats", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });

  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const db = readDB();
  const isAdmin = session.role === "admin" || session.username === "admin";
  let userChats = db.chats.filter(c => c.userId === session.id || (isAdmin && (c.userId === "user-1" || !c.userId)));

  if (userChats.length === 0) {
    const newChat: ChatRoom = {
      id: "chat-" + crypto.randomUUID(),
      userId: session.id,
      title: "새로운 대화 ✨",
      createdAt: new Date().toISOString(),
      messages: []
    };
    db.chats.push(newChat);
    writeDB(db);
    userChats = [newChat];
  }

  res.json(userChats);
});

app.post("/api/chats", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });

  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { title } = req.body;
  const db = readDB();

  const newChat: ChatRoom = {
    id: "chat-" + crypto.randomUUID(),
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

  const session = getSession(authHeader.replace("Bearer ", ""));
  if (!session) return res.status(401).json({error:"세션 만료"});
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

  const session = getSession(authHeader.replace("Bearer ", ""));
  if (!session) return res.status(401).json({error:"세션 만료"});
  const { id } = req.params;
  const { messages, title } = req.body;

  const db = readDB();
  const chat = db.chats.find(c => c.id === id && c.userId === session.id);

  if (!chat) {
    return res.status(404).json({ error: "대화방을 찾을 수 없습니다." });
  }

  if (title) chat.title = title;
  if (messages && Array.isArray(messages)) {
    if (req.body.replace) {
      chat.messages = messages;
    } else {
      const ids = new Set(chat.messages.map(m => m.id));
      chat.messages.push(...messages.filter(m => m && typeof m.id === "string" && !ids.has(m.id)));
    }
  }

  writeDB(db);
  res.json({ success: true, chat });
});

// Clear all chats for user and create a fresh one
app.post("/api/chats/clear-all", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });

  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const db = readDB();
  db.chats = db.chats.filter(c => c.userId !== session.id);

  const newChat: ChatRoom = {
    id: "chat-" + crypto.randomUUID(),
    userId: session.id,
    title: "새로운 대화 ✨",
    createdAt: new Date().toISOString(),
    messages: []
  };

  db.chats.push(newChat);
  writeDB(db);

  res.json({ success: true, chat: newChat, chats: [newChat] });
});

// Clear messages in chat room
app.post("/api/chats/:id/clear", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });

  const session = getSession(authHeader.replace("Bearer ", ""));
  if (!session) return res.status(401).json({error:"세션 만료"});
  const { id } = req.params;
  const db = readDB();
  const chat = db.chats.find(c => c.id === id && c.userId === session.id);

  if (!chat) {
    return res.status(404).json({ error: "대화방을 찾을 수 없습니다." });
  }

  chat.messages = [];
  delete chat.quizState;
  chat.createdAt = new Date().toISOString();
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
app.post("/api/chats/:id/messages", aiCapacity, async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });

  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
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

  const quizReply = dbUser ? await handleQuiz(chat, text, dbUser, db) : null;
  if (quizReply !== null) {
    const assistantMessage: Message = {id:"msg-" + crypto.randomUUID(), sender:"assistant", text:quizReply, timestamp:new Date().toISOString(), modelUsed:"SODA Quiz"};
    chat.messages.push(assistantMessage);
    writeDB(db);
    return res.json({success:true,userMessage:userMsg,assistantMessage,usedEmulator:false,chatTitle:chat.title});
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

  // 사용자 프로필, 친구설정, 기억, 그리고 10~11주차 활성 AI 스킬이 결합된 통합 시스템 프롬프트 생성
  const userRecord = db.users.find(u => u.id === session.id);
  let sodabotPersona = userRecord ? buildSharedSystemPrompt(userRecord, false) : "코딩 학원 '디랩(D-Lab)'의 인공지능 코딩 반려봇 '소다봇'이야.";
  
  if (userRecord && userRecord.persona) {
    sodabotPersona = `${sodabotPersona}\n\n[특별 관리자 지시사항]\n${userRecord.persona}`;
  }

  let actualModel = "AI";
  try {
    const result=await completeWithFallback(dbUser!,db,{messages:[{role:"system",content:sodabotPersona},...conversationHistory],temperature:0.7,max_tokens:1024});
    assistantOutput=result.choices[0].message.content;
    actualModel=result.model || "AI";
  }catch(error){assistantOutput="두 AI 모델에 연결하지 못했습니다. 연결 상태를 확인해주세요.";}

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
// SODABOT Friends & Direct Messaging System
// ----------------------------------------------------

function getOrCreatePublicProfile(user: User, db: DBStructure): SodabotPublicProfile {
  let profile = db.friendProfiles?.find(p => p.userId === user.id);
  if (!profile) {
    const friendSettings = user.friendSettings || {};
    const botName = friendSettings.persona?.robotName || friendSettings.persona?.name || "소다봇";
    const nickname = user.displayName || user.username || "소다친구";
    
    profile = {
      userId: user.id,
      botName,
      nickname,
      description: "코딩과 인공지능을 배우는 소다봇 친구야 ✨",
      avatarUrl: "robot-blue",
      isPublic: false // 기본값은 비공개(학생 프라이버시 보호)
    };
    if (!db.friendProfiles) db.friendProfiles = [];
    db.friendProfiles.push(profile);
    writeDB(db);
  }
  return profile;
}

function isUserOnline(userId: string, db: DBStructure): { isOnline: boolean; lastSeenAt?: string } {
  const lastSeen = db.userPresences?.[userId];
  if (!lastSeen) return { isOnline: false };
  const diffMs = Date.now() - new Date(lastSeen).getTime();
  const isOnline = diffMs < 45000; // 45초 이내 heartbeat 있으면 온라인
  return { isOnline, lastSeenAt: lastSeen };
}

// 1. Presence Heartbeat Ping
app.post("/api/presence/ping", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const db = readDB();
  if (!db.userPresences) db.userPresences = {};
  db.userPresences[session.id] = new Date().toISOString();
  writeDB(db);

  res.json({ success: true, timestamp: db.userPresences[session.id] });
});

// 2. Get My Public Profile
app.get("/api/friends/my-profile", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const db = readDB();
  const user = db.users.find(u => u.id === session.id);
  if (!user) return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });

  const profile = getOrCreatePublicProfile(user, db);
  const { isOnline, lastSeenAt } = isUserOnline(user.id, db);

  res.json({ ...profile, isOnline, lastSeenAt });
});

// 3. Update My Public Profile (소다봇 공개 설정 및 프로필 변경)
app.post("/api/friends/my-profile", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { isPublic, botName, nickname, description, avatarUrl } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.id === session.id);
  if (!user) return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });

  const profile = getOrCreatePublicProfile(user, db);

  if (typeof isPublic === "boolean") profile.isPublic = isPublic;
  if (typeof botName === "string" && botName.trim()) profile.botName = botName.trim().substring(0, 20);
  if (typeof nickname === "string" && nickname.trim()) profile.nickname = nickname.trim().substring(0, 20);
  if (typeof description === "string") profile.description = description.trim().substring(0, 80);
  if (typeof avatarUrl === "string") profile.avatarUrl = avatarUrl;

  writeDB(db);
  const { isOnline, lastSeenAt } = isUserOnline(user.id, db);
  res.json({ success: true, profile: { ...profile, isOnline, lastSeenAt } });
});

// 4. Search Public Friends (공개된 소다봇만 검색, 개인정보 제외)
app.get("/api/friends/search", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const query = ((req.query.q as string) || "").trim().toLowerCase();
  const db = readDB();
  const currentUserId = session.id;

  // 공개 설정된 프로필만 필터링 (본인 제외)
  const publicProfiles = (db.friendProfiles || []).filter(p => p.isPublic && p.userId !== currentUserId);

  const results = publicProfiles
    .filter(p => {
      // 본인과 차단 관계인지 확인
      const isBlocked = (db.friendships || []).some(
        f => f.status === "blocked" && 
        ((f.requesterId === currentUserId && f.receiverId === p.userId) ||
         (f.requesterId === p.userId && f.receiverId === currentUserId))
      );
      if (isBlocked) return false;

      if (!query) return true;
      return (
        p.botName.toLowerCase().includes(query) ||
        p.nickname.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      );
    })
    .map(p => {
      const { isOnline, lastSeenAt } = isUserOnline(p.userId, db);
      
      // 나와의 관계 확인
      const friendship = (db.friendships || []).find(
        f => (f.requesterId === currentUserId && f.receiverId === p.userId) ||
             (f.requesterId === p.userId && f.receiverId === currentUserId)
      );

      let friendshipStatus: "none" | "pending_sent" | "pending_received" | "accepted" | "blocked" = "none";
      if (friendship) {
        if (friendship.status === "accepted") friendshipStatus = "accepted";
        else if (friendship.status === "blocked") friendshipStatus = "blocked";
        else if (friendship.status === "pending") {
          friendshipStatus = friendship.requesterId === currentUserId ? "pending_sent" : "pending_received";
        }
      }

      // 개인정보(실명, 학교, 학년 등)는 철저히 배제하고 안전한 정보만 반환
      return {
        userId: p.userId,
        botName: p.botName,
        nickname: p.nickname,
        description: p.description,
        avatarUrl: p.avatarUrl || "robot-blue",
        isOnline,
        lastSeenAt,
        friendshipStatus,
        friendshipId: friendship?.id
      };
    });

  res.json(results);
});

// 5. Get My Friends List (내 승인된 친구 목록)
app.get("/api/friends/list", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const db = readDB();
  const currentUserId = session.id;

  const acceptedFriendships = (db.friendships || []).filter(
    f => f.status === "accepted" && (f.requesterId === currentUserId || f.receiverId === currentUserId)
  );

  const friends = acceptedFriendships.map(f => {
    const friendUserId = f.requesterId === currentUserId ? f.receiverId : f.requesterId;
    const friendUser = db.users.find(u => u.id === friendUserId);
    const profile = friendUser ? getOrCreatePublicProfile(friendUser, db) : null;
    const { isOnline, lastSeenAt } = isUserOnline(friendUserId, db);

    // 안 읽은 메시지 수 계산
    const unreadCount = (db.directMessages || []).filter(
      m => m.senderId === friendUserId && m.receiverId === currentUserId && m.status !== "read"
    ).length;

    // 최근 메시지 1개
    const threadMessages = (db.directMessages || []).filter(
      m => (m.senderId === currentUserId && m.receiverId === friendUserId) ||
           (m.senderId === friendUserId && m.receiverId === currentUserId)
    );
    const lastMessage = threadMessages.length > 0 ? threadMessages[threadMessages.length - 1] : undefined;

    return {
      userId: friendUserId,
      botName: profile?.botName || "소다봇",
      nickname: profile?.nickname || friendUser?.displayName || "친구",
      description: profile?.description || "",
      avatarUrl: profile?.avatarUrl || "robot-blue",
      isOnline,
      lastSeenAt,
      friendshipId: f.id,
      friendshipStatus: "accepted" as const,
      unreadCount,
      lastMessage
    };
  });

  // 온라인인 친구를 상단으로 정렬
  friends.sort((a, b) => {
    if (a.isOnline === b.isOnline) {
      const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return timeB - timeA;
    }
    return a.isOnline ? -1 : 1;
  });

  res.json(friends);
});

// 6. Get Friend Requests (받은 요청 & 보낸 요청)
app.get("/api/friends/requests", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const db = readDB();
  const currentUserId = session.id;

  const incoming = (db.friendships || [])
    .filter(f => f.receiverId === currentUserId && f.status === "pending")
    .map(f => {
      const requesterUser = db.users.find(u => u.id === f.requesterId);
      const profile = requesterUser ? getOrCreatePublicProfile(requesterUser, db) : null;
      const { isOnline, lastSeenAt } = isUserOnline(f.requesterId, db);
      return {
        id: f.id,
        requesterId: f.requesterId,
        createdAt: f.createdAt,
        profile: {
          userId: f.requesterId,
          botName: profile?.botName || "소다봇",
          nickname: profile?.nickname || requesterUser?.displayName || "친구",
          description: profile?.description || "",
          avatarUrl: profile?.avatarUrl || "robot-blue",
          isOnline,
          lastSeenAt
        }
      };
    });

  const outgoing = (db.friendships || [])
    .filter(f => f.requesterId === currentUserId && f.status === "pending")
    .map(f => {
      const receiverUser = db.users.find(u => u.id === f.receiverId);
      const profile = receiverUser ? getOrCreatePublicProfile(receiverUser, db) : null;
      const { isOnline, lastSeenAt } = isUserOnline(f.receiverId, db);
      return {
        id: f.id,
        receiverId: f.receiverId,
        createdAt: f.createdAt,
        profile: {
          userId: f.receiverId,
          botName: profile?.botName || "소다봇",
          nickname: profile?.nickname || receiverUser?.displayName || "친구",
          description: profile?.description || "",
          avatarUrl: profile?.avatarUrl || "robot-blue",
          isOnline,
          lastSeenAt
        }
      };
    });

  res.json({ incoming, outgoing });
});

// 7. Send Friend Request (친구 요청 보내기)
app.post("/api/friends/request", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { targetUserId } = req.body;
  if (!targetUserId || targetUserId === session.id) {
    return res.status(400).json({ error: "올바른 친구 대상을 지정해주세요." });
  }

  const db = readDB();
  const targetUser = db.users.find(u => u.id === targetUserId);
  if (!targetUser) return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });

  if (!db.friendships) db.friendships = [];

  // 기존 관계 확인
  const existing = db.friendships.find(
    f => (f.requesterId === session.id && f.receiverId === targetUserId) ||
         (f.requesterId === targetUserId && f.receiverId === session.id)
  );

  if (existing) {
    if (existing.status === "accepted") {
      return res.status(400).json({ error: "이미 친구로 등록되어 있습니다." });
    }
    if (existing.status === "blocked") {
      return res.status(403).json({ error: "친구 요청을 보낼 수 없는 상태입니다." });
    }
    if (existing.status === "pending") {
      if (existing.requesterId === session.id) {
        return res.status(400).json({ error: "이미 친구 요청을 보냈습니다. 상대방의 수락을 기다려주세요." });
      } else {
        // 상대방이 이미 나에게 요청을 보낸 상태 -> 즉시 수락 처리!
        existing.status = "accepted";
        existing.acceptedAt = new Date().toISOString();
        writeDB(db);
        return res.json({ success: true, status: "accepted", message: "상호 친구 요청으로 즉시 친구가 되었습니다! 🎉" });
      }
    }
    if (existing.status === "rejected") {
      // 거절되었던 관계 재요청
      existing.requesterId = session.id;
      existing.receiverId = targetUserId;
      existing.status = "pending";
      existing.createdAt = new Date().toISOString();
      writeDB(db);
      return res.json({ success: true, status: "pending", message: "친구 요청을 보냈습니다." });
    }
  }

  const newFriendship: Friendship = {
    id: "fr-" + Date.now() + "-" + crypto.randomBytes(3).toString("hex"),
    requesterId: session.id,
    receiverId: targetUserId,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  db.friendships.push(newFriendship);
  writeDB(db);

  res.json({ success: true, status: "pending", message: "친구 요청을 보냈습니다." });
});

// 8. Respond to Friend Request (수락 또는 거절)
app.post("/api/friends/respond", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { requestId, action } = req.body;
  if (!requestId || !["accept", "reject"].includes(action)) {
    return res.status(400).json({ error: "올바른 요청 파라미터를 입력해주세요." });
  }

  const db = readDB();
  const friendship = (db.friendships || []).find(f => f.id === requestId && f.receiverId === session.id);
  if (!friendship) {
    return res.status(404).json({ error: "대기 중인 친구 요청을 찾을 수 없습니다." });
  }

  if (action === "accept") {
    friendship.status = "accepted";
    friendship.acceptedAt = new Date().toISOString();
  } else {
    // 거절 시 목록에서 제거
    const idx = db.friendships!.findIndex(f => f.id === requestId);
    if (idx !== -1) db.friendships!.splice(idx, 1);
  }

  writeDB(db);
  res.json({ success: true, action, message: action === "accept" ? "친구 요청을 수락했습니다! 🎉" : "친구 요청을 거절했습니다." });
});

// 9. Delete Friend (친구 삭제)
app.post("/api/friends/delete", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { friendUserId } = req.body;
  const db = readDB();
  
  const idx = (db.friendships || []).findIndex(
    f => (f.requesterId === session.id && f.receiverId === friendUserId) ||
         (f.requesterId === friendUserId && f.receiverId === session.id)
  );

  if (idx !== -1) {
    db.friendships!.splice(idx, 1);
    writeDB(db);
    return res.json({ success: true, message: "친구를 삭제했습니다." });
  }

  res.status(404).json({ error: "등록된 친구를 찾을 수 없습니다." });
});

// 10. Block User (친구 차단)
app.post("/api/friends/block", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { targetUserId } = req.body;
  if (!targetUserId || targetUserId === session.id) {
    return res.status(400).json({ error: "올바른 대상을 지정해주세요." });
  }

  const db = readDB();
  if (!db.friendships) db.friendships = [];

  let friendship = db.friendships.find(
    f => (f.requesterId === session.id && f.receiverId === targetUserId) ||
         (f.requesterId === targetUserId && f.receiverId === session.id)
  );

  if (friendship) {
    friendship.status = "blocked";
    friendship.requesterId = session.id;
    friendship.receiverId = targetUserId;
  } else {
    db.friendships.push({
      id: "fr-blk-" + Date.now(),
      requesterId: session.id,
      receiverId: targetUserId,
      status: "blocked",
      createdAt: new Date().toISOString()
    });
  }

  writeDB(db);
  res.json({ success: true, message: "사용자를 차단했습니다." });
});

// 11. Get Direct Messages with a Friend (1:1 친구 메시지 내역)
app.get("/api/friends/messages/:friendId", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { friendId } = req.params;
  const db = readDB();

  // 친구 관계 검증 (승인된 친구만 메시지 열람 가능)
  const isFriend = (db.friendships || []).some(
    f => f.status === "accepted" &&
    ((f.requesterId === session.id && f.receiverId === friendId) ||
     (f.requesterId === friendId && f.receiverId === session.id))
  );

  if (!isFriend) {
    return res.status(403).json({ error: "친구로 등록된 사용자와만 메시지를 주고받을 수 있습니다." });
  }

  const messages = (db.directMessages || []).filter(
    m => (m.senderId === session.id && m.receiverId === friendId) ||
         (m.senderId === friendId && m.receiverId === session.id)
  );

  // 상대방이 나에게 보낸 안읽은 메시지를 읽음 처리
  let hasReadUpdates = false;
  messages.forEach(m => {
    if (m.senderId === friendId && m.receiverId === session.id && m.status !== "read") {
      m.status = "read";
      hasReadUpdates = true;
    }
  });

  if (hasReadUpdates) {
    writeDB(db);
  }

  const friendUser = db.users.find(u => u.id === friendId);
  const friendProfile = friendUser ? getOrCreatePublicProfile(friendUser, db) : null;
  const { isOnline, lastSeenAt } = isUserOnline(friendId, db);

  res.json({
    friend: {
      userId: friendId,
      botName: friendProfile?.botName || "소다봇",
      nickname: friendProfile?.nickname || friendUser?.displayName || "친구",
      description: friendProfile?.description || "",
      avatarUrl: friendProfile?.avatarUrl || "robot-blue",
      isOnline,
      lastSeenAt
    },
    messages
  });
});

// 12. Send Direct Message (1:1 메시지 전송)
app.post("/api/friends/messages/:friendId", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { friendId } = req.params;
  const { content } = req.body;

  if (!content || typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ error: "메시지 내용을 입력해주세요." });
  }

  if (content.trim().length > 500) return res.status(400).json({error:"메시지는 500자까지 보낼 수 있습니다."});

  const db = readDB();

  // 친구 관계 및 차단 여부 검증
  const friendship = (db.friendships || []).find(
    f => ((f.requesterId === session.id && f.receiverId === friendId) ||
          (f.requesterId === friendId && f.receiverId === session.id))
  );

  if (!friendship || friendship.status !== "accepted") {
    return res.status(403).json({ error: "친구로 등록된 사용자와만 메시지를 전송할 수 있습니다." });
  }

  if (!db.directMessages) db.directMessages = [];

  const newDm: DirectMessage = {
    id: "dm-" + Date.now() + "-" + crypto.randomBytes(3).toString("hex"),
    senderId: session.id,
    receiverId: friendId,
    content: content.trim().substring(0, 500),
    createdAt: new Date().toISOString(),
    status: "sent",
    playedOnSodabot: false
  };

  db.directMessages.push(newDm);
  writeDB(db);

  res.json({ success: true, message: newDm });
});

// 13. Mark Message Played on SODABOT
app.post("/api/friends/messages/:messageId/play-sodabot", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { messageId } = req.params;
  const db = readDB();

  const dm = (db.directMessages || []).find(m => m.id === messageId);
  if (!dm) return res.status(404).json({ error: "메시지를 찾을 수 없습니다." });

  // 수신자 또는 발신자 본인만 발화 허용
  if (dm.receiverId !== session.id && dm.senderId !== session.id) {
    return res.status(403).json({ error: "권한이 없습니다." });
  }

  if (req.body?.played === true) { dm.playedOnSodabot = true; writeDB(db); }

  const senderUser = db.users.find(u => u.id === dm.senderId);
  const senderProfile = senderUser ? getOrCreatePublicProfile(senderUser, db) : null;
  const senderName = senderProfile?.botName || senderUser?.displayName || "친구";

  res.json({
    success: true,
    speechText: `${senderName}의 메시지: ${dm.content}`
  });
});

// 14. Notifications Count (친구 요청 수 + 안읽은 1:1 DM 수 + 안읽은 그룹 메시지 수)
app.get("/api/friends/notifications/count", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const db = readDB();
  const currentUserId = session.id;

  const pendingRequestsCount = (db.friendships || []).filter(
    f => f.receiverId === currentUserId && f.status === "pending"
  ).length;

  const unreadDmCount = (db.directMessages || []).filter(
    m => m.receiverId === currentUserId && m.status !== "read"
  ).length;

  const unreadGroupCount = (db.groupChatRooms || [])
    .filter(r => (r.memberIds || []).includes(currentUserId))
    .reduce((total, room) => {
      const roomUnread = (db.groupChatMessages || []).filter(
        m => m.roomId === room.id && !(m.readBy || []).includes(currentUserId)
      ).length;
      return total + roomUnread;
    }, 0);

  const totalUnreadMessages = unreadDmCount + unreadGroupCount;

  res.json({
    pendingRequestsCount,
    unreadMessagesCount: totalUnreadMessages,
    unreadDmCount,
    unreadGroupCount,
    totalCount: pendingRequestsCount + totalUnreadMessages
  });
});

// 15. Group Chat - List User's Groups
app.get("/api/friends/groups", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const db = readDB();
  if (!db.groupChatRooms) db.groupChatRooms = [];
  if (!db.groupChatMessages) db.groupChatMessages = [];

  const currentUserId = session.id;
  const userRooms = db.groupChatRooms.filter(r => (r.memberIds || []).includes(currentUserId));

  const enrichedRooms = userRooms.map(room => {
    const latestMessage = db.groupChatMessages.filter(m => m.roomId === room.id).at(-1);
    const members = (room.memberIds || []).map(mId => {
      const u = db.users.find(user => user.id === mId);
      const p = u ? getOrCreatePublicProfile(u, db) : null;
      return {
        userId: mId,
        botName: p?.botName || u?.displayName || "소다봇",
        nickname: p?.nickname || u?.displayName || "친구",
        avatarUrl: p?.avatarUrl || "soda_smile",
        isOnline: Boolean(u && isUserOnline(mId, db).isOnline),
        role: room.creatorId === mId ? "creator" : "member"
      };
    });

    const unreadCount = db.groupChatMessages.filter(
      m => m.roomId === room.id && !(m.readBy || []).includes(currentUserId)
    ).length;

    return {
      ...room,
      lastMessage: latestMessage || room.lastMessage,
      members,
      unreadCount
    };
  });

  enrichedRooms.sort((a,b) => new Date(b.lastMessage?.createdAt || b.createdAt).getTime() - new Date(a.lastMessage?.createdAt || a.createdAt).getTime());
  res.json({ groups: enrichedRooms });
});

// 16. Group Chat - Create New Group Room
function validInvitedFriends(ids: unknown, userId: string, db: DBStructure): ids is string[] {
  return Array.isArray(ids) && ids.length <= 30 && ids.every(id => typeof id === "string" &&
    db.users.some(u => u.id === id) && (id === userId || (db.friendships || []).some(f => f.status === "accepted" &&
    ((f.requesterId === userId && f.receiverId === id) || (f.receiverId === userId && f.requesterId === id)))));
}

app.post("/api/friends/groups", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { name, memberIds } = req.body;
  if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "그룹 이름을 입력하세요." });

  if (name.trim().length > 40) return res.status(400).json({error:"그룹 이름은 40자까지 입력할 수 있습니다."});
  const db = readDB();
  if (!validInvitedFriends(memberIds || [], session.id, db)) return res.status(400).json({error:"등록된 친구만 초대할 수 있습니다."});
  if (!db.groupChatRooms) db.groupChatRooms = [];
  if (!db.groupChatMessages) db.groupChatMessages = [];

  const currentUserId = session.id;
  const allMemberIds = Array.from(new Set([currentUserId, ...(Array.isArray(memberIds) ? memberIds : [])]));

  const newRoomId = crypto.randomUUID();
  const currentUser = db.users.find(u => u.id === currentUserId);
  const currentProfile = currentUser ? getOrCreatePublicProfile(currentUser, db) : null;
  const creatorName = currentProfile?.botName || currentUser?.displayName || "소다봇";

  const newRoom = {
    id: newRoomId,
    name: name.trim().substring(0, 40),
    creatorId: currentUserId,
    memberIds: allMemberIds,
    createdAt: new Date().toISOString(),
    lastMessage: {
      id: crypto.randomUUID(),
      content: `${creatorName}님이 그룹 대화방을 생성했습니다.`,
      senderId: "system",
      senderName: "시스템",
      createdAt: new Date().toISOString()
    }
  };

  db.groupChatRooms.unshift(newRoom);

  // Add initial system message
  db.groupChatMessages.push({
    id: crypto.randomUUID(),
    roomId: newRoomId,
    senderId: "system",
    senderName: "시스템",
    senderAvatar: "soda_smile",
    content: `${creatorName}님이 그룹 대화방을 생성했습니다.`,
    createdAt: new Date().toISOString(),
    readBy: [currentUserId]
  });

  writeDB(db);

  res.json({ success: true, room: newRoom });
});

// 17. Group Chat - Get Messages & Mark as Read
app.get("/api/friends/groups/:roomId/messages", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { roomId } = req.params;
  const db = readDB();
  if (!db.groupChatRooms) db.groupChatRooms = [];
  if (!db.groupChatMessages) db.groupChatMessages = [];

  const room = db.groupChatRooms.find(r => r.id === roomId);
  if (!room) return res.status(404).json({ error: "그룹 대화방을 찾을 수 없습니다." });

  const currentUserId = session.id;
  if (!room.memberIds.includes(currentUserId)) {
    return res.status(403).json({ error: "이 그룹 대화방의 멤버가 아닙니다." });
  }

  // Mark all unread messages as read by current user
  let changed = false;
  db.groupChatMessages.forEach(m => {
    if (m.roomId === roomId && !(m.readBy || []).includes(currentUserId)) {
      if (!m.readBy) m.readBy = [];
      m.readBy.push(currentUserId);
      changed = true;
    }
  });

  if (changed) writeDB(db);

  const roomMessages = db.groupChatMessages
    .filter(m => m.roomId === roomId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const members = room.memberIds.map(mId => {
    const u = db.users.find(user => user.id === mId);
    const p = u ? getOrCreatePublicProfile(u, db) : null;
    return {
      userId: mId,
      botName: p?.botName || u?.displayName || "소다봇",
      nickname: p?.nickname || u?.displayName || "친구",
      avatarUrl: p?.avatarUrl || "soda_smile",
      isOnline: Boolean(u && isUserOnline(mId, db).isOnline),
      role: room.creatorId === mId ? "creator" : "member"
    };
  });

  res.json({
    room,
    members,
    messages: roomMessages
  });
});

// 18. Group Chat - Send Message
app.post("/api/friends/groups/:roomId/messages", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { roomId } = req.params;
  const { content } = req.body;
  if (typeof content !== "string" || !content.trim()) return res.status(400).json({ error: "메시지 내용을 입력하세요." });

  if (content.trim().length > 500) return res.status(400).json({error:"메시지는 500자까지 보낼 수 있습니다."});

  const db = readDB();
  if (!db.groupChatRooms) db.groupChatRooms = [];
  if (!db.groupChatMessages) db.groupChatMessages = [];

  const room = db.groupChatRooms.find(r => r.id === roomId);
  if (!room) return res.status(404).json({ error: "그룹 대화방을 찾을 수 없습니다." });

  const currentUserId = session.id;
  if (!room.memberIds.includes(currentUserId)) {
    return res.status(403).json({ error: "이 그룹 대화방의 멤버가 아닙니다." });
  }

  const currentUser = db.users.find(u => u.id === currentUserId);
  const currentProfile = currentUser ? getOrCreatePublicProfile(currentUser, db) : null;
  const senderName = currentProfile?.botName || currentUser?.displayName || "소다봇";
  const senderAvatar = currentProfile?.avatarUrl || "soda_smile";

  const newMsg = {
    id: crypto.randomUUID(),
    roomId,
    senderId: currentUserId,
    senderName,
    senderAvatar,
    content: content.trim().substring(0, 500),
    createdAt: new Date().toISOString(),
    readBy: [currentUserId],
    playedOnSodabot: false
  };

  db.groupChatMessages.push(newMsg);
  room.lastMessage = {
    id: newMsg.id,
    content: newMsg.content,
    senderId: currentUserId,
    senderName,
    createdAt: newMsg.createdAt
  };

  writeDB(db);

  res.json({ success: true, message: newMsg });
});

// 19. Group Chat - Invite Members
app.post("/api/friends/groups/:roomId/invite", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { roomId } = req.params;
  const { memberIds } = req.body;
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: "초대할 친구를 선택하세요." });
  }

  const db = readDB();
  if (!validInvitedFriends(memberIds, session.id, db)) return res.status(400).json({error:"등록된 친구만 초대할 수 있습니다."});
  const room = (db.groupChatRooms || []).find(r => r.id === roomId);
  if (!room) return res.status(404).json({ error: "그룹 대화방을 찾을 수 없습니다." });

  const currentUserId = session.id;
  if (!room.memberIds.includes(currentUserId)) {
    return res.status(403).json({ error: "권한이 없습니다." });
  }

  const newMembersToAdd = [...new Set(memberIds)].filter(id => !room.memberIds.includes(id));
  if (newMembersToAdd.length === 0) {
    return res.json({ success: true, room });
  }

  room.memberIds.push(...newMembersToAdd);

  const currentUser = db.users.find(u => u.id === currentUserId);
  const currentProfile = currentUser ? getOrCreatePublicProfile(currentUser, db) : null;
  const inviterName = currentProfile?.botName || currentUser?.displayName || "소다봇";

  db.groupChatMessages.push({
    id: crypto.randomUUID(),
    roomId,
    senderId: "system",
    senderName: "시스템",
    senderAvatar: "soda_smile",
    content: `${inviterName}님이 새 친구를 초대했습니다.`,
    createdAt: new Date().toISOString(),
    readBy: [currentUserId]
  });

  writeDB(db);

  res.json({ success: true, room });
});

// 20. Group Chat - Leave Room
app.post("/api/friends/groups/:roomId/leave", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { roomId } = req.params;
  const db = readDB();
  const room = (db.groupChatRooms || []).find(r => r.id === roomId);
  if (!room) return res.status(404).json({ error: "그룹 대화방을 찾을 수 없습니다." });

  const currentUserId = session.id;
  if (!room.memberIds.includes(currentUserId)) return res.status(403).json({error:"이 그룹의 멤버가 아닙니다."});
  room.memberIds = room.memberIds.filter(id => id !== currentUserId);

  const currentUser = db.users.find(u => u.id === currentUserId);
  const currentProfile = currentUser ? getOrCreatePublicProfile(currentUser, db) : null;
  const leaverName = currentProfile?.botName || currentUser?.displayName || "소다봇";

  if (room.memberIds.length === 0) {
    db.groupChatRooms = db.groupChatRooms.filter(r => r.id !== roomId);
    db.groupChatMessages = (db.groupChatMessages || []).filter(m => m.roomId !== roomId);
  } else {
    if (room.creatorId === currentUserId) {
      room.creatorId = room.memberIds[0];
    }
    db.groupChatMessages.push({
      id: crypto.randomUUID(),
      roomId,
      senderId: "system",
      senderName: "시스템",
      senderAvatar: "soda_smile",
      content: `${leaverName}님이 방을 나갔습니다.`,
      createdAt: new Date().toISOString(),
      readBy: []
    });
  }

  writeDB(db);

  res.json({ success: true });
});

// 21. Group Chat - Play On Sodabot
app.post("/api/friends/groups/messages/:messageId/play-sodabot", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "인증 필요" });
  const token = authHeader.replace("Bearer ", "");
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "세션 만료" });

  const { messageId } = req.params;
  const db = readDB();

  const msg = (db.groupChatMessages || []).find(m => m.id === messageId);
  if (!msg) return res.status(404).json({ error: "메시지를 찾을 수 없습니다." });

  const room = (db.groupChatRooms || []).find(r => r.id === msg.roomId);
  if (!room?.memberIds.includes(session.id)) return res.status(403).json({error:"이 그룹의 멤버가 아닙니다."});
  if (req.body?.played === true) { msg.playedOnSodabot = true; writeDB(db); }

  res.json({
    success: true,
    speechText: `${msg.senderName}의 메시지: ${msg.content}`
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
