// SODABOT BASIC: ESP32-S3, BLE/Wi-Fi/USB 명령 및 기본 표정
#include <Arduino.h>
#include <atomic>
#include <math.h>
#if !ARDUINO_USB_CDC_ON_BOOT
#error "Enable Tools > USB CDC On Boot before uploading this sketch."
#endif
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <driver/i2s.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <SPI.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <esp_heap_caps.h>

// === CUSTOM_HEADERS_START ===
// === CUSTOM_HEADERS_END ===

const char* ssid = __SODA_WIFI_SSID__;
const char* password = __SODA_WIFI_PASSWORD__;

// 기본 위치 설정 (서울 기준)
const char* WEATHER_LATITUDE  = "37.5665";
const char* WEATHER_LONGITUDE = "126.9780";

// === CUSTOM_GLOBALS_START ===
// === CUSTOM_GLOBALS_END ===

struct IncomingMessage { char json[2048]; uint32_t clientId; uint8_t source; };
void processMessage(const IncomingMessage& message);
AsyncWebServer server(8080);
AsyncWebSocket ws("/soda/ws");
QueueHandle_t incomingQueue;
bool webServerStarted = false;
// BLE UUID definitions matching web app
#define SERVICE_UUID        "6b8a0001-4f2a-4b3c-9d5e-1a2b3c4d5e6f"
#define CHAR_WRITE_UUID     "6b8a0002-4f2a-4b3c-9d5e-1a2b3c4d5e6f"
#define CHAR_NOTIFY_UUID    "6b8a0003-4f2a-4b3c-9d5e-1a2b3c4d5e6f"

BLEServer* pServer = NULL;
BLECharacteristic* pNotifyCharacteristic = NULL;
bool deviceConnected = false;


// === SODA-AIBOT v2 보드 핀맵 (실물 SuperMini 핀 순서 기준) ===
// 실물 헤더: 좌=TX(43) RX(44) 1 2 3 4 5 6 7,  우=5V G 3V3 13 12 11 10 9 8
// 물리 버튼 (GPIO 4, 내부 풀업 사용)
#define BUTTON_PIN 4

#define MIC_I2S_PORT I2S_NUM_1

#define MIC_SCK  9
#define MIC_WS   10
#define MIC_SD   8

#define MIC_SAMPLE_RATE 16000
constexpr uint32_t MAX_RECORD_SECONDS = 8;
constexpr uint32_t MIN_RECORD_MS = 350;
constexpr size_t MAX_RECORD_SAMPLES = MIC_SAMPLE_RATE * MAX_RECORD_SECONDS;

// soda-talk 서버가 실행되는 컴퓨터의 현재 Wi-Fi 주소.
// 컴퓨터 IP가 바뀌면 이 값만 고치면 된다.
const char* SODA_SERVER_HOST = __SODA_SERVER_HOST__;
const uint16_t SODA_SERVER_PORT = 7989;
const char* SODA_AUDIO_CHAT_PATH = "/api/hw/audio-chat";
const char* SODA_TTS_PATH = "/api/hw/tts";
const char* DEFAULT_SODA_API_KEY = __SODA_API_KEY__;
String sodaApiKey;

bool micReady = false;
int16_t* voicePcm = nullptr;
volatile size_t voiceSampleCount = 0;
std::atomic<bool> voiceUploadPending{false};
std::atomic<bool> voiceUploadBusy{false};

