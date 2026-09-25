#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <driver/i2s.h>
#include <math.h>

// =========================================================================
// [6주차] 3. 소다봇 마이크 입력 테스트 (Push-to-Test: 버튼 누를 때만 마이크 테스트)
// =========================================================================
//
// 🎯 학습 목표:
// 1. 물리 버튼(GPIO 4)을 누르고 있는 동안에만 INMP441 I2S 마이크를 활성화하여
//    소리 크기를 실시간 측정합니다. (Push-to-Talk 음성인식의 기초 원리)
// 2. 소리의 크기(진폭, RMS, Volume %)를 2.0인치 ST7789 LCD에 실시간 VU 미터,
//    백분율 수치, 사운드 파형으로 시각화합니다.
// 3. 버튼을 떼면 대기 상태로 전환되며 최근 최대 볼륨(Peak) 수치를 보존합니다.
//
// =========================================================================

// ========================
// 핀 설정 (ESP32-S3 SuperMini)
// ========================
namespace Pin {
  // LCD 디스플레이 (ST7789 2.0인치 SPI)
  constexpr int MOSI = 11;
  constexpr int CLK  = 12;
  constexpr int CS   = 13;
  constexpr int DC   = 7;
  constexpr int RST  = 6;

  // I2S 마이크 (INMP441)
  constexpr int MIC_SCK = 9;   // BCLK (비트 클럭)
  constexpr int MIC_WS  = 10;  // LRC / WS (워드 클럭)
  constexpr int MIC_SD  = 8;   // DIN / SD (데이터 입력)

  // 버튼 및 LED
  constexpr uint8_t BUTTON = 4;
  constexpr uint8_t LED    = 2;
}

// ========================
// I2S 마이크 설정
// ========================
constexpr i2s_port_t MIC_I2S_PORT = I2S_NUM_1;
constexpr int SAMPLE_RATE = 16000;
constexpr int READ_LEN = 256;

// ========================
// 디스플레이 객체
// ========================
SPIClass screenSPI(HSPI);
Adafruit_ST7789 tft(&screenSPI, Pin::CS, Pin::DC, Pin::RST);

// ========================
// 사운드 및 버튼 상태 변수
// ========================
float currentVolume = 0.0f;     // 0 ~ 100%
float smoothVolume = 0.0f;      // 부드러운 볼륨 값
float lastPeakVolume = 0.0f;    // 최근 측정된 최대 볼륨
float currentPeak = 0.0f;       // 이번 버튼 누름 중 최대 볼륨

bool isTesting = false;         // 현재 버튼 눌림(마이크 테스트 중) 여부
bool prevTestingState = false;

// 파형 그래프 히스토리 버퍼
constexpr int WAVE_HISTORY_LEN = 40;
int waveHistory[WAVE_HISTORY_LEN] = {0};
int waveHead = 0;

// ========================
// 마이크 I2S 초기화 함수
// ========================
bool setupMicrophone() {
  i2s_config_t config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 4,
    .dma_buf_len = 256,
    .use_apll = false
  };

  i2s_pin_config_t pins = {
    .mck_io_num   = I2S_PIN_NO_CHANGE,
    .bck_io_num   = Pin::MIC_SCK,
    .ws_io_num    = Pin::MIC_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num  = Pin::MIC_SD
  };

  esp_err_t err = i2s_driver_install(MIC_I2S_PORT, &config, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("[오류] I2S 드라이버 설치 실패: %s\n", esp_err_to_name(err));
    return false;
  }

  err = i2s_set_pin(MIC_I2S_PORT, &pins);
  if (err != ESP_OK) {
    Serial.printf("[오류] I2S 핀 설정 실패: %s\n", esp_err_to_name(err));
    i2s_driver_uninstall(MIC_I2S_PORT);
    return false;
  }

  return true;
}

