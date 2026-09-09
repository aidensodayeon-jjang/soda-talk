import React, { useState, useEffect } from 'react';
import LcdPixelEditor from './LcdPixelEditor';
import { 
  Code2, 
  Copy, 
  Check, 
  Download, 
  Sparkles, 
  Cpu, 
  Search, 
  Terminal, 
  BookOpen, 
  Layers, 
  ChevronRight, 
  Zap, 
  Info,
  Sliders,
  Maximize2,
  FileCode2,
  FileCode,
  Play,
  RotateCcw,
  RefreshCw,
  FolderArchive,
  ExternalLink,
  ArrowRight,
  Palette
} from 'lucide-react';

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
  contentType?: "code" | "circuit" | "doc" | "editor";
  imageUrl?: string;
  updatedAt?: string;
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
    title: "1-2. 버튼 + LED + 스피커",
    description: "버튼(D4)을 누르면 LED(D2)가 켜지며 MAX98357A I2S 앰프 스피커를 통해 도-미-솔 화음 사운드를 출력하는 인터랙션 예제입니다.",
    filename: "soda-1-2.ino",
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
}`
  },
  {
    id: "content-week-3-circuit-diagram",
    week: 3,
    title: "[배선도] 2.0\" LCD + 버튼 + LED + 스피커 회로 연결도",
    description: "ESP32-S3 SuperMini 보드와 ST7789 2.0인치 LCD 모듈(SPI), MAX98357A I2S 앰프 스피커, 버튼(GPIO4), LED(GPIO2)의 종합 핀 배선도 및 하드웨어 가이드입니다.",
    filename: "circuit_lcd_btn_led_speaker.png",
    language: "json",
    contentType: "circuit",
    imageUrl: "/images/circuit_lcd_btn_led_speaker.png",
    tags: ["배선도", "회로도", "LCD", "ST7789", "ESP32-S3", "I2S", "스피커", "하드웨어"],
    pinMap: "LCD(DIN:11, CLK:12, CS:13, DC:7, RST:6, BL:5V), I2S(BCLK:5, LRC:3, DIN:44), 버튼:4, LED:2, 전원:5V/GND",
    updatedAt: new Date().toISOString(),
    code: `// [3주차] 2.0" ST7789 LCD + 버튼 + LED + I2S 스피커 하드웨어 연결 요약