void setupMicrophone() {
  i2s_config_t config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = MIC_SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,
    .dma_buf_len = 256,
    .use_apll = false
  };
  i2s_pin_config_t pins = {
    .mck_io_num = I2S_PIN_NO_CHANGE,
    .bck_io_num = MIC_SCK,
    .ws_io_num = MIC_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = MIC_SD
  };
  esp_err_t err = i2s_driver_install(MIC_I2S_PORT, &config, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("[오류] 마이크를 시작하지 못했습니다. 오류 코드: %s\n", esp_err_to_name(err));
    return;
  }
  err = i2s_set_pin(MIC_I2S_PORT, &pins);
  if (err != ESP_OK) {
    Serial.printf("[오류] 마이크 핀 설정에 실패했습니다. 배선을 확인해주세요. 오류 코드: %s\n", esp_err_to_name(err));
    i2s_driver_uninstall(MIC_I2S_PORT);
    return;
  }

  voicePcm = static_cast<int16_t*>(heap_caps_malloc(
    MAX_RECORD_SAMPLES * sizeof(int16_t), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  if (!voicePcm) {
    Serial.println("[오류] 녹음 버퍼를 만들지 못했습니다. 도구 > PSRAM을 QSPI PSRAM으로 설정해주세요.");
    i2s_driver_uninstall(MIC_I2S_PORT);
    return;
  }
  micReady = true;
  Serial.printf("[준비] 마이크와 %.0fKB 녹음 버퍼가 준비되었습니다.\n",
                (MAX_RECORD_SAMPLES * sizeof(int16_t)) / 1024.0);
}

void microphoneTask(void*) {
  int32_t samples[256];
  bool lastRaw = digitalRead(BUTTON_PIN) == LOW;
  bool pressed = false;
  uint32_t changedAt = millis();
  uint32_t lastStatus = millis();
  uint32_t recordStarted = 0;
  uint32_t lastLevelLog = 0;

  for (;;) {
    uint32_t now = millis();
    bool raw = digitalRead(BUTTON_PIN) == LOW;
    if (raw != lastRaw) { lastRaw = raw; changedAt = now; }
    if (raw != pressed && now - changedAt >= 30) {
      pressed = raw;
      if (pressed) {
        if (voiceUploadBusy.load() || voiceUploadPending.load()) {
          Serial.println("[대기] 이전 대화를 처리 중입니다. 잠시 후 다시 눌러주세요.");
          pressed = false;
        } else {
          voiceSampleCount = 0;
          recordStarted = now;
          Serial.println("[버튼] 버튼 눌림을 감지했습니다.");
          Serial.println("[녹음 시작] 버튼을 누른 채 말해주세요.");
        }
      } else {
        uint32_t duration = now - recordStarted;
        Serial.println("[버튼] 버튼을 놓았습니다.");
        if (duration < MIN_RECORD_MS || voiceSampleCount == 0) {
          voiceSampleCount = 0;
          Serial.println("[녹음 취소] 너무 짧습니다. 버튼을 조금 더 길게 누르고 말해주세요.");
        } else {
          Serial.printf("[녹음 완료] %.2f초, %u개 샘플을 서버로 보냅니다.\n",
                        voiceSampleCount / (float)MIC_SAMPLE_RATE,
                        (unsigned)voiceSampleCount);
          voiceUploadPending.store(true);
        }
      }
    }

    size_t bytesRead = 0;
    esp_err_t err = i2s_read(MIC_I2S_PORT, samples, sizeof(samples), &bytesRead, pdMS_TO_TICKS(50));
    if (err == ESP_OK && bytesRead > 0 && pressed) {
      size_t count = bytesRead / sizeof(int32_t);
      double sum = 0;
      for (size_t i = 0; i < count && voiceSampleCount < MAX_RECORD_SAMPLES; ++i) {
        int32_t sample = samples[i] >> 14;
        sample = constrain(sample, -32768, 32767);
        voicePcm[voiceSampleCount++] = static_cast<int16_t>(sample);
        sum += static_cast<double>(sample) * sample;
      }
      if (now - lastLevelLog >= 500 && count > 0) {
        lastLevelLog = now;
        Serial.printf("[녹음 중] 소리가 감지되고 있습니다. (크기: %.0f, %.1f초)\n",
                      sqrt(sum / count), voiceSampleCount / (float)MIC_SAMPLE_RATE);
      }
      if (voiceSampleCount >= MAX_RECORD_SAMPLES) {
        pressed = false;
        Serial.println("[녹음 완료] 최대 8초에 도달해 자동으로 전송합니다.");
        voiceUploadPending.store(true);
      }
    } else if (err != ESP_OK && now - lastStatus >= 1000) {
      lastStatus = now;
      Serial.printf("[오류] 마이크 읽기 실패: %s\n", esp_err_to_name(err));
    }

    if (!pressed && !voiceUploadPending.load() && !voiceUploadBusy.load() && now - lastStatus >= 5000) {
      lastStatus = now;
      Serial.println(micReady
        ? "[대기] 버튼을 누른 채 말하고, 다 말하면 버튼을 놓으세요."
        : "[오류] 마이크가 준비되지 않았습니다. 연결과 오류 메시지를 확인해주세요.");
    }
    vTaskDelay(pdMS_TO_TICKS(5));
  }
}

void startMicrophoneMonitor() {
  setupMicrophone();
  if (!micReady) return;
  if (xTaskCreate(microphoneTask, "mic-monitor", 4096, nullptr, 1, nullptr) != pdPASS) {
    heap_caps_free(voicePcm);
    voicePcm = nullptr;
    i2s_driver_uninstall(MIC_I2S_PORT);
    micReady = false;
    Serial.println("[오류] 마이크 감시 작업을 시작하지 못했습니다. 메모리가 부족합니다.");
  }
}



// LCD (하드웨어 SPI). 점퍼선 배선 시 CS = GPIO13, RST = GPIO6, DC = GPIO7
#define TFT_CS   13
#define TFT_RST  6   // LCD RES = GPIO6 (좌 8번째 핀)
#define TFT_DC   7   // LCD DC  = GPIO7 (좌 9번째 핀)
#define TFT_MOSI 11
#define TFT_CLK  12
SPIClass hspi(HSPI);
Adafruit_ST7789 tft = Adafruit_ST7789(&hspi, TFT_CS, TFT_DC, TFT_RST);
// 2.0" ST7789 240x320 LCD, setRotation(3) 기준 320x240 화면 (기존 방향에서 180도 회전)
#define LEX    100
#define REX    220
#define EYE_Y  120
#define EW      84
#define EH      68
#define ER      20

// 스피커 (I2S_NUM_0) — MAX98357A: DIN=GPIO44(RX), LRC=GPIO3, BCLK=GPIO5
#define I2S_SPK_BCLK 5
#define I2S_SPK_LRC  3
#define I2S_SPK_DOUT 44
#define TTS_SAMPLE_RATE 24000
#define SPEAKER_VOLUME_PERCENT 110
#define SPEAKER_SAFE_PEAK 30000


bool speakerReady = false;
int16_t applySpeakerVolume(int16_t sample) {
  int32_t amplified = ((int32_t)sample * SPEAKER_VOLUME_PERCENT) / 100;
  // MAX98357A 입력에 여유를 남겨 큰 음절에서 생기는 지직거림을 방지한다.
  if (amplified > SPEAKER_SAFE_PEAK) amplified = SPEAKER_SAFE_PEAK;
  if (amplified < -SPEAKER_SAFE_PEAK) amplified = -SPEAKER_SAFE_PEAK;
  return (int16_t)amplified;
}

// ── LCD 함수들 ────────────────────────────────────────────────────────────────

#define LCD_BG_COLOR ST77XX_BLACK
// 소다톡 웹앱의 시안/민트색(#22D3EE -> RGB 34, 211, 238)과 1:1 일치하는 RGB565 컬러
#define EYE_COLOR 0x269D

void drawEye(int cx, int cy, int ew, int eh, int er, int pox, int poy) {
  tft.fillRoundRect(cx - ew/2, cy - eh/2, ew, eh, er, EYE_COLOR);
}

// ── 표정 함수들 ───────────────────────────────────────────────────────────────

void idleEyes() {
  tft.fillScreen(LCD_BG_COLOR);
  drawEye(LEX, EYE_Y, EW, EH, ER, 0, 0);
  drawEye(REX, EYE_Y, EW, EH, ER, 0, 0);
}

void blinkOnce() {
  // 위에서 아래로 덮기
  for (int d = 0; d <= EH + 4; d += 12) {
    tft.fillRect(LEX - EW/2 - 2, EYE_Y - EH/2 - 2, EW + 4, d, LCD_BG_COLOR);
    tft.fillRect(REX - EW/2 - 2, EYE_Y - EH/2 - 2, EW + 4, d, LCD_BG_COLOR);
    delay(8);
  }
  delay(60);
  idleEyes();
}

// ^^ 행복한 기쁨 눈 (아치형 ^ ^ 곡선 + 두근두근 애니메이션 및 반짝임)
void happyEyes() {
  // 펄스 바운스 애니메이션 (2회 통통 튀기)
  for (int step = 0; step < 2; step++) {
    for (int offset : {0, -6, 0}) {
      tft.fillScreen(LCD_BG_COLOR);

      // 두꺼운 반원 아치 라인 (^ ^)
      for (int cx : {LEX, REX}) {
        int cy = EYE_Y + 12 + offset;
        int r = 44;
        for (int t = 0; t < 16; t++) {
          tft.drawCircle(cx, cy, r - t, EYE_COLOR);
        }
        // 아래쪽 깔끔하게 컷팅
        tft.fillRect(cx - 50, cy, 100, 50, LCD_BG_COLOR);
      }

      // 우상단 반짝이는 기쁨 별/스파클 효과
      tft.setTextColor(tft.color565(255, 220, 100)); // 따뜻한 골드 빛
      tft.setTextSize(2);
      tft.setCursor(LEX + 45, EYE_Y - 45 + offset);
      tft.print("*");
      tft.setCursor(REX + 45, EYE_Y - 45 + offset);
      tft.print("*");

      delay(60);
    }
  }
}

// 가로로 좁아진 눈 (녹음 중)
void listeningEyes() {
  tft.fillScreen(LCD_BG_COLOR);
  drawEye(LEX, EYE_Y, EW, EH / 2, ER, 0, 0);
  drawEye(REX, EYE_Y, EW, EH / 2, ER, 0, 0);
}

// 눈 위로 굴리기 (생각 중) — 위쪽 절반 마스킹
void thinkingEyes() {
  tft.fillScreen(LCD_BG_COLOR);
  drawEye(LEX, EYE_Y, EW, EH, ER, 0, 0);
  drawEye(REX, EYE_Y, EW, EH, ER, 0, 0);
  tft.fillRect(LEX - EW/2 - 2, EYE_Y - EH/2 - 2, EW + 4, EH / 2, LCD_BG_COLOR);
  tft.fillRect(REX - EW/2 - 2, EYE_Y - EH/2 - 2, EW + 4, EH / 2, LCD_BG_COLOR);
}

// 졸린 눈 — 화면 깜빡임 없이 Zzz 영역만 부분 갱신하여 둥실둥실 애니메이션
void sleepyEyes() {
  tft.fillScreen(LCD_BG_COLOR);
  
  // 감은 눈은 최초 1회만 그리기 (깜빡임 완벽 제거)
  drawEye(LEX, EYE_Y, EW, EH, ER, 0, 0);
  drawEye(REX, EYE_Y, EW, EH, ER, 0, 0);
  tft.fillRect(LEX - EW/2 - 2, EYE_Y - EH/2 - 2, EW + 4, EH * 2/3, LCD_BG_COLOR);
  tft.fillRect(REX - EW/2 - 2, EYE_Y - EH/2 - 2, EW + 4, EH * 2/3, LCD_BG_COLOR);

  for (int step = 0; step < 2; step++) {
    for (int dy : {0, -4, -8, -4}) {
      // 우상단 Zzz 영역만 좁게 지우기 (전체 화면 fillScreen 제거)
      tft.fillRect(250, 25, 68, 65, LCD_BG_COLOR);

      // Zzz 부유 애니메이션
      tft.setTextColor(tft.color565(129, 140, 248)); // Z (보라)
      tft.setTextSize(3);
      tft.setCursor(256, 36 + dy);
      tft.print("Z");

      tft.setTextColor(EYE_COLOR); // z (민트 시안)
      tft.setTextSize(2);
      tft.setCursor(276, 58 + (dy / 2));
      tft.print("z");

      tft.setTextSize(1);
      tft.setCursor(290, 76);
      tft.print("z");

      delay(90);
    }
  }
}

// 화난 눈 — 안쪽 위 삼각형 마스킹으로 사선 눈썹 느낌
void angryEyes() {
  tft.fillScreen(LCD_BG_COLOR);
  drawEye(LEX, EYE_Y, EW, EH, ER, 0, 0);
  drawEye(REX, EYE_Y, EW, EH, ER, 0, 0);
  // 왼쪽: 오른쪽 위 삼각형 마스킹
  tft.fillTriangle(
    LEX - EW/2, EYE_Y - EH/2,
    LEX + EW/2, EYE_Y - EH/2,
    LEX + EW/2, EYE_Y - EH/2 + EH/2,
    LCD_BG_COLOR);
  // 오른쪽: 왼쪽 위 삼각형 마스킹
  tft.fillTriangle(
    REX - EW/2, EYE_Y - EH/2,
    REX + EW/2, EYE_Y - EH/2,
    REX - EW/2, EYE_Y - EH/2 + EH/2,
    LCD_BG_COLOR);
}

// 슬픈 눈 (시선이 아래로 처진 눈 + 눈물 💧 애니메이션)
void sadEyes() {
  for (int step = 0; step < 2; step++) {
    for (int dropY = 0; dropY <= 24; dropY += 8) {
      tft.fillScreen(LCD_BG_COLOR);
      
      // 눈 렌더링
      drawEye(LEX, EYE_Y, EW, EH, ER, 0, 0);
      drawEye(REX, EYE_Y, EW, EH, ER, 0, 0);

      // 처진 사선 마스킹 (슬픈 눈썹 느낌)
      tft.fillTriangle(
        LEX - EW/2, EYE_Y - EH/2,
        LEX + EW/2, EYE_Y - EH/2,
        LEX - EW/2, EYE_Y - EH/2 + EH/2,
        LCD_BG_COLOR);
      tft.fillTriangle(
        REX - EW/2, EYE_Y - EH/2,
        REX + EW/2, EYE_Y - EH/2,
        REX + EW/2, EYE_Y - EH/2 + EH/2,
        LCD_BG_COLOR);

      // 왼쪽 눈 아래 떨어지는 눈물방울 (💧)
      uint16_t dropColor = tft.color565(34, 211, 238);
      int tx = LEX - 20;
      int ty = EYE_Y + EH/2 + 6 + dropY;
      tft.fillCircle(tx, ty, 6, dropColor);
      tft.fillTriangle(tx - 6, ty, tx + 6, ty, tx, ty - 10, dropColor);

      delay(50);
    }
  }
}

// 놀란 눈 — 동그란 눈 + 가운데 동공 + ⚡ 깜짝 이펙트 애니메이션
void surprisedEyes() {
  for (int step = 0; step < 2; step++) {
    tft.fillScreen(LCD_BG_COLOR);
    int r = EH / 2 + 16;
    
    // 두 눈
    tft.fillCircle(LEX, EYE_Y, r, EYE_COLOR);
    tft.fillCircle(REX, EYE_Y, r, EYE_COLOR);
    tft.fillCircle(LEX, EYE_Y, 7, LCD_BG_COLOR);
    tft.fillCircle(REX, EYE_Y, 7, LCD_BG_COLOR);

    // 상단 깜짝 번개 ⚡ 효과
    tft.setTextColor(tft.color565(255, 230, 80));
    tft.setTextSize(2);
    tft.setCursor(140, EYE_Y - EH/2 - 25);
    tft.print("!");

    delay(100);
  }
}

// 찡그린 눈 — 가로로 납작 + 가운데로 모임
void squintEyes() {
  tft.fillScreen(LCD_BG_COLOR);
  drawEye(LEX + 20, EYE_Y, EW - 20, EH / 3, ER, 0, 0);
  drawEye(REX - 20, EYE_Y, EW - 20, EH / 3, ER, 0, 0);
}

// 윙크 — 왼쪽 아치(^), 오른쪽 스파클 눈(✨)
void winkEyes() {
  tft.fillScreen(LCD_BG_COLOR);
  
  // 왼쪽 눈: 아치형 ^
  for (int t = 0; t < 14; t++) {
    tft.drawCircle(LEX, EYE_Y + 12, 38 - t, EYE_COLOR);
  }
  tft.fillRect(LEX - 44, EYE_Y + 12, 88, 44, LCD_BG_COLOR);

  // 오른쪽 눈: 기본 눈 + 우상단 반짝이는 별 ✨
  drawEye(REX, EYE_Y, EW, EH, ER, 0, 0);
  tft.setTextColor(tft.color565(255, 220, 100));
  tft.setTextSize(2);
  tft.setCursor(REX + EW/2 - 2, EYE_Y - EH/2 - 6);
  tft.print("*");
}

// 왼쪽 시선
void lookLeft() {
  tft.fillScreen(LCD_BG_COLOR);
  drawEye(LEX - 16, EYE_Y, EW, EH, ER, 0, 0);
  drawEye(REX - 16, EYE_Y, EW, EH, ER, 0, 0);
}

// 오른쪽 시선
void lookRight() {
  tft.fillScreen(LCD_BG_COLOR);
  drawEye(LEX + 16, EYE_Y, EW, EH, ER, 0, 0);
  drawEye(REX + 16, EYE_Y, EW, EH, ER, 0, 0);
}

// 아래 시선 (졸리거나 부끄러울 때)
void lookDown() {
  tft.fillScreen(LCD_BG_COLOR);
  drawEye(LEX, EYE_Y + 15, EW, EH, ER, 0, 0);
  drawEye(REX, EYE_Y + 15, EW, EH, ER, 0, 0);
}

// 하트눈
void heartEyes() {
  tft.fillScreen(LCD_BG_COLOR);
  uint16_t hc = tft.color565(255, 50, 100);
  for (int cx : {LEX, REX}) {
    // 하트 = 원 두개 + 삼각형
    tft.fillCircle(cx - 16, EYE_Y - 8, 22, hc);
    tft.fillCircle(cx + 16, EYE_Y - 8, 22, hc);
    tft.fillTriangle(cx - 40, EYE_Y - 8, cx + 40, EYE_Y - 8, cx, EYE_Y + 36, hc);
  }
}

// 초롱이 눈 (초롱초롱한 동공 + 하이라이트 반짝임)
void pupilEyes() {
  tft.fillScreen(LCD_BG_COLOR);
  for (int cx : {LEX, REX}) {
    // 1. 민트 시안 바탕 눈
    drawEye(cx, EYE_Y, EW, EH, ER, 0, 0);

    // 2. 가운데 검은 동공
    tft.fillCircle(cx, EYE_Y, 18, LCD_BG_COLOR);

    // 3. 동공 우상단/좌하단 반짝이는 흰색 하이라이트 원
    tft.fillCircle(cx + 6, EYE_Y - 6, 6, ST77XX_WHITE);
    tft.fillCircle(cx - 6, EYE_Y + 7, 3, ST77XX_WHITE);

    // 4. 눈 우상단 반짝임 별
    tft.setTextColor(tft.color565(255, 220, 100));
    tft.setTextSize(2);
    tft.setCursor(cx + EW/2 - 4, EYE_Y - EH/2 - 8);
    tft.print("*");
  }
}

// 헷갈린 눈 — 한쪽 크고 한쪽 작음
void confusedEyes() {
  tft.fillScreen(LCD_BG_COLOR);
  drawEye(LEX, EYE_Y, EW + 16, EH + 16, ER, 0, 0);  // 왼쪽 크게
  drawEye(REX, EYE_Y, EW - 24, EH - 24, ER, 0, 0);  // 오른쪽 작게
}

// 좌우 둘러보기 애니메이션
void lookAround() {
  lookLeft();  delay(500);
  idleEyes();  delay(200);
  lookRight(); delay(500);
  idleEyes();
}

// 고양이 얼굴 표정 (귀여운 ^ ^ 눈 + ▲w▲ 입 + 볼 홍조 + 수염)
void catFace() {
  tft.fillScreen(LCD_BG_COLOR);
  uint16_t ec = EYE_COLOR;

  // 1. 고양이 눈 (^ ^ 두꺼운 아치 라인)
  for (int cx : {LEX, REX}) {
    for (int t = 0; t < 14; t++) {
      tft.drawCircle(cx, EYE_Y + 12, 38 - t, ec);
    }
    tft.fillRect(cx - 44, EYE_Y + 12, 88, 44, LCD_BG_COLOR);
  }

  // 2. 작은 코 (▲)
  tft.fillTriangle(160, EYE_Y + 22, 153, EYE_Y + 34, 167, EYE_Y + 34, ec);

  // 3. 고양이 입 (w 곡선 모양)
  for (int t = 0; t < 4; t++) {
    tft.drawCircle(145, EYE_Y + 38, 12 - t, ec);
    tft.drawCircle(175, EYE_Y + 38, 12 - t, ec);
  }
  tft.fillRect(130, EYE_Y + 26, 70, 12, LCD_BG_COLOR);

  // 4. 귀여운 분홍 볼 홍조 (핑크)
  uint16_t pinkBlush = tft.color565(255, 130, 170);
  tft.fillCircle(LEX - 45, EYE_Y + 26, 12, pinkBlush);
  tft.fillCircle(REX + 45, EYE_Y + 26, 12, pinkBlush);

  // 5. 양쪽 고양이 수염
  tft.drawFastHLine(LEX - 65, EYE_Y + 15, 24, ec);
  tft.drawFastHLine(LEX - 60, EYE_Y + 28, 22, ec);
  tft.drawFastHLine(REX + 41, EYE_Y + 15, 24, ec);
  tft.drawFastHLine(REX + 38, EYE_Y + 28, 22, ec);
}

// ── 커스텀 표정 & 픽셀 렌더러 (웹 미리보기와 100% 1:1 일치) ───────────────────

uint16_t hexToRGB565(const char* hexStr, uint16_t defaultColor = EYE_COLOR) {
  if (!hexStr || hexStr[0] == '\0') return defaultColor;
  if (hexStr[0] == '#') hexStr++;
  if (strlen(hexStr) < 6) return defaultColor;
  long rgb = strtol(hexStr, NULL, 16);
  uint8_t r = (rgb >> 16) & 0xFF;
  uint8_t g = (rgb >> 8) & 0xFF;
  uint8_t b = rgb & 0xFF;
  return tft.color565(r, g, b);
}

void renderPixelsFromDoc(JsonArrayConst pixels) {
  tft.fillScreen(LCD_BG_COLOR);
  int pixelSize = 12;
  int startX = (320 - 16 * pixelSize) / 2; // 64
  int startY = (240 - 16 * pixelSize) / 2; // 24

  size_t idx = 0;
  for (int row = 0; row < 16; row++) {
    for (int col = 0; col < 16; col++) {
      if (idx >= pixels.size()) break;
      const char* colorHex = pixels[idx].as<const char*>();
      if (colorHex) {
        uint16_t color = hexToRGB565(colorHex, LCD_BG_COLOR);
        if (color != LCD_BG_COLOR) {
          tft.fillRect(startX + col * pixelSize, startY + row * pixelSize, pixelSize - 1, pixelSize - 1, color);
        }
      }
      idx++;
    }
  }
}

void renderBitmapFromDoc(const JsonDocument& doc) {
  bool clearScreen = doc["clearScreen"] | true;
  const char* bgHex = doc["bg"] | "#090D16";
  const char* fgHex = doc["fg"] | "#FFFFFF";
  uint16_t bgColor = hexToRGB565(bgHex, LCD_BG_COLOR);
  uint16_t fgColor = hexToRGB565(fgHex, ST77XX_WHITE);

  if (clearScreen) {
    tft.fillScreen(bgColor);
  }

  int startX = doc["x"] | 0;
  int startY = doc["y"] | 0;
  int w = doc["w"] | 0;
  int h = doc["h"] | 0;
  const char* dataHex = doc["data"] | "";

  if (w <= 0 || h <= 0 || !dataHex || !dataHex[0]) return;

  size_t dataLen = strlen(dataHex);
  int pixelIndex = 0;
  int totalPixels = w * h;

  for (size_t i = 0; i < dataLen && pixelIndex < totalPixels; i += 2) {
    char byteStr[3] = { dataHex[i], dataHex[i + 1] ? dataHex[i + 1] : '0', '\0' };
    uint8_t byteVal = (uint8_t)strtol(byteStr, NULL, 16);

    for (int b = 7; b >= 0 && pixelIndex < totalPixels; b--) {
      int curX = startX + (pixelIndex % w);
      int curY = startY + (pixelIndex / w);

      if (curX >= 0 && curX < 320 && curY >= 0 && curY < 240) {
        if ((byteVal >> b) & 1) {
          tft.drawPixel(curX, curY, fgColor);
        } else if (!clearScreen && bgColor != 0) {
          tft.drawPixel(curX, curY, bgColor);
        }
      }
      pixelIndex++;
    }
  }
}

void renderCustomFace(const JsonDocument& doc) {
  tft.fillScreen(LCD_BG_COLOR);
  const char* shape = doc["shape"] | "default";
  const char* colorHex = doc["color"] | "#22D3EE";
  uint16_t eyeColor = hexToRGB565(colorHex, EYE_COLOR);
  
  int ew = doc["eyeWidth"] | 48;
  int eh = doc["eyeHeight"] | 38;
  int er = doc["eyeRadius"] | 16;
  int px = doc["pupilX"] | 0;
  int py = doc["pupilY"] | 0;
  int eyebrow = doc["eyebrowTilt"] | 0;
  bool sparkle = doc["hasSparkle"] | false;
  bool gloss = doc["hasGloss"] | false;
  const char* mouth = doc["mouth"] | "none";

  String s(shape);
  s.toLowerCase();

  // 1. 눈 모양 렌더링
  if (s == "happy") {
    // 웃는 눈 (아치형)
    for (int cx : {LEX, REX}) {
      int cy = EYE_Y + 12 + py;
      int r = max(ew, eh) / 2 + 10;
      for (int t = 0; t < 12; t++) {
        tft.drawCircle(cx + px, cy, r - t, eyeColor);
      }
      tft.fillRect(cx + px - r - 4, cy, (r + 4) * 2, r + 10, LCD_BG_COLOR);
    }
  } else if (s == "wink") {
    // 윙크 (왼쪽은 아치형, 오른쪽은 둥근 눈)
    int cy = EYE_Y + 12 + py;
    int r = max(ew, eh) / 2 + 10;
    for (int t = 0; t < 12; t++) {
      tft.drawCircle(LEX + px, cy, r - t, eyeColor);
    }
    tft.fillRect(LEX + px - r - 4, cy, (r + 4) * 2, r + 10, LCD_BG_COLOR);

    tft.fillRoundRect(REX - ew/2 + px, EYE_Y - eh/2 + py, ew, eh, er, eyeColor);
    int pupilSize = max(10, min(ew, eh) / 3);
    tft.fillCircle(REX + px, EYE_Y + py, pupilSize, LCD_BG_COLOR);
  } else if (s == "sleepy") {
    // 졸린 눈 (얇은 바)
    int sleepH = min(eh, 14);
    tft.fillRoundRect(LEX - ew/2 + px, EYE_Y - sleepH/2 + py, ew, sleepH, er, eyeColor);
    tft.fillRoundRect(REX - ew/2 + px, EYE_Y - sleepH/2 + py, ew, sleepH, er, eyeColor);
  } else if (s == "heart") {
    // 하트 눈
    uint16_t hc = tft.color565(255, 50, 100);
    for (int cx : {LEX, REX}) {
      int hx = cx + px;
      int hy = EYE_Y - 8 + py;
      tft.fillCircle(hx - 16, hy, 20, hc);
      tft.fillCircle(hx + 16, hy, 20, hc);
      tft.fillTriangle(hx - 36, hy, hx + 36, hy, hx, hy + 40, hc);
    }
  } else if (s == "surprised") {
    // 놀란 눈 (원형 눈 + 원형 동공)
    int rad = max(ew, eh) / 2;
    tft.fillCircle(LEX + px, EYE_Y + py, rad, eyeColor);
    tft.fillCircle(REX + px, EYE_Y + py, rad, eyeColor);
    tft.fillCircle(LEX + px, EYE_Y + py, max(8, rad / 3), LCD_BG_COLOR);
    tft.fillCircle(REX + px, EYE_Y + py, max(8, rad / 3), LCD_BG_COLOR);
    tft.setTextColor(tft.color565(255, 230, 80));
    tft.setTextSize(2);
    tft.setCursor(155, EYE_Y - rad - 18);
    tft.print("!");
  } else if (s == "angry") {
    // 화난 눈
    tft.fillRoundRect(LEX - ew/2 + px, EYE_Y - eh/2 + py, ew, eh, er, eyeColor);
    tft.fillRoundRect(REX - ew/2 + px, EYE_Y - eh/2 + py, ew, eh, er, eyeColor);
    tft.fillTriangle(LEX - ew/2 + px, EYE_Y - eh/2 + py, LEX + ew/2 + px, EYE_Y - eh/2 + py, LEX + ew/2 + px, EYE_Y - eh/2 + py + eh/2, LCD_BG_COLOR);
    tft.fillTriangle(REX - ew/2 + px, EYE_Y - eh/2 + py, REX + ew/2 + px, EYE_Y - eh/2 + py, REX - ew/2 + px, EYE_Y - eh/2 + py + eh/2, LCD_BG_COLOR);
    int pupilSize = max(10, min(ew, eh) / 3);
    tft.fillCircle(LEX + px, EYE_Y + py, pupilSize, LCD_BG_COLOR);
    tft.fillCircle(REX + px, EYE_Y + py, pupilSize, LCD_BG_COLOR);
  } else if (s == "sad") {
    // 슬픈 눈
    tft.fillRoundRect(LEX - ew/2 + px, EYE_Y - eh/2 + py, ew, eh, er, eyeColor);
    tft.fillRoundRect(REX - ew/2 + px, EYE_Y - eh/2 + py, ew, eh, er, eyeColor);
    tft.fillTriangle(LEX - ew/2 + px, EYE_Y - eh/2 + py, LEX + ew/2 + px, EYE_Y - eh/2 + py, LEX - ew/2 + px, EYE_Y - eh/2 + py + eh/2, LCD_BG_COLOR);
    tft.fillTriangle(REX - ew/2 + px, EYE_Y - eh/2 + py, REX + ew/2 + px, EYE_Y - eh/2 + py, REX + ew/2 + px, EYE_Y - eh/2 + py + eh/2, LCD_BG_COLOR);
    int pupilSize = max(10, min(ew, eh) / 3);
    tft.fillCircle(LEX + px, EYE_Y + py, pupilSize, LCD_BG_COLOR);
    tft.fillCircle(REX + px, EYE_Y + py, pupilSize, LCD_BG_COLOR);
  } else if (s == "cat") {
    // 고양이 표정
    for (int cx : {LEX, REX}) {
      for (int t = 0; t < 12; t++) {
        tft.drawCircle(cx, EYE_Y + 12 + py, 36 - t, eyeColor);
      }
      tft.fillRect(cx - 40, EYE_Y + 12 + py, 80, 40, LCD_BG_COLOR);
    }
    tft.fillTriangle(160, EYE_Y + 22 + py, 153, EYE_Y + 32 + py, 167, EYE_Y + 32 + py, eyeColor);
    for (int t = 0; t < 4; t++) {
      tft.drawCircle(146, EYE_Y + 36 + py, 10 - t, eyeColor);
      tft.drawCircle(174, EYE_Y + 36 + py, 10 - t, eyeColor);
    }
    tft.fillRect(132, EYE_Y + 24 + py, 60, 12, LCD_BG_COLOR);
    uint16_t pinkBlush = tft.color565(255, 130, 170);
    tft.fillCircle(LEX - 45, EYE_Y + 24 + py, 10, pinkBlush);
    tft.fillCircle(REX + 45, EYE_Y + 24 + py, 10, pinkBlush);
  } else {
    // default / pupil / custom 둥근 눈
    tft.fillRoundRect(LEX - ew/2 + px, EYE_Y - eh/2 + py, ew, eh, er, eyeColor);
    tft.fillRoundRect(REX - ew/2 + px, EYE_Y - eh/2 + py, ew, eh, er, eyeColor);
    int pupilSize = max(10, min(ew, eh) / 3);
    tft.fillCircle(LEX + px, EYE_Y + py, pupilSize, LCD_BG_COLOR);
    tft.fillCircle(REX + px, EYE_Y + py, pupilSize, LCD_BG_COLOR);
  }

  // 2. 눈썹 렌더링
  if (eyebrow != 0 && s != "cat") {
    int browY = EYE_Y - eh/2 - 12 + py;
    int tiltOffset = constrain(eyebrow / 3, -15, 15);
    tft.fillRoundRect(LEX - ew/2, browY - tiltOffset, ew, 6, 3, eyeColor);
    tft.fillRoundRect(REX - ew/2, browY + tiltOffset, ew, 6, 3, eyeColor);
  }

  // 3. 반짝이 오버레이
  if (sparkle) {
    tft.setTextColor(tft.color565(255, 220, 100));
    tft.setTextSize(2);
    tft.setCursor(LEX + ew/2 - 2, EYE_Y - eh/2 - 6 + py); tft.print("*");
    tft.setCursor(REX + ew/2 - 2, EYE_Y - eh/2 - 6 + py); tft.print("*");
  }

  // 4. 광택 하이라이트
  if (gloss && s != "heart" && s != "happy" && s != "cat") {
    tft.fillCircle(LEX - ew/4 + px, EYE_Y - eh/4 + py, 5, ST77XX_WHITE);
    tft.fillCircle(REX - ew/4 + px, EYE_Y - eh/4 + py, 5, ST77XX_WHITE);
  }

  // 5. 입 모양 렌더링
  String m(mouth);
  m.toLowerCase();
  if (m == "smile") {
    for (int t = 0; t < 4; t++) {
      tft.drawCircle(160, EYE_Y + 45 + py, 22 - t, eyeColor);
    }
    tft.fillRect(134, EYE_Y + 22 + py, 52, 23, LCD_BG_COLOR);
  } else if (m == "open") {
    tft.fillRoundRect(146, EYE_Y + 46 + py, 28, 16, 7, eyeColor);
  } else if (m == "cat" && s != "cat") {
    for (int t = 0; t < 4; t++) {
      tft.drawCircle(146, EYE_Y + 36 + py, 10 - t, eyeColor);
      tft.drawCircle(174, EYE_Y + 36 + py, 10 - t, eyeColor);
    }
    tft.fillRect(132, EYE_Y + 24 + py, 60, 12, LCD_BG_COLOR);
  } else if (m == "tongue") {
    tft.fillRoundRect(148, EYE_Y + 48 + py, 24, 14, 6, tft.color565(255, 100, 150));
  }
}

void setupSpeaker() {
  if (speakerReady) return;

  i2s_config_t cfg = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate = TTS_SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = 0,
    .dma_buf_count = 8,
    .dma_buf_len = 512,
    .use_apll = false,
    .tx_desc_auto_clear = true
  };
  i2s_pin_config_t pins = {
    .mck_io_num = I2S_PIN_NO_CHANGE,
    .bck_io_num = I2S_SPK_BCLK,
    .ws_io_num  = I2S_SPK_LRC,
    .data_out_num = I2S_SPK_DOUT,
    .data_in_num = I2S_PIN_NO_CHANGE
  };
  esp_err_t installResult = i2s_driver_install(I2S_NUM_0, &cfg, 0, NULL);
  esp_err_t pinResult = installResult == ESP_OK
    ? i2s_set_pin(I2S_NUM_0, &pins)
    : installResult;
  Serial.printf("Speaker I2S init: install=%s, pins=%s\n",
                esp_err_to_name(installResult), esp_err_to_name(pinResult));
  if (pinResult == ESP_OK) {
    i2s_zero_dma_buffer(I2S_NUM_0);
    speakerReady = true;
  }
}

