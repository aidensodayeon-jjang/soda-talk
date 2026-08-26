import React, { useState, useEffect } from "react";
import {
  Code,
  Download,
  Copy,
  Check,
  FileCode,
  FolderArchive,
  Terminal,
  Cpu,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Search,
  BookOpen,
  Info,
  CheckCircle2,
  RotateCcw,
  Zap,
  ArrowRight,
  Image as ImageIcon
} from "lucide-react";

interface CodeItem {
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
}

interface DevCodeHubProps {
  className?: string;
  selectedCodeId?: string;
  onSelectCode?: (id: string) => void;
}

const SAMPLE_CODES: CodeItem[] = [
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
    id: "week1-led-servo",
    week: 1,
    title: "소다봇 기본 하드웨어 및 LED/서보모터 제어",
    description: "ESP32 보드에서 RGB LED와 서보모터를 초기화하고 표정 및 각도를 제어하는 1주차 기본 펌웨어입니다.",
    filename: "sodabot_week1_hw_basic.ino",
    language: "arduino",
    tags: ["ESP32", "Arduino", "LED", "서보모터"],
    pinMap: "RGB LED: D4, 서보모터: D18, 스피커: D5/D3/D44",
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
}
`
  },
  {
    id: "week3-stt-audio",
    week: 3,
    title: "소다봇 음성 인식(STT) 및 파이썬 오디오 클라이언트",
    description: "마이크 입력을 받아 서버의 Whisper STT 엔드포인트로 전송하고 결과를 수신하는 파이썬 스크립트입니다.",
    filename: "sodabot_week3_audio_client.py",
    language: "python",
    tags: ["Python", "STT", "Whisper", "마이크"],
    pinMap: "USB 마이크 또는 PC 내장 마이크 사용",
    code: `# [3주차] 파이썬 마이크 음성 녹음 및 STT 전송 클라이언트
import sounddevice as sd
import numpy as np
import scipy.io.wavfile as wav
import requests
import io

SERVER_URL = "http://localhost:3000/api/hw/audio-chat"
SAMPLE_RATE = 16000
DURATION = 4  # 녹음 초