// =========================================================================
// [1] Waveshare 2.0" ST7789 LCD (SPI 통신)
// 부품 핀 표기  | ESP32-S3 핀  | 설명
// -------------+-------------+--------------------------------------------
// VCC          | 5V (또는 3V3)| 디스플레이 구동 전원
// GND          | GND         | 공통 접지
// DIN          | GPIO11      | MOSI (마스터 출력 ➔ 디스플레이 입력)
// CLK          | GPIO12      | SCK (SPI 클럭 신호)
// CS           | GPIO13      | 칩 셀렉트 (Chip Select)
// DC           | GPIO7       | Data / Command 제어선
// RST          | GPIO6       | 하드웨어 리셋 신호
// BL           | 5V (또는 3V3)| 백라이트 전원
//
// [2] MAX98357A I2S 오디오 앰프 & 스피커
// 부품 핀 표기  | ESP32-S3 핀  | 설명
// -------------+-------------+--------------------------------------------
// VDD          | 5V          | 앰프 전원 (5V 권장)
// GND          | GND         | 공통 접지
// BCLK         | GPIO5       | 비트 클럭 (Bit Clock)
// LRC          | GPIO3       | 좌/우 채널 클럭 (Word Select)
// DIN          | GPIO44      | 디지털 오디오 데이터 입력 (ESP32-S3 RX)
// OUT+ / OUT-  | 스피커      | 소다봇 미니 스피커 연결 (+ / -)
//
// [3] 버튼 & LED 인터랙션 회로
// 부품         | ESP32-S3 핀  | 설명
// -------------+-------------+--------------------------------------------
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
    code: `#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <SPI.h>

// ========================
// LCD 핀 설정 (하드웨어 SPI)
// ========================
#define TFT_MOSI 11  // 보드: DIN
#define TFT_CLK  12  // 보드: CLK
#define TFT_CS   13  // 보드: CS
#define TFT_DC   7   // 보드: DC
#define TFT_RST  6   // 보드: RST

SPIClass hspi(HSPI);
Adafruit_ST7789 tft = Adafruit_ST7789(&hspi, TFT_CS, TFT_DC, TFT_RST);

void setup() {
  Serial.begin(115200);

  // ---- LCD 초기화 ----
  hspi.begin(TFT_CLK, -1, TFT_MOSI, TFT_CS);
  tft.init(240, 320);
  tft.setSPISpeed(4000000);   // 통신 속도 설정
  tft.setRotation(3);         // 320x240 가로 화면 모드
  tft.invertDisplay(true);    // 색상 반전

  // ---- 화면 지우기 ----
  tft.fillScreen(ST77XX_BLACK);

  // ---- 중앙 글씨 출력 ----
  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(3);
  tft.setCursor(60, 105);
  tft.print("Hello SODA!");
}

void loop() {
  // 기본 대기
}`
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
    code: `#include <driver/i2s.h>
#include <math.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <SPI.h>

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

// LCD: Waveshare 2inch LCD Module (ST7789V, 240x320), 하드웨어 SPI
// 보드 실크 표기 순서 그대로:
//   VCC -> 3V3
//   GND -> GND
//   DIN -> GPIO11   (= MOSI, 데이터선)
//   CLK -> GPIO12   (= SCLK, 클럭)
//   CS  -> GPIO13   (브레드보드에선 GPIO로 제어)
//   DC  -> GPIO7
//   RST -> GPIO6
//   BL  -> 3V3
#define TFT_MOSI 11  // 보드: DIN
#define TFT_CLK  12  // 보드: CLK
#define TFT_CS   13  // 보드: CS
#define TFT_DC   7   // 보드: DC
#define TFT_RST  6   // 보드: RST

SPIClass hspi(HSPI);
Adafruit_ST7789 tft = Adafruit_ST7789(&hspi, TFT_CS, TFT_DC, TFT_RST);
// 2.0" ST7789 240x320, setRotation(3) -> 320x240 가로 화면


// ========================
// setup
// ========================

void setup() {

  Serial.begin(115200);

  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(LED_PIN, LOW);

  // ---- LCD 초기화 ----
  hspi.begin(TFT_CLK, -1, TFT_MOSI, TFT_CS);
  tft.init(240, 320);
  tft.setSPISpeed(4000000);    // 점퍼선 40cm+ 로 김 -> 4MHz로 안전하게 (느려도 티 안 남)
  tft.setRotation(3);
  tft.invertDisplay(true);   // 이 ST7789 패널은 반전 모드에서 색이 정상 표시됨
  drawTestScreen();

  // ---- I2S 설정 ----
  i2s_config_t i2s_config = {
    .mode                 = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate          = SAMPLE_RATE,
    .bits_per_sample      = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format       = I2S_CHANNEL_FMT_RIGHT_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags     = 0,
    .dma_buf_count        = 8,
    .dma_buf_len          = 256,
    .use_apll             = false,
    .tx_desc_auto_clear   = true,
    .fixed_mclk           = 0
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num   = I2S_BCLK,
    .ws_io_num    = I2S_LRC,
    .data_out_num = I2S_DOUT,
    .data_in_num  = I2S_PIN_NO_CHANGE
  };

  i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_PORT, &pin_config);

  delay(300);
}


// ========================
// 기본 테스트 화면
// ========================

void drawTestScreen() {
  tft.fillScreen(ST77XX_BLACK);

  tft.setTextSize(3);
  tft.setCursor(20, 140);
  tft.print("SODABOT Week3");

  tft.setTextSize(2);
  tft.setCursor(20, 185);
  tft.setTextColor(ST77XX_YELLOW);
  tft.print("LCD OK - press BTN");
}

int pressCount = 0;

// 버튼 누를 때마다 카운트 표시 + 배경색 토글
void showPress() {
  pressCount++;
  uint16_t bg = (pressCount % 2) ? ST77XX_CYAN : ST77XX_MAGENTA;
  tft.fillScreen(bg);
  tft.setTextColor(ST77XX_BLACK);
  tft.setTextSize(4);
  tft.setCursor(60, 90);
  tft.print("PRESS #");
  tft.print(pressCount);
}


// ========================
// 메인
// ========================

void loop() {

  if (digitalRead(BUTTON_PIN) == LOW) {

    digitalWrite(LED_PIN, HIGH);
    showPress();

    playTone(523.25, 180);  // 도
    delay(40);
    playTone(659.25, 180);  // 미
    delay(40);
    playTone(783.99, 300);  // 솔

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
  float phaseStep = 2.0 * PI * frequency / SAMPLE_RATE;

  int totalSamples = SAMPLE_RATE * duration_ms / 1000;
  int generated = 0;

  while (generated < totalSamples) {

    int count = min(BUFFER_FRAMES, totalSamples - generated);

    for (int i = 0; i < count; i++) {
      int16_t sample = (int16_t)(sin(phase) * 6000);  // 볼륨
      phase += phaseStep;
      if (phase >= 2.0 * PI) phase -= 2.0 * PI;

      buffer[i * 2]     = sample;   // 좌
      buffer[i * 2 + 1] = sample;   // 우
    }

    size_t bytesWritten;
    i2s_write(I2S_PORT, buffer, count * 2 * sizeof(int16_t),
              &bytesWritten, portMAX_DELAY);

    generated += count;
  }

    i2s_zero_dma_buffer(I2S_PORT);
  }
`
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
    code: `#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <SPI.h>

// LCD 핀
#define TFT_MOSI 11
#define TFT_CLK  12
#define TFT_CS   13
#define TFT_DC   7
#define TFT_RST  6

SPIClass hspi(HSPI);
Adafruit_ST7789 tft = Adafruit_ST7789(&hspi, TFT_CS, TFT_DC, TFT_RST);

void setup() {

  // LCD 시작
  hspi.begin(TFT_CLK, -1, TFT_MOSI, TFT_CS);
  tft.init(240, 320);
  tft.setSPISpeed(4000000);
  tft.setRotation(3);
  tft.invertDisplay(true);

  // 화면 지우기
  tft.fillScreen(ST77XX_BLACK);


  // ① 선
  tft.drawLine(
    20, 20,       // 시작점 x, y
    100, 60,      // 끝점 x, y
    ST77XX_WHITE
  );

  delay(2000);


  // ② 사각형
  tft.drawRect(
    40, 80,       // 시작점 x, y
    120, 60,      // width, height
    ST77XX_YELLOW
  );

  delay(2000);


  // ③ 원
  tft.drawCircle(
    220, 60,      // 중심 x, y
    40,           // radius
    ST77XX_CYAN
  );

  delay(2000);


  // ④ 채운 원
  tft.fillCircle(
    240, 170,     // 중심 x, y
    35,           // radius
    ST77XX_RED
  );
}

void loop() {

}`
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
    code: `// 소다봇 2.0" LCD 화면편집기 / 표정 스튜디오에서 코드를 직접 디자인하고 다운로드하세요!`
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
    <div className="flex-1 flex flex-col h-full bg-[#FAF9F6] overflow-hidden relative">
      {/* 복사 완료 토스트 알림 */}
      {copiedId && (
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

      {/* Main Content Area: Editor OR Full Width Code Viewer */}
      {activeItem.contentType === "editor" ? (
        <LcdPixelEditor />
      ) : (
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
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#313244] text-[#a6adc8] font-semibold">
                          <th className="pb-2">신호 / 부품</th>
                          <th className="pb-2">ESP32-S3 핀</th>
                          <th className="pb-2">연결 대상</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#313244]/60 text-[#cdd6f4]">
                        {activeItem.id === "content-week-3-circuit-diagram" ? (
                          <>
                            <tr>
                              <td className="py-1.5 text-cyan-400 font-bold">LCD DIN (MOSI)</td>
                              <td className="py-1.5 text-amber-300 font-bold">GPIO11</td>
                              <td className="py-1.5 text-[#a6adc8]">ST7789 DIN (데이터)</td>
                            </tr>
                            <tr>
                              <td className="py-1.5 text-cyan-400 font-bold">LCD CLK (SCK)</td>
                              <td className="py-1.5 text-amber-300 font-bold">GPIO12</td>
                              <td className="py-1.5 text-[#a6adc8]">ST7789 CLK (클럭)</td>
                            </tr>
                            <tr>
                              <td className="py-1.5 text-cyan-400 font-bold">LCD CS / DC / RST</td>
                              <td className="py-1.5 text-amber-300 font-bold">13 / 7 / 6</td>
                              <td className="py-1.5 text-[#a6adc8]">CS:13, DC:7, RST:6</td>
                            </tr>
                            <tr>
                              <td className="py-1.5 text-cyan-400 font-bold">LCD VCC / BL</td>
                              <td className="py-1.5 text-amber-300 font-bold">5V (또는 3V3)</td>
                              <td className="py-1.5 text-[#a6adc8]">전원 및 백라이트</td>
                            </tr>
                            <tr>
                              <td className="py-1.5 text-emerald-400 font-bold">I2S 스피커</td>
                              <td className="py-1.5 text-amber-300 font-bold">5 / 3 / 44</td>
                              <td className="py-1.5 text-[#a6adc8]">BCLK:5, LRC:3, DIN:44</td>
                            </tr>
                            <tr>
                              <td className="py-1.5 text-[#89b4fa] font-bold">버튼 / LED</td>
                              <td className="py-1.5 text-amber-300 font-bold">GPIO4 / GPIO2</td>
                              <td className="py-1.5 text-[#a6adc8]">버튼: GPIO4, LED: GPIO2</td>
                            </tr>
                            <tr>
                              <td className="py-1.5 text-[#6c7086] font-bold">공통 GND</td>
                              <td className="py-1.5 text-amber-300 font-bold">GND</td>
                              <td className="py-1.5 text-[#a6adc8]">전체 모듈 공통 접지</td>
                            </tr>
                          </>
                        ) : (
                          <>
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
                          </>
                        )}
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
                    💡 <strong>실습 팁</strong>: 배선이 완료된 후 다음 실습 코드인 <strong>&apos;soda-2-2.ino&apos;</strong>를 업로드하여 동작을 테스트하세요!
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Code Text Area with Line Numbers */
            <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-[#cdd6f4] selection:bg-[#585b70] scrollbar-thin bg-[#1e1e2e]">
              <div className="min-w-full inline-block">
                <table className="w-full border-collapse">
                  <tbody>
                    {(activeItem.code || "").split("\n").map((line, idx) => {
                      const isMissionLine = line.includes("★") || line.includes("👈") || line.includes("[실습 미션");
                      const isComment = line.trim().startsWith("//") || line.trim().startsWith("/*") || line.trim().startsWith("*");
                      return (
                        <tr
                          key={idx}
                          className={`transition-colors ${
                            isMissionLine
                              ? "bg-amber-400/15"
                              : "hover:bg-[#313244]/40"
                          } group`}
                        >
                          <td
                            className={`w-12 min-w-[3rem] text-right pr-4 select-none align-top font-mono text-[11px] border-r border-[#313244]/60 ${
                              isMissionLine
                                ? "text-amber-300 font-bold"
                                : "text-[#585b70] group-hover:text-[#89b4fa]"
                            }`}
                          >
                            {idx + 1}
                          </td>
                          <td
                            className={`whitespace-pre pl-4 font-mono leading-relaxed ${
                              isMissionLine
                                ? "text-amber-200 font-semibold"
                                : isComment
                                ? "text-[#a6adc8]"
                                : "text-[#cdd6f4]"
                            }`}
                          >
                            {line || " "}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
      )}
    </div>
  );
}