void finishSpeakerPlayback() {
  int16_t silence[256] = {0};  // stereo 128 frames
  size_t written = 0;

  // 약 213ms 무음으로 DMA 전체를 밀어낸다. 마지막 write가 끝날 때는
  // 기존 음성이 모두 출력되고 DMA에는 무음만 남아 안전하게 지울 수 있다.
  for (int i = 0; i < 40; i++) {
    i2s_write(I2S_NUM_0, silence, sizeof(silence), &written, portMAX_DELAY);
  }
  i2s_zero_dma_buffer(I2S_NUM_0);
}

void playToneI2S(int freqHz, int durationMs) {
  if (!speakerReady) return;
  int samples = (TTS_SAMPLE_RATE * durationMs) / 1000;
  int16_t buffer[256];
  size_t bytesWritten;

  for (int i = 0; i < samples; i += 128) {
    int chunkSize = min(128, samples - i);
    for (int j = 0; j < chunkSize; j++) {
      float t = (float)(i + j) / TTS_SAMPLE_RATE;
      int16_t val = applySpeakerVolume(
        (int16_t)(sin(2.0 * M_PI * freqHz * t) * 16000.0));
      buffer[j * 2] = val;
      buffer[j * 2 + 1] = val;
    }
    i2s_write(I2S_NUM_0, buffer, chunkSize * 4, &bytesWritten, portMAX_DELAY);
  }
  finishSpeakerPlayback();
}

// 소다톡 기존 조합형 한글 글꼴
// ==============================================================================
// ── 고품질 3벌식 조합형 한글 16x16 & ASCII 8x16 비트맵 폰트 엔진 ──
// ==============================================================================

// 1. ASCII 8x16 비트맵 폰트 (32 ' ' ~ 126 '~')
const uint8_t ASCII_FONT_8x16[95][16] PROGMEM = {
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0}, // 32: Space
  {0,0,0x18,0x18,0x18,0x18,0x18,0x18,0x18,0,0x18,0x18,0,0,0,0}, // 33: !
  {0,0x66,0x66,0x66,0x24,0,0,0,0,0,0,0,0,0,0,0}, // 34: "
  {0,0,0x6C,0x6C,0xFE,0x6C,0x6C,0x6C,0xFE,0x6C,0x6C,0,0,0,0,0}, // 35: #
  {0,0x18,0x7E,0xC0,0xC0,0x7C,0x06,0x06,0x7E,0x18,0,0,0,0,0,0}, // 36: $
  {0,0,0xC6,0xCC,0x18,0x30,0x60,0xC6,0x00,0,0,0,0,0,0,0}, // 37: %
  {0,0,0x38,0x6C,0x38,0x76,0xDC,0xCC,0x76,0,0,0,0,0,0,0}, // 38: &
  {0,0x30,0x30,0x60,0,0,0,0,0,0,0,0,0,0,0,0}, // 39: '
  {0,0x0C,0x18,0x30,0x30,0x30,0x30,0x30,0x18,0x0C,0,0,0,0,0,0}, // 40: (
  {0,0x30,0x18,0x0C,0x0C,0x0C,0x0C,0x0C,0x18,0x30,0,0,0,0,0,0}, // 41: )
  {0,0,0,0x66,0x3C,0xFF,0x3C,0x66,0,0,0,0,0,0,0,0}, // 42: *
  {0,0,0,0x18,0x18,0x7E,0x18,0x18,0,0,0,0,0,0,0,0}, // 43: +
  {0,0,0,0,0,0,0,0,0,0x18,0x18,0x30,0,0,0,0}, // 44: ,
  {0,0,0,0,0,0x7E,0,0,0,0,0,0,0,0,0,0}, // 45: -
  {0,0,0,0,0,0,0,0,0,0x18,0x18,0,0,0,0,0}, // 46: .
  {0,0,0x06,0x0C,0x18,0x30,0x60,0xC0,0x80,0,0,0,0,0,0,0}, // 47: /
  {0,0,0x3C,0x66,0xC3,0xC3,0xC3,0xC3,0x66,0x3C,0,0,0,0,0,0}, // 48: 0
  {0,0,0x18,0x38,0x18,0x18,0x18,0x18,0x18,0x7E,0,0,0,0,0,0}, // 49: 1
  {0,0,0x3C,0x66,0x06,0x0C,0x18,0x30,0x60,0x7E,0,0,0,0,0,0}, // 50: 2
  {0,0,0x3C,0x66,0x06,0x1C,0x06,0x06,0x66,0x3C,0,0,0,0,0,0}, // 51: 3
  {0,0,0x0C,0x1C,0x3C,0x6C,0xCC,0xFE,0x0C,0x0C,0,0,0,0,0,0}, // 52: 4
  {0,0,0x7E,0x60,0x7C,0x06,0x06,0x06,0x66,0x3C,0,0,0,0,0,0}, // 53: 5
  {0,0,0x3C,0x66,0x60,0x7C,0x66,0x66,0x66,0x3C,0,0,0,0,0,0}, // 54: 6
  {0,0,0x7E,0x06,0x0C,0x18,0x30,0x30,0x30,0x30,0,0,0,0,0,0}, // 55: 7
  {0,0,0x3C,0x66,0x66,0x3C,0x66,0x66,0x66,0x3C,0,0,0,0,0,0}, // 56: 8
  {0,0,0x3C,0x66,0x66,0x3E,0x06,0x06,0x66,0x3C,0,0,0,0,0,0}, // 57: 9
  {0,0,0,0x18,0x18,0,0,0x18,0x18,0,0,0,0,0,0,0}, // 58: :
  {0,0,0,0x18,0x18,0,0,0x18,0x18,0x30,0,0,0,0,0,0}, // 59: ;
  {0,0,0x0C,0x18,0x30,0x60,0x30,0x18,0x0C,0,0,0,0,0,0,0}, // 60: <
  {0,0,0,0x7E,0,0x7E,0,0,0,0,0,0,0,0,0,0}, // 61: =
  {0,0,0x30,0x18,0x0C,0x06,0x0C,0x18,0x30,0,0,0,0,0,0,0}, // 62: >
  {0,0,0x3C,0x66,0x06,0x0C,0x18,0,0x18,0x18,0,0,0,0,0,0}, // 63: ?
  {0,0,0x3C,0x66,0x6E,0x7A,0x72,0x60,0x3C,0,0,0,0,0,0,0}, // 64: @
  {0,0,0x18,0x3C,0x66,0x66,0x7E,0x66,0x66,0x66,0,0,0,0,0,0}, // 65: A
  {0,0,0x7C,0x66,0x66,0x7C,0x66,0x66,0x66,0x7C,0,0,0,0,0,0}, // 66: B
  {0,0,0x3C,0x66,0x60,0x60,0x60,0x60,0x66,0x3C,0,0,0,0,0,0}, // 67: C
  {0,0,0x78,0x6C,0x66,0x66,0x66,0x66,0x6C,0x78,0,0,0,0,0,0}, // 68: D
  {0,0,0x7E,0x60,0x60,0x7C,0x60,0x60,0x60,0x7E,0,0,0,0,0,0}, // 69: E
  {0,0,0x7E,0x60,0x60,0x7C,0x60,0x60,0x60,0x60,0,0,0,0,0,0}, // 70: F
  {0,0,0x3C,0x66,0x60,0x6E,0x66,0x66,0x66,0x3C,0,0,0,0,0,0}, // 71: G
  {0,0,0x66,0x66,0x66,0x7E,0x66,0x66,0x66,0x66,0,0,0,0,0,0}, // 72: H
  {0,0,0x7E,0x18,0x18,0x18,0x18,0x18,0x18,0x7E,0,0,0,0,0,0}, // 73: I
  {0,0,0x06,0x06,0x06,0x06,0x06,0x66,0x66,0x3C,0,0,0,0,0,0}, // 74: J
  {0,0,0x66,0x6C,0x78,0x70,0x78,0x6C,0x66,0x66,0,0,0,0,0,0}, // 75: K
  {0,0,0x60,0x60,0x60,0x60,0x60,0x60,0x60,0x7E,0,0,0,0,0,0}, // 76: L
  {0,0,0xC3,0xE7,0xFF,0xDB,0xC3,0xC3,0xC3,0xC3,0,0,0,0,0,0}, // 77: M
  {0,0,0x66,0x76,0x7E,0x7E,0x6E,0x66,0x66,0x66,0,0,0,0,0,0}, // 78: N
  {0,0,0x3C,0x66,0x66,0x66,0x66,0x66,0x66,0x3C,0,0,0,0,0,0}, // 79: O
  {0,0,0x7C,0x66,0x66,0x7C,0x60,0x60,0x60,0x60,0,0,0,0,0,0}, // 80: P
  {0,0,0x3C,0x66,0x66,0x66,0x66,0x6E,0x3C,0x06,0,0,0,0,0,0}, // 81: Q
  {0,0,0x7C,0x66,0x66,0x7C,0x6C,0x66,0x66,0x66,0,0,0,0,0,0}, // 82: R
  {0,0,0x3C,0x66,0x60,0x3C,0x06,0x06,0x66,0x3C,0,0,0,0,0,0}, // 83: S
  {0,0,0x7E,0x18,0x18,0x18,0x18,0x18,0x18,0x18,0,0,0,0,0,0}, // 84: T
  {0,0,0x66,0x66,0x66,0x66,0x66,0x66,0x66,0x3C,0,0,0,0,0,0}, // 85: U
  {0,0,0x66,0x66,0x66,0x66,0x66,0x3C,0x18,0x18,0,0,0,0,0,0}, // 86: V
  {0,0,0xC3,0xC3,0xC3,0xDB,0xFF,0xE7,0xC3,0xC3,0,0,0,0,0,0}, // 87: W
  {0,0,0x66,0x66,0x3C,0x18,0x3C,0x66,0x66,0x66,0,0,0,0,0,0}, // 88: X
  {0,0,0x66,0x66,0x66,0x3C,0x18,0x18,0x18,0x18,0,0,0,0,0,0}, // 89: Y
  {0,0,0x7E,0x06,0x0C,0x18,0x30,0x60,0x60,0x7E,0,0,0,0,0,0}, // 90: Z
  {0,0x3C,0x30,0x30,0x30,0x30,0x30,0x30,0x30,0x3C,0,0,0,0,0,0}, // 91: [
  {0,0,0xC0,0x60,0x30,0x18,0x0C,0x06,0x02,0,0,0,0,0,0,0}, // 92: '\'
  {0,0x3C,0x0C,0x0C,0x0C,0x0C,0x0C,0x0C,0x0C,0x3C,0,0,0,0,0,0}, // 93: ]
  {0,0x18,0x3C,0x66,0,0,0,0,0,0,0,0,0,0,0,0}, // 94: ^
  {0,0,0,0,0,0,0,0,0,0,0,0xFF,0,0,0,0}, // 95: _
  {0,0x30,0x18,0x0C,0,0,0,0,0,0,0,0,0,0,0,0}, // 96: `
  {0,0,0,0x3C,0x06,0x3E,0x66,0x66,0x3E,0,0,0,0,0,0,0}, // 97: a
  {0,0x60,0x60,0x7C,0x66,0x66,0x66,0x66,0x7C,0,0,0,0,0,0,0}, // 98: b
  {0,0,0,0x3C,0x66,0x60,0x60,0x66,0x3C,0,0,0,0,0,0,0}, // 99: c
  {0,0x06,0x06,0x3E,0x66,0x66,0x66,0x66,0x3E,0,0,0,0,0,0,0}, // 100: d
  {0,0,0,0x3C,0x66,0x7E,0x60,0x66,0x3C,0,0,0,0,0,0,0}, // 101: e
  {0,0x1C,0x30,0x78,0x30,0x30,0x30,0x30,0x30,0,0,0,0,0,0,0}, // 102: f
  {0,0,0,0x3E,0x66,0x66,0x3E,0x06,0x66,0x3C,0,0,0,0,0,0}, // 103: g
  {0,0x60,0x60,0x7C,0x66,0x66,0x66,0x66,0x66,0,0,0,0,0,0,0}, // 104: h
  {0,0x18,0,0x38,0x18,0x18,0x18,0x18,0x3C,0,0,0,0,0,0,0}, // 105: i
  {0,0x06,0,0x0E,0x06,0x06,0x06,0x66,0x3C,0,0,0,0,0,0,0}, // 106: j
  {0,0x60,0x60,0x66,0x6C,0x78,0x6C,0x66,0x66,0,0,0,0,0,0,0}, // 107: k
  {0,0x38,0x18,0x18,0x18,0x18,0x18,0x18,0x3C,0,0,0,0,0,0,0}, // 108: l
  {0,0,0,0x66,0xFF,0xDB,0xDB,0xC3,0xC3,0,0,0,0,0,0,0}, // 109: m
  {0,0,0,0x7C,0x66,0x66,0x66,0x66,0x66,0,0,0,0,0,0,0}, // 110: n
  {0,0,0,0x3C,0x66,0x66,0x66,0x66,0x3C,0,0,0,0,0,0,0}, // 111: o
  {0,0,0,0x7C,0x66,0x66,0x7C,0x60,0x60,0,0,0,0,0,0,0}, // 112: p
  {0,0,0,0x3E,0x66,0x66,0x3E,0x06,0x06,0,0,0,0,0,0,0}, // 113: q
  {0,0,0,0x6E,0x70,0x60,0x60,0x60,0x60,0,0,0,0,0,0,0}, // 114: r
  {0,0,0,0x3E,0x60,0x3C,0x06,0x66,0x3C,0,0,0,0,0,0,0}, // 115: s
  {0,0x30,0x30,0x7C,0x30,0x30,0x30,0x34,0x18,0,0,0,0,0,0,0}, // 116: t
  {0,0,0,0x66,0x66,0x66,0x66,0x66,0x3E,0,0,0,0,0,0,0}, // 117: u
  {0,0,0,0x66,0x66,0x66,0x66,0x3C,0x18,0,0,0,0,0,0,0}, // 118: v
  {0,0,0,0xC3,0xC3,0xDB,0xFF,0xE7,0x42,0,0,0,0,0,0,0}, // 119: w
  {0,0,0,0x66,0x3C,0x18,0x3C,0x66,0x66,0,0,0,0,0,0,0}, // 120: x
  {0,0,0,0x66,0x66,0x66,0x3E,0x06,0x66,0x3C,0,0,0,0,0,0}, // 121: y
  {0,0,0,0x7E,0x0C,0x18,0x30,0x60,0x7E,0,0,0,0,0,0,0}, // 122: z
  {0,0x0E,0x18,0x18,0x30,0x18,0x18,0x18,0x0E,0,0,0,0,0,0,0}, // 123: {
  {0,0x18,0x18,0x18,0x18,0x18,0x18,0x18,0x18,0,0,0,0,0,0,0}, // 124: |
  {0,0x70,0x18,0x18,0x0C,0x18,0x18,0x18,0x70,0,0,0,0,0,0}, // 125: }
  {0,0x76,0xDC,0,0,0,0,0,0,0,0,0,0,0,0,0}  // 126: ~
};

