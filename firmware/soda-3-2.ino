#include <driver/i2s.h>
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