// ========================
// 마이크 소리 크기 측정 (RMS 계산)
// ========================
float readMicrophoneLevel() {
  int32_t rawSamples[READ_LEN];
  size_t bytesRead = 0;

  esp_err_t err = i2s_read(MIC_I2S_PORT, rawSamples, sizeof(rawSamples), &bytesRead, pdMS_TO_TICKS(20));
  if (err != ESP_OK || bytesRead == 0) {
    return 0.0f;
  }

  size_t sampleCount = bytesRead / sizeof(int32_t);
  double sumSquares = 0;

  for (size_t i = 0; i < sampleCount; ++i) {
    int32_t sample = rawSamples[i] >> 14; // 상위 유효 비트 스케일 조정
    sumSquares += (double)sample * (double)sample;
  }

  double rms = sqrt(sumSquares / sampleCount);

  // 주변 기본 잡음 노이즈 게이트
  if (rms < 25.0) {
    rms = 0.0;
  }

  // 0 ~ 100% 볼륨 매핑 (로그 스케일)
  float volume = 0.0f;
  if (rms > 0) {
    volume = (float)(log10(1.0 + rms / 40.0) / log10(1.0 + 7000.0 / 40.0) * 100.0f);
  }

  if (volume > 100.0f) volume = 100.0f;
  if (volume < 0.0f) volume = 0.0f;

  return volume;
}

// ========================
// LCD 화면 배경 및 고정 UI
// ========================
void drawStaticUI() {
  tft.fillScreen(ST77XX_BLACK);

  // 상단 헤더 바
  tft.fillRect(0, 0, 320, 36, tft.color565(20, 24, 40));
  tft.drawFastHLine(0, 36, 320, tft.color565(60, 80, 140));

  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(2);
  tft.setCursor(12, 10);
  tft.print("SODABOT MIC TEST");

  // 볼륨 박스 외곽선
  tft.drawRoundRect(15, 46, 290, 84, 8, tft.color565(70, 70, 90));
  tft.fillRect(16, 47, 288, 82, tft.color565(15, 18, 28));

  tft.setTextSize(1);
  tft.setTextColor(tft.color565(170, 170, 190));
  tft.setCursor(26, 56);
  tft.print("SOUND LEVEL (VU METER)");

  // 하단 파형 히스토리 영역
  tft.drawRoundRect(15, 138, 290, 60, 8, tft.color565(60, 60, 80));
  tft.fillRect(16, 139, 288, 58, tft.color565(10, 12, 20));

  tft.setCursor(26, 146);
  tft.setTextColor(tft.color565(140, 140, 160));
  tft.print("REAL-TIME SOUND WAVE");

  // 최하단 안내 바
  tft.drawFastHLine(0, 206, 320, tft.color565(40, 40, 50));
}

// ========================
// 상태 뱃지 및 안내 문구 렌더링
// ========================
void drawStatusBadge(bool testing) {
  // 상단 우측 상태 뱃지
  tft.fillRect(205, 8, 110, 22, tft.color565(20, 24, 40));
  tft.setTextSize(1);

  if (testing) {
    tft.fillRoundRect(205, 8, 108, 20, 4, tft.color565(220, 40, 40));
    tft.setTextColor(ST77XX_WHITE);
    tft.setCursor(214, 14);
    tft.print("[ REC LISTENING ]");
  } else {
    tft.fillRoundRect(205, 8, 108, 20, 4, tft.color565(40, 50, 70));
    tft.setTextColor(tft.color565(180, 200, 230));
    tft.setCursor(220, 14);
    tft.print("[ READY (IDLE) ]");
  }

  // 최하단 안내 메시지
  tft.fillRect(0, 212, 320, 26, ST77XX_BLACK);
  tft.setCursor(15, 218);
  if (testing) {
    tft.setTextColor(tft.color565(255, 100, 100));
    tft.print(">> [D4 버튼 누름] 마이크에 소리를 내보세요! <<");
  } else {
    tft.setTextColor(tft.color565(120, 220, 255));
    tft.print(">> 버튼(D4)을 누른 채 말해보세요! (Push-to-Test) <<");
  }
}