// 2. 초성 19자 (세로모음용 X:0~7, Y:1~10)
const uint16_t CHO_V[19][16] PROGMEM = {
  {0,0x7E00,0x0600,0x0600,0x0600,0x0600,0x0600,0x0600,0x0600,0,0,0,0,0,0,0}, // ㄱ
  {0,0x7E00,0x6600,0x6600,0x7E00,0x6600,0x6600,0x6600,0x6600,0,0,0,0,0,0,0}, // ㄲ
  {0,0x0600,0x0600,0x0600,0x0600,0x0600,0x0600,0x0600,0x7E00,0,0,0,0,0,0,0}, // ㄴ
  {0,0x7E00,0x0600,0x0600,0x0600,0x0600,0x0600,0x0600,0x7E00,0,0,0,0,0,0,0}, // ㄷ
  {0,0x7E00,0x6600,0x6600,0x7E00,0x6600,0x6600,0x6600,0x7E00,0,0,0,0,0,0,0}, // ㄸ
  {0,0x7E00,0x0600,0x0600,0x7E00,0x6000,0x6000,0x6000,0x7E00,0,0,0,0,0,0,0}, // ㄹ
  {0,0x7E00,0x6600,0x6600,0x6600,0x6600,0x6600,0x6600,0x7E00,0,0,0,0,0,0,0}, // ㅁ
  {0,0x6600,0x6600,0x6600,0x7E00,0x6600,0x6600,0x6600,0x7E00,0,0,0,0,0,0,0}, // ㅂ
  {0,0x6E00,0x6E00,0x6E00,0x7F00,0x6E00,0x6E00,0x6E00,0x7F00,0,0,0,0,0,0,0}, // ㅃ
  {0,0x1800,0x3C00,0x6600,0x6600,0x6600,0x6600,0x6600,0x6600,0,0,0,0,0,0,0}, // ㅅ
  {0,0x3C00,0x6600,0x7E00,0x6600,0x3C00,0x6600,0x7E00,0x6600,0,0,0,0,0,0,0}, // ㅆ
  {0,0x3C00,0x6600,0x6600,0x6600,0x6600,0x6600,0x6600,0x3C00,0,0,0,0,0,0,0}, // ㅇ
  {0,0x7E00,0x1800,0x3C00,0x6600,0x6600,0x6600,0x6600,0x6600,0,0,0,0,0,0,0}, // ㅈ
  {0,0x7E00,0x7E00,0x1800,0x3C00,0x6600,0x6600,0x6600,0x6600,0,0,0,0,0,0,0}, // ㅉ
  {0,0x1800,0x7E00,0x1800,0x3C00,0x6600,0x6600,0x6600,0x6600,0,0,0,0,0,0,0}, // ㅊ
  {0,0x7E00,0x0600,0x7E00,0x0600,0x0600,0x0600,0x0600,0x0600,0,0,0,0,0,0,0}, // ㅋ
  {0,0x7E00,0x0600,0x7E00,0x0600,0x0600,0x0600,0x0600,0x7E00,0,0,0,0,0,0,0}, // ㅌ
  {0,0x7E00,0x6600,0x6600,0x7E00,0x6600,0x6600,0x6600,0x7E00,0,0,0,0,0,0,0}, // ㅍ
  {0,0x1800,0x7E00,0x3C00,0x6600,0x6600,0x6600,0x3C00,0,0,0,0,0,0,0,0}  // ㅎ
};

// 3. 초성 19자 (가로모음용 X:2~13, Y:0~6)
const uint16_t CHO_H[19][16] PROGMEM = {
  {0x3FC0,0x0180,0x0180,0x0180,0x0180,0x0180,0,0,0,0,0,0,0,0,0,0}, // ㄱ
  {0x3FC0,0x1980,0x1980,0x3FC0,0x1980,0x1980,0,0,0,0,0,0,0,0,0,0}, // ㄲ
  {0x0180,0x0180,0x0180,0x0180,0x0180,0x3FC0,0,0,0,0,0,0,0,0,0,0}, // ㄴ
  {0x3FC0,0x0180,0x0180,0x0180,0x0180,0x3FC0,0,0,0,0,0,0,0,0,0,0}, // ㄷ
  {0x3FC0,0x1980,0x3FC0,0x1980,0x1980,0x3FC0,0,0,0,0,0,0,0,0,0,0}, // ㄸ
  {0x3FC0,0x0180,0x3FC0,0x1800,0x1800,0x3FC0,0,0,0,0,0,0,0,0,0,0}, // ㄹ
  {0x3FC0,0x1980,0x1980,0x1980,0x1980,0x3FC0,0,0,0,0,0,0,0,0,0,0}, // ㅁ
  {0x1980,0x1980,0x3FC0,0x1980,0x1980,0x3FC0,0,0,0,0,0,0,0,0,0,0}, // ㅂ
  {0x3DC0,0x3DC0,0x3FE0,0x3DC0,0x3DC0,0x3FE0,0,0,0,0,0,0,0,0,0,0}, // ㅃ
  {0x0700,0x0F80,0x19C0,0x10C0,0x19C0,0x0F80,0,0,0,0,0,0,0,0,0,0}, // ㅅ
  {0x0F80,0x19C0,0x10C0,0x19C0,0x0F80,0x19C0,0,0,0,0,0,0,0,0,0,0}, // ㅆ
  {0x0F80,0x19C0,0x10C0,0x10C0,0x19C0,0x0F80,0,0,0,0,0,0,0,0,0,0}, // ㅇ
  {0x3FC0,0x0700,0x0F80,0x19C0,0x10C0,0x19C0,0,0,0,0,0,0,0,0,0,0}, // ㅈ
  {0x3FC0,0x3FC0,0x0700,0x0F80,0x19C0,0x19C0,0,0,0,0,0,0,0,0,0,0}, // ㅉ
  {0x0700,0x3FC0,0x0700,0x0F80,0x19C0,0x19C0,0,0,0,0,0,0,0,0,0,0}, // ㅊ
  {0x3FC0,0x0180,0x3FC0,0x0180,0x0180,0x0180,0,0,0,0,0,0,0,0,0,0}, // ㅋ
  {0x3FC0,0x0180,0x3FC0,0x0180,0x0180,0x3FC0,0,0,0,0,0,0,0,0,0,0}, // ㅌ
  {0x3FC0,0x1980,0x3FC0,0x1980,0x1980,0x3FC0,0,0,0,0,0,0,0,0,0,0}, // ㅍ
  {0x0700,0x3FC0,0x0F80,0x19C0,0x10C0,0x0F80,0,0,0,0,0,0,0,0,0,0}  // ㅎ
};

// 4. 초성 19자 (받침 있는 글자용 X:0~7, Y:0~6 컴팩트)
const uint16_t CHO_J[19][16] PROGMEM = {
  {0x7E00,0x0600,0x0600,0x0600,0x0600,0,0,0,0,0,0,0,0,0,0,0}, // ㄱ
  {0x7E00,0x6600,0x7E00,0x6600,0x6600,0,0,0,0,0,0,0,0,0,0,0}, // ㄲ
  {0x0600,0x0600,0x0600,0x0600,0x7E00,0,0,0,0,0,0,0,0,0,0,0}, // ㄴ
  {0x7E00,0x0600,0x0600,0x0600,0x7E00,0,0,0,0,0,0,0,0,0,0,0}, // ㄷ
  {0x7E00,0x6600,0x7E00,0x6600,0x7E00,0,0,0,0,0,0,0,0,0,0,0}, // ㄸ
  {0x7E00,0x0600,0x7E00,0x6000,0x7E00,0,0,0,0,0,0,0,0,0,0,0}, // ㄹ
  {0x7E00,0x6600,0x6600,0x6600,0x7E00,0,0,0,0,0,0,0,0,0,0,0}, // ㅁ
  {0x6600,0x6600,0x7E00,0x6600,0x7E00,0,0,0,0,0,0,0,0,0,0,0}, // ㅂ
  {0x6E00,0x6E00,0x7F00,0x6E00,0x7F00,0,0,0,0,0,0,0,0,0,0,0}, // ㅃ
  {0x1800,0x3C00,0x6600,0x6600,0x6600,0,0,0,0,0,0,0,0,0,0,0}, // ㅅ
  {0x3C00,0x6600,0x7E00,0x6600,0x3C00,0,0,0,0,0,0,0,0,0,0,0}, // ㅆ
  {0x3C00,0x6600,0x6600,0x6600,0x3C00,0,0,0,0,0,0,0,0,0,0,0}, // ㅇ
  {0x7E00,0x1800,0x3C00,0x6600,0x6600,0,0,0,0,0,0,0,0,0,0,0}, // ㅈ
  {0x7E00,0x7E00,0x1800,0x3C00,0x6600,0,0,0,0,0,0,0,0,0,0,0}, // ㅉ
  {0x1800,0x7E00,0x1800,0x3C00,0x6600,0,0,0,0,0,0,0,0,0,0,0}, // ㅊ
  {0x7E00,0x0600,0x7E00,0x0600,0x0600,0,0,0,0,0,0,0,0,0,0,0}, // ㅋ
  {0x7E00,0x0600,0x7E00,0x0600,0x7E00,0,0,0,0,0,0,0,0,0,0,0}, // ㅌ
  {0x7E00,0x6600,0x7E00,0x6600,0x7E00,0,0,0,0,0,0,0,0,0,0,0}, // ㅍ
  {0x1800,0x7E00,0x3C00,0x6600,0x3C00,0,0,0,0,0,0,0,0,0,0,0}  // ㅎ
};