def record_and_send():
    print(f"🎙️ {DURATION}초 동안 말씀하세요...")
    audio_data = sd.rec(int(DURATION * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=1, dtype='int16')
    sd.wait()
    print("✅ 녹음 완료! 서버로 전송 중...")

    # WAV 버퍼 생성
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
    record_and_send()
`
  },
  {
    id: "week4-llm-api",
    week: 4,
    title: "소다봇 AI LLM REST API 연동 스크립트",
    description: "LM Studio 로컬 LLM 또는 소다봇 대화 API를 호출하여 프롬프트와 페르소나를 전송하는 예제입니다.",
    filename: "sodabot_week4_llm_test.py",
    language: "python",
    tags: ["LLM", "API", "REST", "LM Studio"],
    code: `# [4주차] 소다봇 LLM 대화 API 호출 예제
import requests
import json

API_URL = "http://localhost:3000/api/v1/chat/completions"

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
    print("🤖 소다봇의 응답:\n", reply)
else:
    print("API 에러:", response.status_code, response.text)
`
  },
  {
    id: "week5-motion-sequence",
    week: 5,
    title: "소다봇 감정 표현 & 모션 시퀀서 코드",
    description: "행복, 슬픔, 당황 등 감정에 따라 서보모터와 LED가 싱크되어 반응하는 동작 시퀀서 아두이노 코드입니다.",
    filename: "sodabot_week5_motion_sequencer.ino",
    language: "arduino",
    tags: ["Motion", "서보모터", "감정표현", "C++"],
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
    // 깜짝 놀람: 위로 솟구치듯 회전
    neckServo.write(120); delay(400);
    neckServo.write(90);
  }
}
`
  },
  {
    id: "week6-full-package",
    week: 6,
    title: "6주차 종합: AI 소다봇 완성본 통합 펌웨어 (Full Package)",
    description: "BLE 무선 통신, 웹소켓, LED 감정 표현, 서보모터 반응형 액션이 모두 통합된 소다봇 최종 펌웨어입니다.",
    filename: "sodabot_week6_final_firmware.ino",
    language: "arduino",
    tags: ["최종본", "Full Package", "BLE", "ESP32", "Arduino"],
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
  // BLE 명령 대기 및 백그라운드 태스크 처리
  delay(20);
}
`
  }
];

export default function DevCodeHubScreen({ className, selectedCodeId, onSelectCode }: DevCodeHubProps) {
  const [codes, setCodes] = useState<CodeItem[]>(SAMPLE_CODES);
  const [loading, setLoading] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | "all">(1);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCodeId, setActiveCodeId] = useState<string>(selectedCodeId || SAMPLE_CODES[0]?.id || "content-week-1-sound");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync external selectedCodeId
  useEffect(() => {
    if (selectedCodeId) {
      setActiveCodeId(selectedCodeId);
      const found = codes.find(c => c.id === selectedCodeId);
      if (found) {
        setSelectedWeek(found.week);
      }
    }
  }, [selectedCodeId, codes]);

  const fetchCourseContents = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/course-contents");
      const data = await res.json();
      if (res.ok && data.contents && data.contents.length > 0) {
        setCodes(data.contents);
        if (!data.contents.some((c: CodeItem) => c.id === activeCodeId)) {
          setActiveCodeId(data.contents[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load course contents", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourseContents();
  }, []);

  // 동적 주차 목록 추출
  const availableWeeks = Array.from(new Set(codes.map(c => Number(c.week)))).sort((a: number, b: number) => a - b);

  const filteredCodes = codes.filter(item => {
    if (selectedWeek !== "all" && item.week !== selectedWeek) return false;
    if (selectedLanguage !== "all" && item.language !== selectedLanguage) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchFile = item.filename?.toLowerCase().includes(q);
      const matchTags = item.tags?.some(t => t.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchFile && !matchTags) return false;
    }
    return true;
  });

  const activeItem = codes.find(c => c.id === activeCodeId) || filteredCodes[0] || codes[0];

  const handleCopy = async (id: string, code: string) => {
    let copied = false;
    // 1. Modern Clipboard API
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(code);
        copied = true;
      } catch (err) {
        console.warn("Clipboard API failed, trying fallback textarea", err);
      }
    }

    // 2. Fallback using temporary textarea
    if (!copied) {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = code;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        copied = true;
      } catch (e) {
        console.error("Clipboard copy failed completely", e);
      }
    }

    if (copied) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const handleDownload = (item: CodeItem) => {
    const blob = new Blob([item.code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = item.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    filteredCodes.forEach((item, index) => {
      setTimeout(() => {
        handleDownload(item);
      }, index * 200);
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF9F6] overflow-hidden">
      {/* Top Header */}
      <div className="bg-white border-b border-[#EAE6DF] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold rounded-full uppercase tracking-wider font-mono">
              Firmware & Studio Hub
            </span>
            <span className="text-xs font-semibold text-[#86868B]">디랩 소다봇 스튜디오</span>
          </div>
          <h1 className="text-xl font-extrabold text-[#1D1D1F] tracking-tight flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-600" />
            소다봇 제작 & 주차별 펌웨어 개발실
          </h1>
          <p className="text-xs text-[#5C5B57]">
            1주차 기초 하드웨어부터 6주차 AI 연동까지, 소다봇 제작에 필요한 핵심 펌웨어와 소스코드를 학습하고 다운로드하세요.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={fetchCourseContents}
            className="p-2 bg-white hover:bg-gray-100 border border-[#EAE6DF] rounded-xl text-[#5C5B57] text-xs font-semibold transition-all cursor-pointer shadow-2xs"
            title="자료실 새로고침"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleDownloadAll}
            className="px-3.5 py-2 bg-[#1D1D1F] hover:bg-black active:scale-98 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <FolderArchive className="w-4 h-4" />
            일괄 다운로드 ({filteredCodes.length}개)
          </button>
        </div>
      </div>

      {/* Main Content Area: Full Width Code Viewer */}
      <div className="flex-1 flex flex-col h-full bg-[#1E1E2E] overflow-hidden">
          {/* Viewer Toolbar */}
          <div className="bg-[#181825] px-6 py-3.5 border-b border-[#313244] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#f38ba8]/80"></div>
                <div className="w-3 h-3 rounded-full bg-[#f9e2af]/80"></div>
                <div className="w-3 h-3 rounded-full bg-[#a6e3a1]/80"></div>
              </div>
              <div className="h-4 w-px bg-[#313244]" />
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-[#89b4fa]" />
                <span className="font-mono text-xs font-bold text-[#cdd6f4]">
                  {activeItem.filename}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-[#313244] text-[#a6adc8] rounded-md">
                  {activeItem.week === 1 ? "1-2주차 실습" : `${activeItem.week}주차 실습`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Secondary Download Button (Reduced size & subtle style) */}
              <button
                id="download-code-btn-compact"
                onClick={() => {
                  if (activeItem.imageUrl) {
                    const link = document.createElement("a");
                    link.href = activeItem.imageUrl;
                    link.download = activeItem.filename || "circuit_diagram.png";
                    link.target = "_blank";
                    link.click();
                  } else {
                    handleDownload(activeItem);
                  }
                }}
                className="px-3.5 py-2 bg-[#313244]/80 hover:bg-[#45475a] active:scale-98 text-[#a6adc8] hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-[#45475a]/70 shadow-xs"
                title="파일로 다운로드 저장"
              >
                <Download className="w-3.5 h-3.5 text-[#89b4fa]" />
                <span>{activeItem.contentType === "circuit" ? "이미지 저장" : "파일 저장"}</span>
              </button>

              {/* Primary Highlighted Copy Button (Prominent & High-Impact) */}
              <button
                id="copy-code-btn-prominent"
                onClick={() => handleCopy(activeItem.id, activeItem.code)}
                className={`px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-md ${
                  copiedId === activeItem.id
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400 shadow-emerald-900/40"
                    : "bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-indigo-500/25 ring-1 ring-white/20 hover:shadow-indigo-500/40"
                }`}
                title={activeItem.contentType === "circuit" ? "핀맵 및 연결 설명 클립보드에 복사" : "아두이노 IDE에 바로 붙여넣을 수 있도록 전체 코드 복사"}
              >
                {copiedId === activeItem.id ? (
                  <>
                    <Check className="w-4 h-4 text-white animate-scale-in" />
                    <span>복사 완료! (아두이노에 붙여넣기)</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-white" />
                    <span>{activeItem.contentType === "circuit" ? "📋 핀맵 전체 복사하기" : "📋 코드 전체 복사하기"}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Description & Pin Map Info Bar (Dark Subheader) */}
          <div className="bg-[#1e1e2e]/95 px-6 py-2.5 border-b border-[#313244] text-xs text-[#a6adc8] flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-[#89b4fa]" />
              <span>{activeItem.description}</span>
            </div>
            {activeItem.pinMap && (
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#f9e2af] bg-[#313244]/60 px-2.5 py-1 rounded-lg border border-[#f9e2af]/20">
                <Cpu className="w-3.5 h-3.5 text-[#f9e2af]" />
                <span className="font-bold">핀 연결: {activeItem.pinMap}</span>
              </div>
            )}
          </div>

          {/* Content Body: Circuit Diagram Image View OR Code View */}
          {activeItem.contentType === "circuit" ? (
            <div className="flex-1 overflow-auto p-6 space-y-6 bg-[#181825] scrollbar-thin">
              {/* Circuit Image Card with Zoom/Click */}
              <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xl border border-[#313244] max-w-5xl mx-auto space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <h2 className="text-base sm:text-lg font-black text-[#1D1D1F]">
                      {activeItem.title}
                    </h2>
                  </div>
                  {activeItem.imageUrl && (
                    <a
                      href={activeItem.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      원본 크게보기
                    </a>
                  )}
                </div>

                {/* High Resolution Circuit Diagram Image */}
                <div className="relative group overflow-hidden rounded-xl bg-gray-50 flex items-center justify-center border border-gray-200">
                  <img
                    src={activeItem.imageUrl || "/images/circuit_btn_led_speaker.png"}
                    alt="버튼 + LED + 스피커 배선도"
                    className="w-full max-h-[580px] object-contain rounded-xl transition-transform duration-300 group-hover:scale-[1.01]"
                  />
                </div>
              </div>

              {/* Pin Connection Table & Operational Guide */}
              <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Connection Table Card */}
                <div className="bg-[#1e1e2e] p-5 rounded-2xl border border-[#313244] space-y-3">
                  <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-wider font-mono">
                    <Cpu className="w-4 h-4 text-indigo-400" />
                    <span>ESP32-S3 핀 연결 요약표</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-[#313244] text-[#a6adc8]">
                          <th className="pb-2 font-bold">기능</th>
                          <th className="pb-2 font-bold">ESP32-S3 핀</th>
                          <th className="pb-2 font-bold">연결 대상</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#313244]/60 text-[#cdd6f4]">
                        <tr>
                          <td className="py-2 text-[#89b4fa] font-bold">버튼 입력</td>
                          <td className="py-2 text-amber-300 font-bold">GPIO4</td>
                          <td className="py-2 text-[#a6adc8]">버튼 한쪽 ➔ GND (INPUT_PULLUP)</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-[#89b4fa] font-bold">LED 출력</td>
                          <td className="py-2 text-amber-300 font-bold">GPIO2</td>
                          <td className="py-2 text-[#a6adc8]">220Ω 저항 ➔ LED(+), LED(-) ➔ GND</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-emerald-400 font-bold">I2S BCLK</td>
                          <td className="py-2 text-amber-300 font-bold">GPIO5</td>
                          <td className="py-2 text-[#a6adc8]">MAX98357A BCLK</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-emerald-400 font-bold">I2S LRCK</td>
                          <td className="py-2 text-amber-300 font-bold">GPIO3</td>
                          <td className="py-2 text-[#a6adc8]">MAX98357A LRC</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-emerald-400 font-bold">I2S DOUT</td>
                          <td className="py-2 text-amber-300 font-bold">GPIO44</td>
                          <td className="py-2 text-[#a6adc8]">MAX98357A DIN (ESP32 RX핀)</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-rose-400 font-bold">전원 5V</td>
                          <td className="py-2 text-amber-300 font-bold">5V</td>
                          <td className="py-2 text-[#a6adc8]">MAX98357A VDD</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-[#6c7086] font-bold">공통 GND</td>
                          <td className="py-2 text-amber-300 font-bold">GND</td>
                          <td className="py-2 text-[#a6adc8]">버튼, LED(-), MAX98357A GND</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Operation Description Card */}
                <div className="bg-[#1e1e2e] p-5 rounded-2xl border border-[#313244] space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider font-mono">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>회로 동작 원리 설명</span>
                    </div>
                    <ul className="text-xs text-[#cdd6f4] space-y-2 leading-relaxed">
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                        <span><strong>버튼 누름 (GPIO4 = LOW)</strong>: 회로가 접지(GND)와 연결되며 인터랙션이 발생합니다.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                        <span><strong>LED 켜짐 (GPIO2 = HIGH)</strong>: 220Ω 저항을 거쳐 LED가 안전한 전류로 점등됩니다.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                        <span><strong>도-미-솔 소리 출력</strong>: I2S 디지털 신호로 MAX98357A 앰프를 통해 스피커로 화음이 재생됩니다.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs text-indigo-200">
                    💡 <strong>실습 팁</strong>: 배선이 완료된 후 다음 실습 코드인 <strong>`soda-2-2.ino`</strong>를 업로드하여 동작을 테스트하세요!
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Code Text Area */
            <div className="flex-1 overflow-auto p-6 font-mono text-xs leading-relaxed text-[#cdd6f4] selection:bg-[#585b70] scrollbar-thin">
              <pre className="whitespace-pre">
                <code>{activeItem.code}</code>
              </pre>
            </div>
          )}

          {/* Footer High-Contrast 3-Step Visual Guide Bar */}
          <div className="bg-[#11111b] px-6 py-3.5 border-t border-[#313244] flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-400/15 border border-amber-400/40 rounded-lg text-amber-300 font-bold text-[11px]">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>아두이노 IDE 업로드 3단계:</span>
              </div>

              {/* 3 Steps Visual Badges */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {/* Step 1 */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#181825] border border-blue-400/40 shadow-xs">
                  <span className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-black">1</span>
                  <span className="font-bold text-[#89b4fa]">💾 파일 저장 또는 복사</span>
                </div>

                <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />

                {/* Step 2 */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#181825] border border-purple-400/40 shadow-xs">
                  <span className="w-4 h-4 rounded-full bg-purple-500 text-white flex items-center justify-center text-[10px] font-black">2</span>
                  <span className="font-bold text-[#cba6f7]">💻 아두이노 IDE 붙여넣기</span>
                </div>

                <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />

                {/* Step 3 */}
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 border-2 border-emerald-400 shadow-sm text-emerald-300">
                  <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black">3</span>
                  <span className="font-black text-[#a6e3a1]">⚡ [ ➔ ] 업로드 클릭!</span>
                </div>
              </div>
            </div>

            <span className="font-mono text-[11px] text-[#6c7086] hidden xl:inline">코드 라인: {activeItem.code.split("\n").length}줄</span>
          </div>
        </div>
      </div>
    );
  }