// ========================
// 실시간 볼륨 게이지 렌더링
// ========================
void drawVolumeGauge(float vol, float smoothVol, bool testing) {
  constexpr int BAR_X = 26;
  constexpr int BAR_Y = 78;
  constexpr int BAR_W = 268;
  constexpr int BAR_H = 22;

  int fillWidth = (int)((smoothVol / 100.0f) * BAR_W);
  if (fillWidth > BAR_W) fillWidth = BAR_W;

  int segCount = 30;
  int segW = BAR_W / segCount;

  for (int i = 0; i < segCount; ++i) {
    int sx = BAR_X + i * segW;
    int curRatio = (i * 100) / segCount;
    bool isActive = (sx + segW - BAR_X) <= fillWidth;

    uint16_t segColor;
    if (testing) {
      if (curRatio < 50) {
        segColor = isActive ? tft.color565(40, 220, 80) : tft.color565(15, 45, 25);
      } else if (curRatio < 75) {
        segColor = isActive ? tft.color565(255, 200, 40) : tft.color565(50, 45, 15);
      } else if (curRatio < 90) {
        segColor = isActive ? tft.color565(255, 120, 30) : tft.color565(55, 28, 10);
      } else {
        segColor = isActive ? tft.color565(255, 40, 60) : tft.color565(55, 15, 20);
      }
    } else {
      // 대기 상태일 때는 회색/어두운 톤
      segColor = tft.color565(25, 30, 45);
    }

    tft.fillRect(sx, BAR_Y, segW - 2, BAR_H, segColor);
  }

  // 피크 라인 표시
  if (testing && currentPeak > 2.0f) {
    int peakX = BAR_X + (int)((currentPeak / 100.0f) * (BAR_W - 3));
    if (peakX > BAR_X + BAR_W - 3) peakX = BAR_X + BAR_W - 3;
    tft.fillRect(peakX, BAR_Y - 2, 3, BAR_H + 4, ST77XX_WHITE);
  }

  // 수치 텍스트 갱신
  tft.fillRect(205, 52, 90, 18, tft.color565(15, 18, 28));
  tft.setTextSize(2);
  if (testing) {
    if (smoothVol > 80.0f) {
      tft.setTextColor(tft.color565(255, 60, 60));
    } else if (smoothVol > 50.0f) {
      tft.setTextColor(tft.color565(255, 210, 50));
    } else {
      tft.setTextColor(tft.color565(80, 230, 120));
    }
    tft.setCursor(215, 54);
    char buf[16];
    snprintf(buf, sizeof(buf), "%3.0f%%", smoothVol);
    tft.print(buf);
  } else {
    tft.setTextSize(1);
    tft.setTextColor(tft.color565(180, 180, 200));
    tft.setCursor(205, 56);
    if (lastPeakVolume > 0.0f) {
      char buf[20];
      snprintf(buf, sizeof(buf), "Peak: %2.0f%%", lastPeakVolume);
      tft.print(buf);
    } else {
      tft.print("IDLE: 0%");
    }
  }

  // 하단 파형 히스토리 렌더링
  waveHistory[waveHead] = testing ? (int)((vol / 100.0f) * 38) : 0;
  waveHead = (waveHead + 1) % WAVE_HISTORY_LEN;

  tft.fillRect(26, 160, 268, 30, tft.color565(10, 12, 20));
  int stepX = 268 / WAVE_HISTORY_LEN;
  for (int i = 0; i < WAVE_HISTORY_LEN; ++i) {
    int idx = (waveHead + i) % WAVE_HISTORY_LEN;
    int h = waveHistory[idx];
    if (h > 0) {
      int wx = 26 + i * stepX;
      int wy = 190 - h;
      uint16_t waveColor = (h > 28) ? tft.color565(255, 80, 80) : tft.color565(0, 180, 255);
      tft.fillRect(wx, wy, stepX - 1, h, waveColor);
    }
  }
}

// ========================
// 시리얼 모니터 출력
// ========================
void printSerialStatus(float vol, bool testing) {
  if (!testing) return;

  constexpr int WIDTH = 25;
  int bars = (int)((vol / 100.0f) * WIDTH);
  if (bars > WIDTH) bars = WIDTH;

  Serial.print("[MIC] [");
  for (int i = 0; i < WIDTH; ++i) {
    if (i < bars) {
      Serial.print("=");
    } else {
      Serial.print(" ");
    }
  }
  Serial.printf("] Vol: %3.0f%% | Peak: %3.0f%% (PUSH-TO-TEST)\n", vol, currentPeak);
}