// 5. 중성 21자 (X:8~15, Y:0~15)
const uint16_t JUNG_T[21][16] PROGMEM = {
  {0x0030,0x0030,0x0030,0x0030,0x003E,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0}, // 0: ㅏ
  {0x0036,0x0036,0x0036,0x0036,0x003E,0x0036,0x0036,0x0036,0x0036,0x0036,0x0036,0x0036,0x0036,0x0036,0x0036,0}, // 1: ㅐ
  {0x0030,0x0030,0x003E,0x0030,0x003E,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0}, // 2: ㅑ
  {0x0036,0x0036,0x003E,0x0036,0x003E,0x0036,0x0036,0x0036,0x0036,0x0036,0x0036,0x0036,0x0036,0x0036,0x0036,0}, // 3: ㅒ
  {0x0030,0x0030,0x0030,0x0030,0x01F0,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0}, // 4: ㅓ
  {0x0036,0x0036,0x0036,0x0036,0x01F6,0x0036,0x0036,0x0036,0x0036,0x0036,0x0036,0x0036,0x0036,0x0036,0x0036,0}, // 5: ㅔ
  {0x0030,0x0030,0x01F0,0x0030,0x01F0,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0}, // 6: ㅕ
  {0x0036,0x0036,0x01F6,0x0036,0x01F6,0x0036,0x0036,0x0036,0x0036,0x0036,0x0036,0x0036,0x0036,0x0036,0x0036,0}, // 7: ㅖ
  {0,0,0,0,0,0x0180,0x0180,0xFFFE,0,0,0,0,0,0,0,0}, // 8: ㅗ
  {0,0,0,0x0030,0x0030,0x01B0,0x01B0,0xFFFE,0x003E,0x0030,0x0030,0x0030,0x0030,0,0,0}, // 9: ㅘ
  {0,0,0,0x0036,0x0036,0x01B6,0x01B6,0xFFFE,0x003E,0x0036,0x0036,0x0036,0x0036,0,0,0}, // 10: ㅙ
  {0,0,0,0x0030,0x0030,0x01B0,0x01B0,0xFFFE,0x0030,0x0030,0x0030,0x0030,0x0030,0,0,0}, // 11: ㅚ
  {0,0,0,0,0,0x0420,0x0420,0xFFFE,0,0,0,0,0,0,0,0}, // 12: ㅛ
  {0,0,0,0,0,0,0,0xFFFE,0x0180,0x0180,0,0,0,0,0,0}, // 13: ㅜ
  {0,0,0,0x0030,0x0030,0x01F0,0,0xFFFE,0x01B0,0x0030,0x0030,0x0030,0x0030,0,0,0}, // 14: ㅝ
  {0,0,0,0x0036,0x0036,0x01F6,0,0xFFFE,0x01B6,0x0036,0x0036,0x0036,0x0036,0,0,0}, // 15: ㅞ
  {0,0,0,0x0030,0x0030,0x0030,0,0xFFFE,0x01B0,0x0030,0x0030,0x0030,0x0030,0,0,0}, // 16: ㅟ
  {0,0,0,0,0,0,0,0xFFFE,0x0420,0x0420,0,0,0,0,0,0}, // 17: ㅠ
  {0,0,0,0,0,0,0,0xFFFE,0,0,0,0,0,0,0,0}, // 18: ㅡ
  {0,0,0,0x0030,0x0030,0x0030,0,0xFFFE,0x0030,0x0030,0x0030,0x0030,0x0030,0,0,0}, // 19: ㅢ
  {0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0x0030,0}  // 20: ㅣ
};

// 6. 종성 28자 (하단 9~15행 배치)
const uint16_t JONG_T[28][16] PROGMEM = {
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0}, // 0: 없음
  {0,0,0,0,0,0,0,0,0,0x7FC0,0x00C0,0x00C0,0x00C0,0x00C0,0,0}, // 1: ㄱ
  {0,0,0,0,0,0,0,0,0,0x7FC0,0x60C0,0x7FC0,0x60C0,0x60C0,0,0}, // 2: ㄲ
  {0,0,0,0,0,0,0,0,0,0x7FC0,0x01C0,0x0380,0x06C0,0x0440,0,0}, // 3: ㄳ
  {0,0,0,0,0,0,0,0,0,0x00C0,0x00C0,0x00C0,0x00C0,0x7FC0,0,0}, // 4: ㄴ
  {0,0,0,0,0,0,0,0,0,0x00C0,0x7FC0,0x0380,0x06C0,0x0440,0,0}, // 5: ㄵ
  {0,0,0,0,0,0,0,0,0,0x00C0,0x7FC0,0x0780,0x0DC0,0x0780,0,0}, // 6: ㄶ
  {0,0,0,0,0,0,0,0,0,0x7FC0,0x00C0,0x00C0,0x00C0,0x7FC0,0,0}, // 7: ㄷ
  {0,0,0,0,0,0,0,0,0,0x7FC0,0x00C0,0x7FC0,0x6000,0x7FC0,0,0}, // 8: ㄹ
  {0,0,0,0,0,0,0,0,0,0x7BC0,0x06C0,0x7BC0,0x00C0,0x00C0,0,0}, // 9: ㄺ
  {0,0,0,0,0,0,0,0,0,0x7BC0,0x06C0,0x7BC0,0x60C0,0x7FC0,0,0}, // 10: ㄻ
  {0,0,0,0,0,0,0,0,0,0x7BC0,0x06C0,0x7BC0,0x60C0,0x7FC0,0,0}, // 11: ㄼ
  {0,0,0,0,0,0,0,0,0,0x77C0,0x06C0,0x0380,0x06C0,0x0440,0,0}, // 12: ㄽ
  {0,0,0,0,0,0,0,0,0,0x7FC0,0x00C0,0x7FC0,0x00C0,0x7FC0,0,0}, // 13: ㄾ
  {0,0,0,0,0,0,0,0,0,0x7FC0,0x06C0,0x7FC0,0x60C0,0x7FC0,0,0}, // 14: ㄿ
  {0,0,0,0,0,0,0,0,0,0x7FC0,0x0380,0x0780,0x0DC0,0x0780,0,0}, // 15: ㅀ
  {0,0,0,0,0,0,0,0,0,0x7FC0,0x60C0,0x60C0,0x60C0,0x7FC0,0,0}, // 16: ㅁ
  {0,0,0,0,0,0,0,0,0,0x60C0,0x60C0,0x7FC0,0x60C0,0x7FC0,0,0}, // 17: ㅂ
  {0,0,0,0,0,0,0,0,0,0x60C0,0x7FC0,0x0380,0x06C0,0x0440,0,0}, // 18: ㅄ
  {0,0,0,0,0,0,0,0,0,0x0380,0x07C0,0x0DC0,0x0900,0x0DC0,0,0}, // 19: ㅅ
  {0,0,0,0,0,0,0,0,0,0x07C0,0x0DC0,0x0900,0x0DC0,0x07C0,0,0}, // 20: ㅆ
  {0,0,0,0,0,0,0,0,0,0x0780,0x0DC0,0x0900,0x0900,0x0780,0,0}, // 21: ㅇ
  {0,0,0,0,0,0,0,0,0,0x7FC0,0x0380,0x07C0,0x0DC0,0x0900,0,0}, // 22: ㅈ
  {0,0,0,0,0,0,0,0,0,0x0380,0x7FC0,0x0380,0x07C0,0x0DC0,0,0}, // 23: ㅊ
  {0,0,0,0,0,0,0,0,0,0x7FC0,0x00C0,0x7FC0,0x00C0,0x00C0,0,0}, // 24: ㅋ
  {0,0,0,0,0,0,0,0,0,0x7FC0,0x00C0,0x7FC0,0x00C0,0x7FC0,0,0}, // 25: ㅌ
  {0,0,0,0,0,0,0,0,0,0x7FC0,0x60C0,0x7FC0,0x60C0,0x7FC0,0,0}, // 26: ㅍ
  {0,0,0,0,0,0,0,0,0,0x0380,0x7FC0,0x0780,0x0DC0,0x0780,0,0}  // 27: ㅎ
};

// 단일 ASCII 문자 8x16 비트맵 렌더러
void drawAsciiChar(int16_t x, int16_t y, char c, uint16_t color, uint16_t bg, uint8_t size = 1) {
  if (c < 32 || c > 126) c = '?';
  uint8_t idx = c - 32;

  for (int row = 0; row < 16; row++) {
    uint8_t line = pgm_read_byte(&(ASCII_FONT_8x16[idx][row]));
    for (int col = 0; col < 8; col++) {
      bool pixelOn = (line & (0x80 >> col)) != 0;
      if (pixelOn) {
        if (size == 1) tft.drawPixel(x + col, y + row, color);
        else tft.fillRect(x + col * size, y + row * size, size, size, color);
      } else if (bg != 0) {
        if (size == 1) tft.drawPixel(x + col, y + row, bg);
        else tft.fillRect(x + col * size, y + row * size, size, size, bg);
      }
    }
  }
}

// 고품질 조합형 3벌식 완성 한글 16x16 비트맵 렌더러
void drawHangulChar(int16_t x, int16_t y, uint16_t unicode, uint16_t color, uint16_t bg, uint8_t size = 1) {
  if (unicode < 0xAC00 || unicode > 0xD7A3) return;
  uint16_t code = unicode - 0xAC00;
  uint8_t cho = code / 588;          // 초성 0 ~ 18
  uint8_t jung = (code % 588) / 28;  // 중성 0 ~ 20
  uint8_t jong = code % 28;          // 종성 0 ~ 27

  // 모음 유형 판단
  // 가로 모음 (ㅗ, ㅛ, ㅜ, ㅠ, ㅡ)
  bool isHoriz = (jung == 8 || jung == 12 || jung == 13 || jung == 17 || jung == 18);
  bool hasJong = (jong > 0);

  for (int row = 0; row < 16; row++) {
    // 1. 초성 선택: 받침 있음(CHO_J) vs 가로모음(CHO_H) vs 세로모음(CHO_V)
    uint16_t cLine = 0;
    if (hasJong) {
      cLine = pgm_read_word(&(CHO_J[cho][row]));
    } else if (isHoriz) {
      cLine = pgm_read_word(&(CHO_H[cho][row]));
    } else {
      cLine = pgm_read_word(&(CHO_V[cho][row]));
    }

    // 2. 중성
    uint16_t uLine = pgm_read_word(&(JUNG_T[jung][row]));

    // 3. 종성
    uint16_t jLine = hasJong ? pgm_read_word(&(JONG_T[jong][row])) : 0;

    // 3벌 결합
    uint16_t merged = cLine | uLine | jLine;

    for (int col = 0; col < 16; col++) {
      bool pixelOn = (merged & (0x8000 >> col)) != 0;
      if (pixelOn) {
        if (size == 1) {
          tft.drawPixel(x + col, y + row, color);
        } else {
          tft.fillRect(x + col * size, y + row * size, size, size, color);
        }
      } else if (bg != 0) {
        if (size == 1) {
          tft.drawPixel(x + col, y + row, bg);
        } else {
          tft.fillRect(x + col * size, y + row * size, size, size, bg);
        }
      }
    }
  }
}



unsigned long expressionUntil = 0;
bool customExpression = false;
bool sleeping = false;
uint32_t replyClient = 0;
uint8_t replySource = 0;
String replyId;

void sendReply(const char* state, const char* reason = "", bool includeIp = false) {
  StaticJsonDocument<256> doc;
  doc["id"] = replyId;
  doc["state"] = state;
  if (reason[0]) doc["reason"] = reason;
  if (includeIp) {
    doc["protocol"] = 1;
    if (WiFi.status() == WL_CONNECTED) doc["ip"] = WiFi.localIP().toString();
  }
  String json;
  serializeJson(doc, json);
  if (replySource == 2) ws.text(replyClient, json);
  else if (replySource == 1 && deviceConnected) {
    // 최소 BLE MTU에서도 응답이 잘리지 않도록 줄바꿈 단위로 분할한다.
    json += "\n";
    for (size_t i = 0; i < json.length(); i += 20) {
      String chunk = json.substring(i, i + 20);
      pNotifyCharacteristic->setValue(chunk.c_str());
      pNotifyCharacteristic->notify();
      delay(15);
    }
  } else Serial.println(json);
}

bool enqueueMessage(const char* data, size_t len, uint8_t source, uint32_t clientId = 0) {
  if (len == 0 || len >= 2048) return false;
  IncomingMessage message = {};
  memcpy(message.json, data, len);
  message.source = source;
  message.clientId = clientId;
  return xQueueSend(incomingQueue, &message, 0) == pdTRUE;
}

String bleInput;
bool bleOverflow = false;
class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer*) override { deviceConnected = true; }
  void onDisconnect(BLEServer*) override {
    deviceConnected = false;
    bleInput = ""; bleOverflow = false;
    BLEDevice::startAdvertising();
  }
};
class MyWriteCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    auto value = characteristic->getValue();
    for (size_t i = 0; i < value.length(); ++i) {
      char ch = value[i];
      if (ch == '\n') {
        if (!bleOverflow && bleInput.length()) enqueueMessage(bleInput.c_str(), bleInput.length(), 1);
        bleInput = ""; bleOverflow = false;
      } else if (!bleOverflow) {
        if (bleInput.length() >= 2047) { bleInput = ""; bleOverflow = true; }
        else bleInput += ch;
      }
    }
    // 기존 JSON 전체 쓰기 클라이언트도 지원한다.
    if (!bleOverflow && bleInput.endsWith("}")) {
      StaticJsonDocument<2048> doc;
      if (!deserializeJson(doc, bleInput)) {
        enqueueMessage(bleInput.c_str(), bleInput.length(), 1);
        bleInput = "";
      }
    }
  }
};

