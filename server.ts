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
  contentType?: "code" | "circuit" | "doc";
  imageUrl?: string;
  updatedAt?: string;
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
    title: "스피커테스트 도레미파솔라시도",
    description: "I2S 디지털 앰프/스피커 핀(BCLK:5, LRC:3, DOUT:44)을 초기화하고 도레미파솔라시도 음계를 재생하는 소다봇 사운드 기초 실습입니다.",
    filename: "soda-2-1.ino",
    language: "arduino",
    tags: ["I2S", "스피커", "사운드", "ESP32", "도레미파솔라시도"],
    pinMap: "BCLK: D5, LRC: D3, DOUT: D44",
    updatedAt: new Date().toISOString(),
    code: `#include <driver/i2s.h>
#include <math.h>

// ========================
// 스피커 핀 설정
// ========================
#define I2S_BCLK  5
#define I2S_LRC   3
#define I2S_DOUT  44

#define I2S_PORT I2S_NUM_0
#define SAMPLE_RATE 44100


// ========================
// 소리 내기 함수
// 수정하지 마세요
// ========================
void playTone(float freq, int duration) {

  int samples = SAMPLE_RATE * duration / 1000;
  int16_t buffer[2];

  for (int i = 0; i < samples; i++) {

    int16_t sound =
      sin(2 * PI * freq * i / SAMPLE_RATE) * 6000;

    buffer[0] = sound;
    buffer[1] = sound;

    size_t written;

    i2s_write(
      I2S_PORT,
      buffer,
      sizeof(buffer),
      &written,
      portMAX_DELAY
    );
  }

  i2s_zero_dma_buffer(I2S_PORT);
}


// ========================
// 처음 한 번 실행
// ========================
void setup() {

  // I2S 설정
  i2s_config_t i2s_config = {

    .mode = (i2s_mode_t)(
      I2S_MODE_MASTER |
      I2S_MODE_TX
    ),

    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,

    .channel_format =
      I2S_CHANNEL_FMT_RIGHT_LEFT,

    .communication_format =
      I2S_COMM_FORMAT_STAND_I2S,

    .intr_alloc_flags = 0,
    .dma_buf_count = 8,
    .dma_buf_len = 256,
    .use_apll = false,
    .tx_desc_auto_clear = true,
    .fixed_mclk = 0
  };


  // 핀 연결
  i2s_pin_config_t pin_config = {

    .bck_io_num = I2S_BCLK,
    .ws_io_num = I2S_LRC,
    .data_out_num = I2S_DOUT,
    .data_in_num = I2S_PIN_NO_CHANGE
  };


  i2s_driver_install(
    I2S_PORT,
    &i2s_config,
    0,
    NULL
  );

  i2s_set_pin(
    I2S_PORT,
    &pin_config
  );


  // ==================================
  // 🎵 학생 실습 : 여기만 수정하세요!
  // ==================================

  playTone(262, 200);   // 도
  playTone(294, 200);   // 레
  playTone(330, 200);   // 미
  playTone(349, 200);   // 파
  playTone(392, 200);   // 솔
  playTone(440, 200);   // 라
  playTone(494, 200);   // 시
  playTone(523, 500);   // 높은 도

  // ==================================
}


// 반복 실행 없음
void loop() {

}
`
  },
  {
    id: "content-week-1-btn-led-sound",
    week: 1,
    title: "버튼 + LED + 스피커",
    description: "버튼(D4)을 누르면 LED(D2)가 켜지며 MAX98357A I2S 앰프 스피커를 통해 도-미-솔 화음 사운드를 출력하는 인터랙션 예제입니다.",
    filename: "soda-2-2.ino",
    language: "arduino",
    tags: ["버튼", "LED", "I2S", "스피커", "ESP32", "사운드"],
    pinMap: "LED: D2, 버튼: D4, 스피커: BCLK: D5, LRC: D3, DOUT: D44",
    updatedAt: new Date().toISOString(),
    code: `#include <driver/i2s.h>
#include <math.h>

// ========================
// 핀 설정
// ========================

// LED / 버튼
#define LED_PIN     2
#define BUTTON_PIN  4

// MAX98357A 앰프
#define I2S_BCLK    5
#define I2S_LRC     3
#define I2S_DOUT    44      // ESP32-S3 SuperMini RX 핀

#define I2S_PORT    I2S_NUM_0
#define SAMPLE_RATE 44100


// ========================
// I2S 설정
// ========================

void setup() {

  Serial.begin(115200);

  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  digitalWrite(LED_PIN, LOW);


  i2s_config_t i2s_config = {

    .mode = (i2s_mode_t)(
      I2S_MODE_MASTER |
      I2S_MODE_TX
    ),

    .sample_rate = SAMPLE_RATE,

    .bits_per_sample =
      I2S_BITS_PER_SAMPLE_16BIT,

    .channel_format =
      I2S_CHANNEL_FMT_RIGHT_LEFT,

    .communication_format =
      I2S_COMM_FORMAT_STAND_I2S,

    .intr_alloc_flags = 0,

    .dma_buf_count = 8,
    .dma_buf_len = 256,

    .use_apll = false,
    .tx_desc_auto_clear = true,
    .fixed_mclk = 0
  };


  i2s_pin_config_t pin_config = {

    .bck_io_num = I2S_BCLK,

    .ws_io_num = I2S_LRC,

    .data_out_num = I2S_DOUT,

    .data_in_num =
      I2S_PIN_NO_CHANGE
  };


  i2s_driver_install(
    I2S_PORT,
    &i2s_config,
    0,
    NULL
  );


  i2s_set_pin(
    I2S_PORT,
    &pin_config
  );
}


// ========================
// 메인
// ========================

void loop() {

  if (digitalRead(BUTTON_PIN) == LOW) {

    digitalWrite(LED_PIN, HIGH);

    // 도
    playTone(523.25, 180);

    delay(40);

    // 미
    playTone(659.25, 180);

    delay(40);

    // 솔
    playTone(783.99, 300);


    // 버튼을 놓을 때까지 기다림
    while (digitalRead(BUTTON_PIN) == LOW) {
      delay(10);
    }

    digitalWrite(LED_PIN, LOW);

    delay(50);
  }
}


// ========================
// 사인파 소리 출력
// ========================

void playTone(float frequency, int duration_ms) {

  const int BUFFER_FRAMES = 256;

  int16_t buffer[BUFFER_FRAMES * 2];

  float phase = 0;

  float phaseStep =
    2.0 * PI * frequency / SAMPLE_RATE;


  int totalSamples =
    SAMPLE_RATE * duration_ms / 1000;

  int generated = 0;


  while (generated < totalSamples) {

    int count =
      min(BUFFER_FRAMES,
          totalSamples - generated);


    for (int i = 0; i < count; i++) {

      // 볼륨
      int16_t sample =
        (int16_t)(sin(phase) * 6000);

      phase += phaseStep;

      if (phase >= 2.0 * PI) {
        phase -= 2.0 * PI;
      }


      // 좌/우 동일 신호
      buffer[i * 2]     = sample;
      buffer[i * 2 + 1] = sample;
    }


    size_t bytesWritten;

    i2s_write(
      I2S_PORT,
      buffer,
      count * 2 * sizeof(int16_t),
      &bytesWritten,
      portMAX_DELAY
    );


    generated += count;
  }


  // 소리 끄기
  i2s_zero_dma_buffer(I2S_PORT);
}
`
  },
  {
    id: "content-week-1-hw",
    week: 1,
    title: "소다봇 기본 하드웨어 및 LED/서보모터 제어",
    description: "ESP32 보드에서 RGB LED와 서보모터를 초기화하고 표정 및 각도를 제어하는 1주차 기본 펌웨어입니다.",
    filename: "sodabot_week1_hw_basic.ino",
    language: "arduino",
    tags: ["ESP32", "Arduino", "LED", "서보모터"],
    pinMap: "RGB LED: D4, 서보모터: D18, 스피커: D5/D3/D44",
    updatedAt: new Date().toISOString(),
    code: `// [1주차] 소다봇 하드웨어 기본 제어 예제
#include <ESP32Servo.h>

#define PIN_LED_R 4
#define PIN_LED_G 16
#define PIN_LED_B 17
#define PIN_SERVO 18

Servo neckServo;

void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED_R, OUTPUT);
  pinMode(PIN_LED_G, OUTPUT);
  pinMode(PIN_LED_B, OUTPUT);

  neckServo.attach(PIN_SERVO);
  neckServo.write(90); // 기본 90도 중앙 위치

  Serial.println("🤖 [소다봇 1주차] 하드웨어 초기화 완료!");
  setLedColor(0, 255, 100); // 에메랄드 그린
}

void loop() {
  // 고개 끄덕이기 동작
  neckServo.write(70);
  delay(500);
  neckServo.write(110);
  delay(500);
  neckServo.write(90);
  delay(1000);
}

void setLedColor(int r, int g, int b) {
  analogWrite(PIN_LED_R, r);
  analogWrite(PIN_LED_G, g);
  analogWrite(PIN_LED_B, b);
}`
  },
  {
    id: "content-week-3",
    week: 3,
    title: "소다봇 음성 인식(STT) 및 파이썬 오디오 클라이언트",
    description: "마이크 입력을 받아 서버의 Whisper STT 엔드포인트로 전송하고 결과를 수신하는 파이썬 스크립트입니다.",
    filename: "sodabot_week3_audio_client.py",
    language: "python",
    tags: ["Python", "STT", "Whisper", "마이크"],
    pinMap: "USB 마이크 또는 PC 내장 마이크 사용",
    updatedAt: new Date().toISOString(),
    code: `# [3주차] 파이썬 마이크 음성 녹음 및 STT 전송 클라이언트
import sounddevice as sd
import numpy as np
import scipy.io.wavfile as wav
import requests
import io

SERVER_URL = "http://localhost:7989/api/hw/audio-chat"
SAMPLE_RATE = 16000
DURATION = 4  # 녹음 초

def record_and_send():
    print(f"🎙️ {DURATION}초 동안 말씀하세요...")
    audio_data = sd.rec(int(DURATION * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=1, dtype='int16')
    sd.wait()
    print("✅ 녹음 완료! 서버로 전송 중...")

    wav_io = io.BytesIO()
    wav.write(wav_io, SAMPLE_RATE, audio_data)
    wav_io.seek(0)

    files = {'file': ('voice.wav', wav_io, 'audio/wav')}
    headers = {'Authorization': 'Bearer YOUR_SESSION_TOKEN'}

    try:
        response = requests.post(SERVER_URL, files=files, headers=headers)
        if response.status_code == 200:
            result = response.json()
            print("📝 인식된 텍스트:", result.get("transcript"))
            print("🤖 소다봇 답변:", result.get("reply"))
        else:
            print("❌ 오류 발생:", response.text)
    except Exception as e:
        print("연결 실패:", e)

if __name__ == "__main__":
    record_and_send()`
  },
  {
    id: "content-week-4",
    week: 4,
    title: "소다봇 AI LLM REST API 연동 스크립트",
    description: "LM Studio 로컬 LLM 또는 소다봇 대화 API를 호출하여 프롬프트와 페르소나를 전송하는 예제입니다.",
    filename: "sodabot_week4_llm_test.py",
    language: "python",
    tags: ["LLM", "API", "REST", "LM Studio"],
    updatedAt: new Date().toISOString(),
    code: `# [4주차] 소다봇 LLM 대화 API 호출 예제
import requests
import json

API_URL = "http://localhost:7989/api/v1/chat/completions"

headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_SESSION_TOKEN"
}

payload = {
    "model": "llama-3-korean-bllossom-8b",
    "messages": [
        {"role": "system", "content": "너는 디랩 코딩학원의 반려봇 소다봇이야. 친근하게 힌트를 줘."},
        {"role": "user", "content": "파이썬에서 리스트 뒤집는 법 알려줘!"}
    ],
    "temperature": 0.7,
    "max_tokens": 256
}

response = requests.post(API_URL, headers=headers, json=payload)
if response.status_code == 200:
    data = response.json()
    reply = data['choices'][0]['message']['content']
    print("🤖 소다봇의 응답:\\n", reply)
else:
    print("API 에러:", response.status_code, response.text)`
  },
  {
    id: "content-week-5",
    week: 5,
    title: "소다봇 감정 표현 & 모션 시퀀서 코드",
    description: "행복, 슬픔, 당황 등 감정에 따라 서보모터와 LED가 싱크되어 반응하는 동작 시퀀서 아두이노 코드입니다.",
    filename: "sodabot_week5_motion_sequencer.ino",
    language: "arduino",
    tags: ["Motion", "서보모터", "감정표현", "C++"],
    updatedAt: new Date().toISOString(),
    code: `// [5주차] 소다봇 감정 모션 시퀀서
#include <ESP32Servo.h>

Servo neckServo;
#define PIN_SERVO 18

void playEmotion(String emotion) {
  if (emotion == "HAPPY") {
    // 기쁨: 빠르게 좌우 흔들기
    for(int i=0; i<3; i++) {
      neckServo.write(75); delay(150);
      neckServo.write(105); delay(150);
    }
    neckServo.write(90);
  } else if (emotion == "NOD") {
    // 끄덕끄덕: 상하 끄덕임
    neckServo.write(60); delay(250);
    neckServo.write(100); delay(250);
    neckServo.write(90);
  } else if (emotion == "SURPRISED") {
    // 깜짝 놀람: 회전
    neckServo.write(120); delay(400);
    neckServo.write(90);
  }
}`
  },
  {
    id: "content-week-6",
    week: 6,
    title: "6주차 종합: AI 소다봇 완성본 통합 펌웨어 (Full Package)",
    description: "BLE 무선 통신, 웹소켓, LED 감정 표현, 서보모터 반응형 액션이 모두 통합된 소다봇 최종 펌웨어입니다.",
    filename: "sodabot_week6_final_firmware.ino",
    language: "arduino",
    tags: ["최종본", "Full Package", "BLE", "ESP32", "Arduino"],
    updatedAt: new Date().toISOString(),
    code: `// [6주차] 소다봇 최종 통합 펌웨어 (BLE + 모션 + LED + 사운드)
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ESP32Servo.h>

#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

Servo neckServo;
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;

void setup() {
  Serial.begin(115200);
  neckServo.attach(18);
  neckServo.write(90);

  BLEDevice::init("Sodabot-Robot");
  BLEServer *pServer = BLEDevice::createServer();
  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE
  );
  pService->start();
  BLEDevice::getAdvertising()->start();

  Serial.println("✨ 소다봇 6주차 통합 펌웨어 준비 완료!");
}

void loop() {
  delay(20);
}`
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
  if (!db.courseContents || !Array.isArray(db.courseContents)) {
    db.courseContents = DEFAULT_COURSE_CONTENTS;
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
}

const sessions = new Map<string, SessionUser>();

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
        writeDB(db);
      }

      const sessionUser: SessionUser = {
        id: adminUser.id,
        username: adminUser.username,
        displayName: adminUser.displayName,
        role: "admin",
        canAccessChat: true
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

    const isUserAdmin = user.username === "admin" || user.role === "admin";
    const sessionUser: SessionUser = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: isUserAdmin ? "admin" : (user.role || "student"),
      canAccessChat: isUserAdmin ? true : (user.canAccessChat ?? false)
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
    const sessionUser: SessionUser = {
      id: "admin-aiden",
      username: "aiden",
      displayName: "Aiden (Master Admin)",
      role: "admin",
      canAccessChat: true
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
      writeDB(db);
    } else {
      localUser.displayName = student.name;
    }

    const sessionUser: SessionUser = {
      id: localUser.id,
      username: localUser.username,
      displayName: localUser.displayName,
      role: "student",
      canAccessChat: localUser.canAccessChat ?? false
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
      const sessionUser: SessionUser = {
        id: fallbackUser.id,
        username: fallbackUser.username,
        displayName: fallbackUser.displayName,
        role: fallbackUser.role || "student",
        canAccessChat: fallbackUser.canAccessChat ?? false
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

  db.users.push(newUser);
  writeDB(db);

  const sessionId = Math.random().toString(36).substring(2, 15);
  const sessionUser: SessionUser = {
    id: newUser.id,
    username: newUser.username,
    displayName: newUser.displayName,
    role: "student",
    canAccessChat: false
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
  const session = sessions.get(token);
  if (!session) {
    return res.status(401).json({ error: "세션이 만료되었습니다." });
  }

  // DB 최신 권한 상태와 실시간 동기화
  const db = readDB();
  const dbUser = db.users.find(u => u.id === session.id);
  if (dbUser) {
    const isUserAdmin = dbUser.username === "admin" || dbUser.role === "admin";
    session.displayName = dbUser.displayName;
    session.role = isUserAdmin ? "admin" : (dbUser.role || "student");
    session.canAccessChat = isUserAdmin ? true : (dbUser.canAccessChat ?? false);
  }

  res.json({ user: session });
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
  const contents = (db.courseContents || DEFAULT_COURSE_CONTENTS).slice().sort((a, b) => a.week - b.week);
  res.json({ contents });
});

app.post("/api/admin/course-contents", requireAdmin, (req, res) => {
  const { week, title, description, filename, language, tags, pinMap, code } = req.body;
  if (!title || !code) {
    return res.status(400).json({ error: "제목과 코드는 필수 입력 항목입니다." });
  }

  const db = readDB();
  if (!db.courseContents) db.courseContents = DEFAULT_COURSE_CONTENTS;

  const newContent: CourseContent = {
    id: "content-" + Date.now(),
    week: Number(week) || 1,
    title: title.trim(),
    description: (description || "").trim(),
    filename: (filename || `sodabot_week${week || 1}_code.ino`).trim(),
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
  if (code !== undefined) content.code = code;
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