// ========================
// 아두이노 setup()
// ========================
void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(Pin::BUTTON, INPUT_PULLUP);
  pinMode(Pin::LED, OUTPUT);
  digitalWrite(Pin::LED, LOW);

  // LCD 초기화
  screenSPI.begin(Pin::CLK, -1, Pin::MOSI, Pin::CS);
  tft.init(240, 320);
  tft.setRotation(3); // 가로 320x240 모드
  tft.fillScreen(ST77XX_BLACK);

  tft.setTextSize(2);
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(30, 100);
  tft.print("Starting Mic Test...");

  Serial.println("\n==============================================");
  Serial.println("  소다봇 6주차: INMP441 마이크 입력 테스트 시작  ");
  Serial.println("  👉 버튼(D4)을 누른 채 말해보세요! (Push-to-Test)  ");
  Serial.println("==============================================");
  Serial.printf("마이크 핀: SCK=%d, WS=%d, SD=%d, 버튼=GPIO%d\n", 
                Pin::MIC_SCK, Pin::MIC_WS, Pin::MIC_SD, Pin::BUTTON);

  if (!setupMicrophone()) {
    tft.fillScreen(ST77XX_BLACK);
    tft.setTextColor(ST77XX_RED);
    tft.setCursor(20, 100);
    tft.print("Mic Init Failed!");
    tft.setTextSize(1);
    tft.setCursor(20, 130);
    tft.print("Please check 3.3V, GND, GPIO 8, 9, 10 wires.");
    while (true) {
      delay(1000);
    }
  }

  delay(300);
  drawStaticUI();
  drawStatusBadge(false);
  drawVolumeGauge(0.0f, 0.0f, false);
  Serial.println("마이크가 준비되었습니다. 버튼(D4)을 누르면 마이크 테스트가 시작됩니다.\n");
}

// ========================
// 아두이노 loop()
// ========================
void loop() {
  // 1. 물리 버튼(GPIO 4) 상태 확인 (LOW: 누름, HIGH: 뗌)
  isTesting = (digitalRead(Pin::BUTTON) == LOW);

  // 2. 버튼 상태 전환 이벤트 감지
  if (isTesting != prevTestingState) {
    if (isTesting) {
      // 버튼 누름 시작: 피크 초기화
      currentPeak = 0.0f;
      smoothVolume = 0.0f;
      Serial.println("\n🎙️ [버튼 누름] 마이크 소리 크기 측정 시작!");
    } else {
      // 버튼 뗌: 피크값 저장 후 대기
      lastPeakVolume = currentPeak;
      smoothVolume = 0.0f;
      digitalWrite(Pin::LED, LOW);
      Serial.printf("⏹️ [버튼 뗌] 측정 완료 (최대 피크 볼륨: %.0f%%)\n\n", lastPeakVolume);
    }
    drawStatusBadge(isTesting);
    prevTestingState = isTesting;
  }

  // 3. 버튼을 누르고 있는 동안에만 마이크 읽기 및 계산
  if (isTesting) {
    currentVolume = readMicrophoneLevel();

    if (currentVolume > smoothVolume) {
      smoothVolume = currentVolume;
    } else {
      smoothVolume = smoothVolume * 0.70f + currentVolume * 0.30f;
    }

    if (smoothVolume > currentPeak) {
      currentPeak = smoothVolume;
    }

    // 소리가 감지되면 LED(GPIO 2) 반응 점등
    if (smoothVolume > 20.0f) {
      digitalWrite(Pin::LED, HIGH);
    } else {
      digitalWrite(Pin::LED, LOW);
    }

    // 시리얼 출력
    static uint32_t lastSerialTime = 0;
    if (millis() - lastSerialTime > 60) {
      printSerialStatus(smoothVolume, true);
      lastSerialTime = millis();
    }
  } else {
    currentVolume = 0.0f;
    smoothVolume = 0.0f;
  }

  // 4. LCD 화면 갱신
  drawVolumeGauge(currentVolume, smoothVolume, isTesting);

  delay(20);
}