void setupBLE() {
  BLEDevice::init(__SODA_BLE_NAME__);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService* service = pServer->createService(SERVICE_UUID);
  BLECharacteristic* write = service->createCharacteristic(CHAR_WRITE_UUID, BLECharacteristic::PROPERTY_WRITE);
  write->setCallbacks(new MyWriteCallbacks());
  pNotifyCharacteristic = service->createCharacteristic(CHAR_NOTIFY_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  pNotifyCharacteristic->addDescriptor(new BLE2902());
  service->start();

  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->setMinPreferred(0x06);
  advertising->setMinPreferred(0x12);

  BLEAdvertisementData advData;
  advData.setName(__SODA_BLE_NAME__);
  advData.setCompleteServices(BLEUUID(SERVICE_UUID));
  advertising->setAdvertisementData(advData);

  BLEAdvertisementData scanData;
  scanData.setName(__SODA_BLE_NAME__);
  advertising->setScanResponseData(scanData);

  BLEDevice::startAdvertising();
}

inline uint32_t getUtf8Code(const String& s, size_t& i) {
  if (i >= s.length()) return 0;
  uint8_t c = (uint8_t)s[i];
  if (c < 0x80) { ++i; return c; }
  uint32_t code = c;
  size_t count = 1;
  if ((c & 0xE0) == 0xC0) { code = c & 0x1F; count = 2; }
  else if ((c & 0xF0) == 0xE0) { code = c & 0x0F; count = 3; }
  else if ((c & 0xF8) == 0xF0) { code = c & 0x07; count = 4; }
  if (i + count > s.length()) { i = s.length(); return 0; }
  for (size_t n = 1; n < count; ++n) {
    code = (code << 6) | ((uint8_t)s[i + n] & 0x3F);
  }
  i += count;
  return code;
}

inline int getGlyphWidth(uint32_t code, uint8_t size) {
  if (code >= 0xAC00 && code <= 0xD7A3) return 16 * size; // 한글: 16px * size
  if (code == ' ') return 6 * size;                       // 공백: 6px * size
  if (code == '\t') return 16 * size;
  return 8 * size;                                        // 영문/숫자/기호: 8px * size
}

uint16_t parseHexColor565(const String& hex, uint16_t defaultColor = 0x269D) {
  if (hex.length() < 6) return defaultColor;
  String clean = hex;
  if (clean.startsWith("#")) clean = clean.substring(1);
  if (clean.length() < 6) return defaultColor;
  long rgb = strtol(clean.c_str(), NULL, 16);
  uint8_t r = (rgb >> 16) & 0xFF;
  uint8_t g = (rgb >> 8) & 0xFF;
  uint8_t b = rgb & 0xFF;
  return tft.color565(r, g, b);
}

void drawMessageWithStyle(const String& message, uint8_t reqSize = 0, uint16_t textColor = ST77XX_WHITE, uint16_t bgColor = ST77XX_BLACK, int offsetY = 0) {
  if (offsetY == 0) tft.fillScreen(bgColor);
  tft.setTextWrap(false);
  if (message.length() == 0) return;

  // 1. 전체 글자 수 및 개행 분석
  int totalGlyphs = 0;
  bool hasNewline = false;
  int maxLineLength = 0;
  int currentLineLen = 0;
  int newlineCount = 0;
  for (size_t i = 0; i < message.length();) {
    uint8_t c = (uint8_t)message[i];
    if (c == '\r') { ++i; continue; }
    if (c == '\n') { 
      hasNewline = true; 
      newlineCount++;
      if (currentLineLen > maxLineLength) maxLineLength = currentLineLen;
      currentLineLen = 0;
      ++i; 
      continue; 
    }
    getUtf8Code(message, i);
    totalGlyphs++;
    currentLineLen++;
  }
  if (currentLineLen > maxLineLength) maxLineLength = currentLineLen;

  // 2. 글자 크기(size) 결정
  uint8_t size = reqSize;
  if (size == 0) {
    if (offsetY > 0) {
      size = (maxLineLength <= 20 && newlineCount <= 3) ? 2 : 1;
    } else {
      if (totalGlyphs <= 6 && !hasNewline) size = 3;
      else if (maxLineLength <= 20 && newlineCount <= 4 && totalGlyphs <= 70) size = 2;
      else size = 1;
    }
  }
  if (size < 1) size = 1;
  if (size > 3) size = 3;

  int lineH = (16 * size) + (size == 1 ? 4 : (size == 2 ? 8 : 10));
  int maxW = 310;

  struct LineInfo {
    size_t startByte;
    size_t endByte;
    int width;
  };
  constexpr int MAX_LINES = 12;
  LineInfo lines[MAX_LINES];
  int lineCount = 0;

  size_t currentLineStart = 0;
  int currentLineW = 0;

  for (size_t i = 0; i < message.length() && lineCount < MAX_LINES;) {
    size_t charStart = i;
    uint8_t c = (uint8_t)message[i];
    if (c == '\r') { ++i; continue; }
    if (c == '\n') {
      lines[lineCount++] = { currentLineStart, charStart, currentLineW };
      ++i;
      currentLineStart = i;
      currentLineW = 0;
      continue;
    }

    uint32_t code = getUtf8Code(message, i);
    if (code == 0) break;
    int gw = getGlyphWidth(code, size);

    if (currentLineW + gw > maxW && currentLineW > 0) {
      lines[lineCount++] = { currentLineStart, charStart, currentLineW };
      currentLineStart = charStart;
      currentLineW = gw;
    } else {
      currentLineW += gw;
    }
  }
  if (currentLineStart < message.length() && lineCount < MAX_LINES) {
    lines[lineCount++] = { currentLineStart, message.length(), currentLineW };
  }
  if (lineCount == 0) return;

  // 수직 정렬
  int totalH = lineCount * lineH - (size == 1 ? 4 : (size == 2 ? 8 : 10));
  int startY = offsetY > 0 ? offsetY : ((240 - totalH) / 2);
  if (startY < 8) startY = 8;

  // 렌더링
  for (int l = 0; l < lineCount; l++) {
    int startX = (320 - lines[l].width) / 2;
    if (startX < 6) startX = 6;
    int curX = startX;
    int curY = startY + l * lineH;
    if (curY + (16 * size) > 236) break;

    for (size_t i = lines[l].startByte; i < lines[l].endByte;) {
      uint8_t c = (uint8_t)message[i];
      if (c == '\r' || c == '\n') { ++i; continue; }
      uint32_t code = getUtf8Code(message, i);
      if (code == 0) break;
      int gw = getGlyphWidth(code, size);

      if (code >= 0xAC00 && code <= 0xD7A3) {
        drawHangulChar(curX, curY, code, textColor, bgColor, size);
      } else if (code >= 32 && code <= 126) {
        drawAsciiChar(curX, curY, (char)code, textColor, bgColor, size);
      }
      curX += gw;
    }
  }
}

void drawMessage(const String& message, uint8_t reqSize = 0) {
  drawMessageWithStyle(message, reqSize, ST77XX_WHITE, LCD_BG_COLOR, 0);
}

// ── 영구 플래시 저장소 (NVS Preferences) ────────────────────────────────────
Preferences prefs;
String welcomeMsg = "HELLO!\nI AM LUMI :)\nNICE TO SEE YOU TODAY!";

String defaultIdleExpr = "default"; // 기본 펌웨어 기본 표정: "default"
String standbyMode = "default";    // "default", "clock", "weather", "off", etc.
unsigned long standbyTimeoutMs = 30000; // 30초 (기본값)
unsigned long lastActivityTime = 0;
bool isStandbyActive = false;

// 물리 버튼 기본 동작
String btnSingleAction = "random_face";
String btnDoubleAction = "happy_face";
String btnLongAction = "greeting";

void loadSettingsFromNVS() {
  if (prefs.begin("sodabot", true)) { // 읽기 모드로 오픈
    welcomeMsg = prefs.getString("welcome", "HELLO!\nI AM LUMI :)\nNICE TO SEE YOU TODAY!");
    defaultIdleExpr = prefs.getString("idle_expr", "default");
    standbyMode = prefs.getString("standby", "default");
    btnSingleAction = prefs.getString("btn_single", "random_face");
    btnDoubleAction = prefs.getString("btn_double", "happy_face");
    btnLongAction = prefs.getString("btn_long", "greeting");
    prefs.end();
  }
}

void saveWelcomeMsgToNVS(const String& msg) {
  if (prefs.begin("sodabot", false)) {
    prefs.putString("welcome", msg);
    prefs.end();
  }
}

void saveIdleExprToNVS(const String& expr) {
  if (prefs.begin("sodabot", false)) {
    prefs.putString("idle_expr", expr);
    prefs.end();
  }
}

void saveStandbyModeToNVS(const String& mode) {
  if (prefs.begin("sodabot", false)) {
    prefs.putString("standby", mode);
    prefs.end();
  }
}

void saveButtonActionsToNVS(const String& s, const String& d, const String& l) {
  if (prefs.begin("sodabot", false)) {
    if (s.length() > 0) prefs.putString("btn_single", s);
    if (d.length() > 0) prefs.putString("btn_double", d);
    if (l.length() > 0) prefs.putString("btn_long", l);
    prefs.end();
  }
}

// ── 대기 화면 (Standby Screen) 엔진 ─────────────────────────────────────────
void renderDefaultIdleFace() {
  if (defaultIdleExpr == "happy") happyEyes();
  else if (defaultIdleExpr == "wink") winkEyes();
  else if (defaultIdleExpr == "surprised") surprisedEyes();
  else if (defaultIdleExpr == "heart") heartEyes();
  else if (defaultIdleExpr == "pupil") pupilEyes();
  else if (defaultIdleExpr == "sleepy") sleepyEyes();
  else if (defaultIdleExpr == "cat") catFace();
  else if (defaultIdleExpr == "sad") sadEyes();
  else if (defaultIdleExpr == "angry") angryEyes();
  else if (defaultIdleExpr == "confused") confusedEyes();
  else if (defaultIdleExpr == "squint") squintEyes();
  else idleEyes(); // "default" 기본 표정
  sleeping = (defaultIdleExpr == "sleepy");
  customExpression = false;
}

void renderStandbyScreen() {
  if (standbyMode == "clock" || standbyMode.indexOf("시계") >= 0 || standbyMode.indexOf("clock") >= 0) {
    drawMessage("TIME\n12:00", 0);
  } else if (standbyMode == "weather" || standbyMode.indexOf("날씨") >= 0 || standbyMode.indexOf("weather") >= 0) {
    drawMessage("WEATHER\nSUNNY 24C", 0);
  } else if (standbyMode == "off" || standbyMode.indexOf("화면 끄기") >= 0 || standbyMode.indexOf("off") >= 0) {
    tft.fillScreen(ST77XX_BLACK);
  } else {
    renderDefaultIdleFace();
  }
}

// ── 단일 물리 버튼 (GPIO 4) 처리 로직 ──────────────────────────────────────────────
const char* EXPRESSIONS_POOL[] = { "happy", "wink", "surprised", "heart", "pupil", "sleepy", "cat" };
int exprPoolIndex = 0;

void broadcastButtonEvent(const char* type, const String& action) {
  String json = "{\"event\":\"button_pressed\",\"type\":\"" + String(type) + "\",\"action\":\"" + action + "\"}";
  ws.textAll(json);
  if (deviceConnected && pNotifyCharacteristic) {
    String bleMsg = json + "\n";
    pNotifyCharacteristic->setValue((uint8_t*)bleMsg.c_str(), bleMsg.length());
    pNotifyCharacteristic->notify();
  }
  Serial.println(json);
}

void triggerExpressionByName(const String& name) {
  if (name == "happy") happyEyes();
  else if (name == "wink") winkEyes();
  else if (name == "surprised") surprisedEyes();
  else if (name == "heart") heartEyes();
  else if (name == "pupil") pupilEyes();
  else if (name == "sleepy") sleepyEyes();
  else if (name == "cat") catFace();
  else if (name == "sad") sadEyes();
  else if (name == "angry") angryEyes();
  else idleEyes();
  sleeping = (name == "sleepy");
  customExpression = (name != "idle" && name != "default" && !sleeping);
  expressionUntil = millis() + 3000;
}

// ==============================================================================
// 🎓 커스텀 아두이노 기능 (날씨 및 사용자 함수 영역)
// ==============================================================================

// 날씨 정보 가져오기 및 LCD 출력 함수
void showTodayWeather() {
  Serial.println("[WEATHER] start");

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WEATHER] Wi-Fi not connected");
    drawMessage("Wi-Fi 연결 안됨", 0);
    sleeping = false; customExpression = true; expressionUntil = millis() + 5000;
    return;
  }
  Serial.println("[WEATHER] WiFi OK");

  WiFiClientSecure client;
  client.setInsecure(); // SSL 인증서 검증 생략
  HTTPClient http;

  String url = "https://api.open-meteo.com/v1/forecast?latitude=" + String(WEATHER_LATITUDE) +
               "&longitude=" + String(WEATHER_LONGITUDE) +
               "&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul";

  if (!http.begin(client, url)) {
    Serial.println("[WEATHER] HTTP begin failed");
    drawMessage("날씨 연결 실패", 0);
    sleeping = false; customExpression = true; expressionUntil = millis() + 5000;
    return;
  }

  int httpCode = http.GET();
  Serial.printf("[WEATHER] HTTP code: %d\n", httpCode);

  if (httpCode != HTTP_CODE_OK) {
    Serial.println("[WEATHER] HTTP response error");
    drawMessage("날씨 서버 오류", 0);
    http.end();
    sleeping = false; customExpression = true; expressionUntil = millis() + 5000;
    return;
  }

  String response = http.getString();
  http.end();

  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, response);
  if (error) {
    Serial.println("[WEATHER] JSON parse error");
    drawMessage("날씨 분석 실패", 0);
    sleeping = false; customExpression = true; expressionUntil = millis() + 5000;
    return;
  }

  int weatherCode = doc["daily"]["weather_code"][0] | 0;
  float maxTemp = doc["daily"]["temperature_2m_max"][0] | 0.0;
  float minTemp = doc["daily"]["temperature_2m_min"][0] | 0.0;

  String status = "맑음";
  if (weatherCode == 1 || weatherCode == 2 || weatherCode == 3) status = "구름 조금";
  else if (weatherCode >= 45 && weatherCode <= 48) status = "안개";
  else if (weatherCode >= 51 && weatherCode <= 67) status = "비";
  else if (weatherCode >= 71 && weatherCode <= 77) status = "눈";
  else if (weatherCode >= 80 && weatherCode <= 82) status = "소나기";
  else if (weatherCode >= 95) status = "뇌우";

  String result = "오늘 날씨: " + status + "\n최저: " + String(minTemp, 1) + "C / 최고: " + String(maxTemp, 1) + "C";
  drawMessage(result, 0);
  sleeping = false;
  customExpression = true;
  expressionUntil = millis() + 10000;

  Serial.println("[WEATHER] success");
  Serial.println(result);
}

// === CUSTOM_FUNCTIONS_START ===
// === CUSTOM_FUNCTIONS_END ===

// 사용자 함수 슬롯 1 (SODA TALK: CUSTOM_1)
void customFunction1() {
  Serial.println("[MY FUNCTION] customFunction1() 실행");
  showTodayWeather();
}

// 사용자 함수 슬롯 2 (SODA TALK: CUSTOM_2)
void customFunction2() {
  Serial.println("[MY FUNCTION] customFunction2() 실행");
  // [학생 실습 코딩 영역]: 예: 날씨 알리미, 카운트다운 등
  drawMessage("MY FUNCTION 2\ncustomFunction2()", 0);
  sleeping = false; customExpression = true; expressionUntil = millis() + 3000;
  if (speakerReady) playToneI2S(1200, 100);
}

// 사용자 함수 슬롯 3 (SODA TALK: CUSTOM_3)
void customFunction3() {
  Serial.println("[MY FUNCTION] customFunction3() 실행");
  // [학생 실습 코딩 영역]: 예: AI 질문, 반응 효과 등
  drawMessage("MY FUNCTION 3\ncustomFunction3()", 0);
  sleeping = false; customExpression = true; expressionUntil = millis() + 3000;
  if (speakerReady) playToneI2S(1400, 100);
}

// 사용자 슬롯 명령(CUSTOM_1, CUSTOM_2, CUSTOM_3, WEATHER) 분기 핸들러
void handleUserCustomFunction(const String& cmd) {
  String upperCmd = cmd;
  upperCmd.toUpperCase();
  upperCmd.trim();

  if (upperCmd == "WEATHER" || upperCmd == "날씨" || upperCmd == "SHOWTODAYWEATHER") {
    showTodayWeather();
    return;
  }

  if (upperCmd == "CUSTOM_1" || upperCmd == "CUSTOMFUNCTION1" || upperCmd == "1") {
    customFunction1();
  } else if (upperCmd == "CUSTOM_2" || upperCmd == "CUSTOMFUNCTION2" || upperCmd == "2") {
    customFunction2();
  } else if (upperCmd == "CUSTOM_3" || upperCmd == "CUSTOMFUNCTION3" || upperCmd == "3") {
    customFunction3();
  } else {
    customFunction1();
  }
}

void executeLocalButtonAction(const String& act, const char* clickType) {
  lastActivityTime = millis();
  if (isStandbyActive) { isStandbyActive = false; }
  broadcastButtonEvent(clickType, act);

  // 1. 사용자 정의 함수 (custom:xxx 또는 사용자 등록 함수명) 처리
  if (act.startsWith("custom:")) {
    String fn = act.substring(7);
    handleUserCustomFunction(fn);
    return;
  }

  // 2. 기본 내장 기능 처리
  if (act == "weather" || act == "날씨") {
    showTodayWeather();
  } else if (act == "random_face") {
    int count = sizeof(EXPRESSIONS_POOL) / sizeof(EXPRESSIONS_POOL[0]);
    int r = random(0, count);
    triggerExpressionByName(EXPRESSIONS_POOL[r]);
    if (speakerReady) playToneI2S(1200, 50);
  } else if (act == "next_face") {
    int count = sizeof(EXPRESSIONS_POOL) / sizeof(EXPRESSIONS_POOL[0]);
    exprPoolIndex = (exprPoolIndex + 1) % count;
    triggerExpressionByName(EXPRESSIONS_POOL[exprPoolIndex]);
    if (speakerReady) playToneI2S(1000, 50);
  } else if (act == "happy_face" || act == "happy") {
    triggerExpressionByName("happy");
    if (speakerReady) playToneI2S(1000, 80);
  } else if (act == "wink_face" || act == "wink") {
    triggerExpressionByName("wink");
    if (speakerReady) playToneI2S(1100, 80);
  } else if (act == "greeting") {
    drawMessage(welcomeMsg.length() > 0 ? welcomeMsg : "HELLO!\nI AM LUMI :)", 0);
    sleeping = false; customExpression = true; expressionUntil = millis() + 4000;
    if (speakerReady) { playToneI2S(523, 120); playToneI2S(659, 120); playToneI2S(784, 200); }
  } else if (act == "play_sound") {
    if (speakerReady) { playToneI2S(400, 100); playToneI2S(600, 150); }
  } else if (act == "default_face" || act == "default") {
    idleEyes();
    customExpression = false; sleeping = false;
    if (speakerReady) playToneI2S(800, 60);
  } else {
    // 등록된 사용자 함수명이 직접 전달되었거나 알 수 없는 액션일 경우 사용자 함수 핸들러로 전달
    handleUserCustomFunction(act);
  }
}

void checkHardwareButton() {
  static bool lastBtnState = HIGH;
  static unsigned long pressStartTime = 0;
  static unsigned long lastReleaseTime = 0;
  static int clickCount = 0;
  static bool longPressTriggered = false;

  static bool rawBtnState = HIGH;
  static bool stableBtnState = HIGH;
  static unsigned long rawChangedAt = 0;
  unsigned long now = millis();
  bool raw = digitalRead(BUTTON_PIN);
  if (raw != rawBtnState) { rawBtnState = raw; rawChangedAt = now; }
  if (now - rawChangedAt >= 30) stableBtnState = raw;
  bool currentBtnState = stableBtnState;

  // 버튼 눌림 시작 (Falling Edge: HIGH -> LOW)
  if (lastBtnState == HIGH && currentBtnState == LOW) {
    pressStartTime = now;
    longPressTriggered = false;
    lastActivityTime = now;
    if (isStandbyActive) { isStandbyActive = false; idleEyes(); }
  }
  // 버튼 누르고 있는 중 (LOW 유지)
  else if (lastBtnState == LOW && currentBtnState == LOW) {
    if (!longPressTriggered && (now - pressStartTime >= 750)) {
      longPressTriggered = true;
      clickCount = 0;
      executeLocalButtonAction(btnLongAction, "long");
    }
  }
  // 버튼에서 손을 뗌 (Rising Edge: LOW -> HIGH)
  else if (lastBtnState == LOW && currentBtnState == HIGH) {
    unsigned long pressDuration = now - pressStartTime;
    if (!longPressTriggered && pressDuration >= 20 && pressDuration < 750) {
      clickCount++;
      lastReleaseTime = now;
      if (clickCount >= 2) {
        executeLocalButtonAction(btnDoubleAction, "double");
        clickCount = 0;
      }
    }
  }

  // 1회 클릭 후 더블 클릭 대기 시간(320ms) 만료 시 싱글 클릭 확정 실행
  if (clickCount == 1 && (now - lastReleaseTime > 320)) {
    executeLocalButtonAction(btnSingleAction, "single");
    clickCount = 0;
  }

  lastBtnState = currentBtnState;
}

void startWebServerIfReady() {
  if (!webServerStarted && WiFi.status() == WL_CONNECTED) {
    server.begin();
    webServerStarted = true;
    Serial.println("명령 수신 주소: ws://" + WiFi.localIP().toString() + ":8080/soda/ws");
  }
}

void processMessage(const IncomingMessage& message) {
  replySource = message.source; replyClient = message.clientId; replyId = "";
  DynamicJsonDocument doc(2560);
  String raw(message.json); raw.trim();
  String action, value;
  if (raw.startsWith("{")) {
    if (deserializeJson(doc, raw)) { sendReply("error", "invalid_json"); return; }
    replyId = doc["id"] | "";
    action = doc["action"] | ""; value = doc["value"] | "";
  } else {
    // 예전 웹의 HAPPY / MSG:내용 / SOUND:GREETING 형식도 수용한다.
    int colon = raw.indexOf(':');
    String prefix = colon < 0 ? raw : raw.substring(0, colon); prefix.toUpperCase();
    if (prefix == "MSG" || prefix == "TEXT" || prefix == "TALK" || prefix == "WELCOME" || prefix == "PROFILE") {
      action = "send_message"; value = raw.substring(colon + 1);
    } else if (prefix == "SOUND") { action = "play_sound"; value = raw.substring(colon + 1); }
    else if (prefix == "BEEP" || prefix == "GREETING" || prefix == "POWER_ON" || prefix == "BUTTON_CLICK" || prefix == "TOUCH_REACT") {
      action = "play_sound"; value = prefix;
    } else { action = "set_expression"; value = raw; }
  }
  if (action == "get_status") { sendReply("success", "", true); return; }
  if (action == "configure_wifi" || doc["ssid"].is<const char*>()) {
    if (!doc["ssid"].is<const char*>() || !doc["password"].is<const char*>()) { sendReply("error", "invalid_wifi"); return; }
    WiFi.begin(doc["ssid"].as<const char*>(), doc["password"].as<const char*>());
    unsigned long started = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) delay(20);
    startWebServerIfReady(); // 성공 알림 전에 명령 수신 서버를 준비한다.
    sendReply(WiFi.status() == WL_CONNECTED ? "success" : "error", WiFi.status() == WL_CONNECTED ? "" : "wifi_failed", true);
    return;
  }
  if (action == "set_expression") {
    value.toLowerCase();
    if (value == "happy") happyEyes();
    else if (value == "sad") sadEyes();
    else if (value == "angry") angryEyes();
    else if (value == "sleepy") sleepyEyes();
    else if (value == "surprised") surprisedEyes();
    else if (value == "wink") winkEyes();
    else if (value == "heart") heartEyes();
    else if (value == "confused") confusedEyes();
    else if (value == "squint") squintEyes();
    else if (value == "thinking") thinkingEyes();
    else if (value == "listening") listeningEyes();
    else if (value == "pupil") pupilEyes();
    else if (value == "cat") catFace();
    else if (value == "tongue" || value == "tease") { winkEyes(); }
    else if (value == "sparkle" || value == "star") { pupilEyes(); }
    else if (value == "idle" || value == "default") idleEyes();
    else { idleEyes(); }
    sleeping = value == "sleepy";
    customExpression = !sleeping && value != "idle" && value != "default";
    expressionUntil = millis() + 3000;
  } else if (action == "render_pixels") {
    if (doc["pixels"].is<JsonArrayConst>()) {
      renderPixelsFromDoc(doc["pixels"].as<JsonArrayConst>());
    } else if (value.startsWith("{")) {
      DynamicJsonDocument subDoc(1536);
      if (!deserializeJson(subDoc, value) && subDoc["pixels"].is<JsonArrayConst>()) {
        renderPixelsFromDoc(subDoc["pixels"].as<JsonArrayConst>());
      }
    }
    sleeping = false; customExpression = true; expressionUntil = millis() + 4000;
  } else if (action == "render_face") {
    if (value.startsWith("{")) {
      DynamicJsonDocument subDoc(1024);
      if (!deserializeJson(subDoc, value)) {
        renderCustomFace(subDoc);
      } else {
        renderCustomFace(doc);
      }
    } else {
      renderCustomFace(doc);
    }
    sleeping = false; customExpression = true; expressionUntil = millis() + 4000;
  } else if (action == "draw_bitmap" || action == "render_bitmap") {
    if (value.startsWith("{")) {
      DynamicJsonDocument subDoc(4096);
      if (!deserializeJson(subDoc, value)) {
        renderBitmapFromDoc(subDoc);
      } else {
        renderBitmapFromDoc(doc);
      }
    } else {
      renderBitmapFromDoc(doc);
    }
    sleeping = false; customExpression = true; expressionUntil = millis() + 10000;
  } else if (action == "send_message" || action == "talk" || action == "set_profile" || action == "test_startup_prompt") {
    if (value.length() == 0 || value.length() > 360) { sendReply("error", "text_length_1_to_360_bytes"); return; }
    uint8_t reqSize = doc["size"] | 0;
    drawMessage(value, reqSize);
    sleeping = false; customExpression = true; expressionUntil = millis() + 10000;
  } else if (action == "set_welcome" || action == "set_welcome_screen") {
    if (value.startsWith("{")) {
      DynamicJsonDocument welDoc(512);
      if (!deserializeJson(welDoc, value) && welDoc.containsKey("text")) {
        welcomeMsg = welDoc["text"].as<String>();
      }
    } else {
      if (value.length() > 0 && value.length() <= 360) welcomeMsg = value;
    }
    saveWelcomeMsgToNVS(welcomeMsg);
    drawMessage(welcomeMsg, 0);
    sleeping = false; customExpression = true; expressionUntil = millis() + 4000;
  } else if (action == "set_button_action") {
    if (value.startsWith("{")) {
      DynamicJsonDocument btnDoc(512);
      if (!deserializeJson(btnDoc, value)) {
        if (btnDoc.containsKey("single")) btnSingleAction = btnDoc["single"].as<String>();
        if (btnDoc.containsKey("double")) btnDoubleAction = btnDoc["double"].as<String>();
        if (btnDoc.containsKey("long")) btnLongAction = btnDoc["long"].as<String>();
      }
    } else {
      if (doc.containsKey("single")) btnSingleAction = doc["single"].as<String>();
      if (doc.containsKey("double")) btnDoubleAction = doc["double"].as<String>();
      if (doc.containsKey("long")) btnLongAction = doc["long"].as<String>();
    }
    saveButtonActionsToNVS(btnSingleAction, btnDoubleAction, btnLongAction);
  } else if (action == "set_standby" || action == "set_standby_mode" || action == "set_default_expression" || action == "set_default_expr") {
    if (value.startsWith("{")) {
      DynamicJsonDocument sbDoc(512);
      if (!deserializeJson(sbDoc, value)) {
        if (sbDoc.containsKey("default_expr")) defaultIdleExpr = sbDoc["default_expr"].as<String>();
        else if (sbDoc.containsKey("mode")) defaultIdleExpr = sbDoc["mode"].as<String>();
        if (sbDoc.containsKey("timeout")) standbyTimeoutMs = sbDoc["timeout"].as<unsigned long>();
      }
    } else {
      if (value.indexOf("시계") >= 0 || value == "clock") standbyMode = "clock";
      else if (value.indexOf("날씨") >= 0 || value == "weather") standbyMode = "weather";
      else if (value.indexOf("화면 끄기") >= 0 || value == "off") standbyMode = "off";
      else { defaultIdleExpr = value; standbyMode = "default"; }
    }
    defaultIdleExpr.toLowerCase();
    saveIdleExprToNVS(defaultIdleExpr);
    saveStandbyModeToNVS(standbyMode);
    isStandbyActive = true;
    customExpression = false;
    renderStandbyScreen();
  } else if (action == "play_sound" || action == "beep") {
    if (speakerReady) {
      value.toLowerCase();
      if (action == "beep" || value == "beep" || value == "button_click") playToneI2S(1000, 80);
      else if (value == "power_on") { playToneI2S(440, 150); playToneI2S(880, 250); }
      else if (value == "greeting") { playToneI2S(523, 120); playToneI2S(659, 120); playToneI2S(784, 200); }
      else if (value == "touch_react") { playToneI2S(400, 100); playToneI2S(600, 150); }
    }
  } else if (action == "call_function" || action == "custom_func") {
    handleUserCustomFunction(value);
  } else {
    // 알 수 없는 명령이어도 안전하게 성공 응답 처리하여 웹 에러 방지
  }
  sendReply("success");
}

void onWsEvent(AsyncWebSocket*, AsyncWebSocketClient* client, AwsEventType type, void* arg, uint8_t* data, size_t len) {
  if (type != WS_EVT_DATA) return;
  AwsFrameInfo* info = (AwsFrameInfo*)arg;
  if (!info->final || info->index != 0 || info->len != len || info->opcode != WS_TEXT || !enqueueMessage((char*)data, len, 2, client->id())) {
    client->text("{\"state\":\"error\",\"reason\":\"invalid_frame_or_busy\"}");
  }
}

void writeLe16(uint8_t* dst, uint16_t value) {
  dst[0] = value & 0xff;
  dst[1] = (value >> 8) & 0xff;
}

void writeLe32(uint8_t* dst, uint32_t value) {
  dst[0] = value & 0xff;
  dst[1] = (value >> 8) & 0xff;
  dst[2] = (value >> 16) & 0xff;
  dst[3] = (value >> 24) & 0xff;
}

void makeWavHeader(uint8_t* header, uint32_t pcmBytes) {
  memcpy(header, "RIFF", 4);
  writeLe32(header + 4, 36 + pcmBytes);
  memcpy(header + 8, "WAVEfmt ", 8);
  writeLe32(header + 16, 16);
  writeLe16(header + 20, 1);   // PCM
  writeLe16(header + 22, 1);   // mono
  writeLe32(header + 24, MIC_SAMPLE_RATE);
  writeLe32(header + 28, MIC_SAMPLE_RATE * 2);
  writeLe16(header + 32, 2);
  writeLe16(header + 34, 16);
  memcpy(header + 36, "data", 4);
  writeLe32(header + 40, pcmBytes);
}

bool writeAll(WiFiClient& client, const uint8_t* data, size_t length) {
  size_t sent = 0;
  uint32_t lastProgress = millis();
  while (sent < length && client.connected()) {
    size_t written = client.write(data + sent, min((size_t)4096, length - sent));
    if (written > 0) {
      sent += written;
      lastProgress = millis();
    } else {
      if (millis() - lastProgress > 10000) return false;
      delay(2);
    }
  }
  return sent == length;
}

bool readHttpBytes(WiFiClient& client, String& output, size_t length) {
  uint32_t lastProgress = millis();
  while (length > 0) {
    while (client.available() && length > 0) {
      output += static_cast<char>(client.read());
      --length;
      lastProgress = millis();
    }
    if (length == 0) return true;
    if (!client.connected() || millis() - lastProgress > 90000) return false;
    delay(2);
  }
  return true;
}

bool readHttpBody(WiFiClient& client, bool chunked, int contentLength, String& body) {
  body = "";
  if (contentLength > 0) body.reserve(contentLength + 1);

  if (chunked) {
    for (;;) {
      String sizeLine = client.readStringUntil('\n');
      sizeLine.trim();
      int extension = sizeLine.indexOf(';');
      if (extension >= 0) sizeLine = sizeLine.substring(0, extension);
      char* endPtr = nullptr;
      size_t chunkSize = strtoul(sizeLine.c_str(), &endPtr, 16);
      if (endPtr == sizeLine.c_str()) return false;
      if (chunkSize == 0) {
        // 마지막 청크 뒤의 선택적 trailer 헤더를 소비한다.
        for (;;) {
          String trailer = client.readStringUntil('\n');
          if (trailer == "\r" || trailer.length() == 0) break;
        }
        return true;
      }
      if (!readHttpBytes(client, body, chunkSize)) return false;
      client.readStringUntil('\n'); // 각 청크 뒤의 CRLF
    }
  }

  if (contentLength >= 0) return readHttpBytes(client, body, contentLength);

  uint32_t lastProgress = millis();
  while ((client.connected() || client.available()) && millis() - lastProgress < 90000) {
    while (client.available()) {
      body += static_cast<char>(client.read());
      lastProgress = millis();
    }
    delay(2);
  }
  return body.length() > 0;
}

bool writePcmToSpeaker(const uint8_t* data, size_t length,
                       bool& hasLowByte, uint8_t& lowByte, size_t& receivedBytes) {
  int16_t stereoSamples[1024];
  size_t index = 0;
  size_t stereoCount = 0;
  receivedBytes += length;

  if (hasLowByte && index < length) {
    int16_t sample = (int16_t)((uint16_t)lowByte | ((uint16_t)data[index++] << 8));
    sample = applySpeakerVolume(sample);
    stereoSamples[stereoCount++] = sample;
    stereoSamples[stereoCount++] = sample;
    hasLowByte = false;
  }
  while (index + 1 < length) {
    int16_t sample = (int16_t)((uint16_t)data[index] | ((uint16_t)data[index + 1] << 8));
    index += 2;
    sample = applySpeakerVolume(sample);
    stereoSamples[stereoCount++] = sample;
    stereoSamples[stereoCount++] = sample;
  }
  if (index < length) {
    lowByte = data[index];
    hasLowByte = true;
  }

  if (stereoCount == 0) return true;
  size_t bytesWritten = 0;
  esp_err_t result = i2s_write(
    I2S_NUM_0, stereoSamples, stereoCount * sizeof(int16_t), &bytesWritten, portMAX_DELAY);
  return result == ESP_OK && bytesWritten == stereoCount * sizeof(int16_t);
}

bool readAndPlayPcmBytes(WiFiClient& client, size_t length,
                         bool& hasLowByte, uint8_t& lowByte, size_t& receivedBytes) {
  uint8_t buffer[1024];
  uint32_t lastProgress = millis();
  while (length > 0) {
    int available = client.available();
    if (available <= 0) {
      if (!client.connected() || millis() - lastProgress > 90000) return false;
      delay(2);
      continue;
    }
    size_t toRead = min(length, min(sizeof(buffer), (size_t)available));
    int bytesRead = client.read(buffer, toRead);
    if (bytesRead <= 0) continue;
    if (!writePcmToSpeaker(buffer, bytesRead, hasLowByte, lowByte, receivedBytes)) return false;
    length -= bytesRead;
    lastProgress = millis();
  }
  return true;
}

bool readAndPlayChunkedPcm(WiFiClient& client,
                           bool& hasLowByte, uint8_t& lowByte, size_t& receivedBytes) {
  for (;;) {
    String sizeLine = client.readStringUntil('\n');
    sizeLine.trim();
    int extension = sizeLine.indexOf(';');
    if (extension >= 0) sizeLine = sizeLine.substring(0, extension);
    char* endPtr = nullptr;
    size_t chunkSize = strtoul(sizeLine.c_str(), &endPtr, 16);
    if (endPtr == sizeLine.c_str()) return false;
    if (chunkSize == 0) {
      for (;;) {
        String trailer = client.readStringUntil('\n');
        if (trailer == "\r" || trailer.length() == 0) break;
      }
      return !hasLowByte;
    }
    if (!readAndPlayPcmBytes(client, chunkSize, hasLowByte, lowByte, receivedBytes)) return false;
    client.readStringUntil('\n');
  }
}

bool playReplySpeech(const String& text) {
  if (text.length() == 0) return false;
  if (!speakerReady) {
    Serial.println("[음성 출력 실패] 스피커가 준비되지 않았습니다.");
    return false;
  }

  DynamicJsonDocument requestDoc(1024);
  requestDoc["text"] = text;
  String requestBody;
  serializeJson(requestDoc, requestBody);

  WiFiClient client;
  client.setTimeout(90000);
  Serial.println("[음성 생성] 서버에 답변 목소리를 요청합니다.");
  if (!client.connect(SODA_SERVER_HOST, SODA_SERVER_PORT)) {
    Serial.println("[음성 출력 실패] TTS 서버에 연결하지 못했습니다.");
    return false;
  }

  client.printf("POST %s HTTP/1.1\r\n", SODA_TTS_PATH);
  client.printf("Host: %s:%u\r\n", SODA_SERVER_HOST, SODA_SERVER_PORT);
  client.printf("Authorization: Bearer %s\r\n", sodaApiKey.c_str());
  client.print("Content-Type: application/json\r\n");
  client.printf("Content-Length: %u\r\n", (unsigned)requestBody.length());
  client.print("Connection: close\r\n\r\n");
  if (!writeAll(client, reinterpret_cast<const uint8_t*>(requestBody.c_str()), requestBody.length())) {
    Serial.println("[음성 출력 실패] TTS 요청을 보내지 못했습니다.");
    client.stop();
    return false;
  }

  uint32_t waitStarted = millis();
  while (!client.available() && client.connected() && millis() - waitStarted < 90000) delay(10);
  if (!client.available()) {
    Serial.println("[음성 출력 실패] TTS 서버가 90초 안에 응답하지 않았습니다.");
    client.stop();
    return false;
  }

  String statusLine = client.readStringUntil('\n');
  statusLine.trim();
  int firstSpace = statusLine.indexOf(' ');
  int httpCode = firstSpace >= 0 ? statusLine.substring(firstSpace + 1).toInt() : -1;
  bool chunked = false;
  int contentLength = -1;
  while (client.connected() || client.available()) {
    String headerLine = client.readStringUntil('\n');
    if (headerLine == "\r" || headerLine.length() == 0) break;
    String lowerHeader = headerLine;
    lowerHeader.toLowerCase();
    if (lowerHeader.startsWith("transfer-encoding:") && lowerHeader.indexOf("chunked") >= 0) {
      chunked = true;
    } else if (lowerHeader.startsWith("content-length:")) {
      contentLength = headerLine.substring(headerLine.indexOf(':') + 1).toInt();
    }
  }

  if (httpCode != 200) {
    String errorBody;
    readHttpBody(client, chunked, contentLength, errorBody);
    client.stop();
    Serial.printf("[음성 출력 실패] TTS 서버 응답 HTTP %d\n", httpCode);
    if (errorBody.length() > 0) Serial.println("[TTS 서버 응답] " + errorBody);
    return false;
  }

  Serial.println("[음성 출력] 음성을 받으면서 바로 재생합니다.");
  i2s_zero_dma_buffer(I2S_NUM_0);
  bool hasLowByte = false;
  uint8_t lowByte = 0;
  size_t receivedBytes = 0;
  bool played = chunked
    ? readAndPlayChunkedPcm(client, hasLowByte, lowByte, receivedBytes)
    : (contentLength >= 0 && readAndPlayPcmBytes(
        client, contentLength, hasLowByte, lowByte, receivedBytes));
  client.stop();
  finishSpeakerPlayback();

  if (!played || receivedBytes == 0 || hasLowByte) {
    Serial.println("[음성 출력 실패] 음성 데이터를 끝까지 재생하지 못했습니다.");
    return false;
  }
  Serial.printf("[음성 출력 완료] %u바이트를 재생했습니다.\n", (unsigned)receivedBytes);
  return true;
}

void saveSodaApiKey(const String& key) {
  Preferences voicePrefs;
  if (voicePrefs.begin("soda-voice", false)) {
    voicePrefs.putString("api-key", key);
    voicePrefs.end();
    sodaApiKey = key;
    Serial.println("[설정 완료] SODA API 키를 보드에 안전하게 저장했습니다.");
  } else {
    Serial.println("[오류] API 키를 저장하지 못했습니다.");
  }
}

void loadSodaApiKey() {
  // 7-1은 코드에 지정된 키로 바로 동작한다. NVS의 예전 빈 값이 덮어쓰지 않게 한다.
  sodaApiKey = DEFAULT_SODA_API_KEY;
  Serial.println("[서버 설정] SODA API 키가 코드에 설정되어 있습니다.");
}

void printServerStatus() {
  Serial.printf("[서버 설정] http://%s:%u%s\n", SODA_SERVER_HOST,
                SODA_SERVER_PORT, SODA_AUDIO_CHAT_PATH);
  Serial.printf("[Wi-Fi] %s", WiFi.status() == WL_CONNECTED ? "연결됨" : "연결 안 됨");
  if (WiFi.status() == WL_CONNECTED) Serial.printf(" / 보드 IP: %s", WiFi.localIP().toString().c_str());
  Serial.println();
  Serial.printf("[API 키] %s\n", sodaApiKey.length() > 0 ? "설정됨" : "설정 안 됨");
}

void uploadRecordedConversation() {
  if (!voiceUploadPending.exchange(false)) return;
  voiceUploadBusy.store(true);
  const size_t samplesToSend = voiceSampleCount;

  if (samplesToSend == 0) {
    Serial.println("[전송 취소] 녹음 데이터가 없습니다.");
    voiceUploadBusy.store(false);
    return;
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[서버 연결 실패] Wi-Fi가 연결되어 있지 않습니다.");
    voiceUploadBusy.store(false);
    return;
  }
  if (sodaApiKey.length() == 0) {
    Serial.println("[서버 연결 실패] SODA API 키가 없습니다. SET_API_KEY=발급키 를 먼저 전송하세요.");
    voiceUploadBusy.store(false);
    return;
  }

  const String boundary = "----SodaBotVoice71";
  const String prefix = "--" + boundary + "\r\n"
    "Content-Disposition: form-data; name=\"file\"; filename=\"sodabot.wav\"\r\n"
    "Content-Type: audio/wav\r\n\r\n";
  const String suffix = "\r\n--" + boundary + "--\r\n";
  const uint32_t pcmBytes = samplesToSend * sizeof(int16_t);
  const uint32_t contentLength = prefix.length() + 44 + pcmBytes + suffix.length();
  uint8_t wavHeader[44];
  makeWavHeader(wavHeader, pcmBytes);

  WiFiClient client;
  client.setTimeout(90000);
  Serial.printf("[서버 전송] %u바이트 음성을 %s:%u로 전송합니다.\n",
                (unsigned)pcmBytes, SODA_SERVER_HOST, SODA_SERVER_PORT);
  if (!client.connect(SODA_SERVER_HOST, SODA_SERVER_PORT)) {
    Serial.println("[서버 연결 실패] soda-talk 서버가 실행 중인지, 컴퓨터와 보드가 같은 Wi-Fi인지 확인하세요.");
    voiceUploadBusy.store(false);
    return;
  }

  client.printf("POST %s HTTP/1.1\r\n", SODA_AUDIO_CHAT_PATH);
  client.printf("Host: %s:%u\r\n", SODA_SERVER_HOST, SODA_SERVER_PORT);
  client.printf("Authorization: Bearer %s\r\n", sodaApiKey.c_str());
  client.printf("Content-Type: multipart/form-data; boundary=%s\r\n", boundary.c_str());
  client.printf("Content-Length: %u\r\n", (unsigned)contentLength);
  client.print("Connection: close\r\n\r\n");

  bool sent = writeAll(client, reinterpret_cast<const uint8_t*>(prefix.c_str()), prefix.length())
           && writeAll(client, wavHeader, sizeof(wavHeader))
           && writeAll(client, reinterpret_cast<const uint8_t*>(voicePcm), pcmBytes)
           && writeAll(client, reinterpret_cast<const uint8_t*>(suffix.c_str()), suffix.length());
  if (!sent) {
    Serial.println("[전송 실패] 음성 데이터를 모두 보내지 못했습니다.");
    client.stop();
    voiceUploadBusy.store(false);
    return;
  }

  uint32_t waitStarted = millis();
  while (!client.available() && client.connected() && millis() - waitStarted < 90000) delay(10);
  if (!client.available()) {
    Serial.println("[응답 실패] 서버가 90초 안에 응답하지 않았습니다.");
    client.stop();
    voiceUploadBusy.store(false);
    return;
  }

  String statusLine = client.readStringUntil('\n');
  statusLine.trim();
  int firstSpace = statusLine.indexOf(' ');
  int httpCode = firstSpace >= 0 ? statusLine.substring(firstSpace + 1).toInt() : -1;
  bool chunked = false;
  int responseContentLength = -1;
  while (client.connected() || client.available()) {
    String headerLine = client.readStringUntil('\n');
    if (headerLine == "\r" || headerLine.length() == 0) break;
    String lowerHeader = headerLine;
    lowerHeader.toLowerCase();
    if (lowerHeader.startsWith("transfer-encoding:") && lowerHeader.indexOf("chunked") >= 0) {
      chunked = true;
    } else if (lowerHeader.startsWith("content-length:")) {
      responseContentLength = headerLine.substring(headerLine.indexOf(':') + 1).toInt();
    }
  }

  String body;
  bool bodyRead = readHttpBody(client, chunked, responseContentLength, body);
  client.stop();
  Serial.printf("[서버 응답] HTTP %d\n", httpCode);

  if (!bodyRead) {
    Serial.println("[대화 실패] 서버 응답 본문을 끝까지 받지 못했습니다.");
    voiceUploadBusy.store(false);
    return;
  }

  DynamicJsonDocument response(4096);
  DeserializationError jsonError = deserializeJson(response, body);
  if (httpCode != 200 || jsonError) {
    Serial.printf("[대화 실패] %s\n", jsonError ? "서버 응답 JSON을 해석하지 못했습니다." : "서버가 오류를 반환했습니다.");
    Serial.println("[서버 응답 원문] " + body);
    voiceUploadBusy.store(false);
    return;
  }

  String recognized = response["text"] | "";
  String reply = response["reply"] | "";
  Serial.println("──────────────────────────────");
  Serial.println("[음성 인식 결과] " + recognized);
  Serial.println("[소다봇 답변] " + reply);
  Serial.println("──────────────────────────────");
  drawMessage(reply.length() > 0 ? reply : "음성을 인식하지 못했어요.", 1);
  if (reply.length() > 0) playReplySpeech(reply);
  sleeping = false;
  customExpression = true;
  expressionUntil = millis() + 8000;
  lastActivityTime = millis();
  voiceUploadBusy.store(false);
}

void setup() {
  Serial.begin(115200);
  uint32_t serialStarted = millis();
  while (!Serial && millis() - serialStarted < 2000) delay(10);
  Serial.println("소다봇: 마이크 및 음성 대화 펌웨어");
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  incomingQueue = xQueueCreate(6, sizeof(IncomingMessage));
  if (!incomingQueue) { Serial.println("큐 생성 실패"); while (true) delay(1000); }
  
  // 1. NVS에서 저장된 설정(환영인사, 기본표정 등) 불러오기
  loadSettingsFromNVS();
  loadSodaApiKey();

  // 2. LCD 디스플레이 초기화
  hspi.begin(TFT_CLK, -1, TFT_MOSI, TFT_CS);
  tft.init(240, 320); tft.setSPISpeed(40000000); tft.setRotation(3); tft.invertDisplay(true);

  // 3. 스피커 초기화
  Serial0.end(); // USB CDC Serial 유지, GPIO44는 스피커
  setupSpeaker();

  // 4. 부팅 시 환영인사 화면 표시 + 부팅 멜로디 출력
  drawMessage(welcomeMsg, 0);
  if (speakerReady) {
    playToneI2S(523, 100); // C5
    playToneI2S(659, 100); // E5
    playToneI2S(784, 150); // G5
    playToneI2S(1046, 250); // C6
  }
  delay(2500); // 2.5초 동안 환영 인사 표시

  // 5. 기본 표정으로 전환
  renderDefaultIdleFace();
  lastActivityTime = millis();

  WiFi.mode(WIFI_STA); WiFi.setAutoReconnect(true);
  setupBLE();
  ws.onEvent(onWsEvent); server.addHandler(&ws);
  if (ssid && ssid[0]) WiFi.begin(ssid, password);
  startMicrophoneMonitor();
  Serial.println("SODABOT BASIC protocol=1 준비 완료");
  Serial.println("[사용 방법] 버튼을 누른 채 말하고, 다 말하면 버튼을 놓으세요.");
  Serial.println("[시리얼 명령] SERVER_STATUS 또는 SET_API_KEY=발급키 (115200 baud, 새 줄)");
  printServerStatus();

  // === CUSTOM_SETUP_START ===
  // === CUSTOM_SETUP_END ===
}

void loop() {
  // 버튼 음성 대화 Push-to-Talk 처리
  uploadRecordedConversation();
  startWebServerIfReady();
  ws.cleanupClients();
  static String serialInput;
  static bool serialOverflow = false;
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n') {
      serialInput.trim();
      if (!serialOverflow && serialInput.startsWith("SET_API_KEY=")) {
        String key = serialInput.substring(12);
        key.trim();
        if (key.length() >= 16) saveSodaApiKey(key);
        else Serial.println("[설정 오류] API 키가 너무 짧습니다.");
      } else if (!serialOverflow && serialInput == "SERVER_STATUS") {
        printServerStatus();
      } else if (!serialOverflow && serialInput.length() > 0) {
        enqueueMessage(serialInput.c_str(), serialInput.length(), 0);
      }
      serialInput = ""; serialOverflow = false;
    } else if (ch == '\r') {
      // CRLF 또는 Both NL & CR 설정에서도 명령을 한 번만 처리한다.
    } else if (!serialOverflow) {
      if (serialInput.length() >= 1023) { serialInput = ""; serialOverflow = true; }
      else serialInput += ch;
    }
  }
  IncomingMessage message;
  if (xQueueReceive(incomingQueue, &message, 0) == pdTRUE) {
    lastActivityTime = millis();
    if (isStandbyActive) { isStandbyActive = false; }
    processMessage(message);
  }
  if (customExpression && (int32_t)(millis() - expressionUntil) >= 0) {
    customExpression = false;
    if (isStandbyActive) renderStandbyScreen();
    else renderDefaultIdleFace();
  }
  
  // 대기 시간 초과 시 대기 화면 자동 전환
  if (!customExpression && !sleeping && !isStandbyActive && (millis() - lastActivityTime >= standbyTimeoutMs)) {
    isStandbyActive = true;
    renderStandbyScreen();
  }

  // 기본 표정 대기 중일 때만 주기적 눈 깜빡임 (default 눈일 때만 깜빡임)
  static unsigned long lastBlink = 0;
  if (!customExpression && !sleeping && (defaultIdleExpr == "default" || defaultIdleExpr == "idle") && (!isStandbyActive || standbyMode == "default" || standbyMode.indexOf("기본") >= 0) && millis() - lastBlink > 5000) {
    blinkOnce();
    lastBlink = millis();
  }
  delay(5);
}
