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



#include <string.h>
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
  drawIdle();

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



// [수정 1] 표정 영역 — 눈·입의 좌표, 크기, 색상을 바꿔보세요.
void drawIdle() {
  tft.fillScreen(ST77XX_BLACK);
  tft.fillCircle(110, 90, 12, ST77XX_WHITE);
  tft.fillCircle(210, 90, 12, ST77XX_WHITE);
  tft.drawLine(125, 160, 195, 160, ST77XX_CYAN);
}
void drawHappy() {
  tft.fillScreen(ST77XX_BLACK);
  tft.drawLine(90, 95, 110, 75, ST77XX_YELLOW);
  tft.drawLine(110, 75, 130, 95, ST77XX_YELLOW);
  tft.drawLine(190, 95, 210, 75, ST77XX_YELLOW);
  tft.drawLine(210, 75, 230, 95, ST77XX_YELLOW);
  tft.drawLine(115, 145, 140, 170, ST77XX_CYAN);
  tft.drawLine(140, 170, 180, 170, ST77XX_CYAN);
  tft.drawLine(180, 170, 205, 145, ST77XX_CYAN);
}
void drawSurprised() {
  tft.fillScreen(ST77XX_BLUE);
  tft.fillCircle(110, 85, 15, ST77XX_WHITE);
  tft.fillCircle(210, 85, 15, ST77XX_WHITE);
  tft.drawCircle(160, 160, 25, ST77XX_YELLOW);
}
// [/수정 1]

// [수정 2] 소리 영역 — playTone(주파수 Hz, 시간 ms)를 바꿔보세요.
void playFeedback() {
  playTone(523.25, 120);
  playTone(659.25, 120);
  playTone(783.99, 200);
}
// [/수정 2]

// [수정 3] LED 영역 — 소리 뒤 LED를 더 켜둘 시간(ms)을 바꿔보세요.
#define LED_ON_TIME 700
// [/수정 3]

int expressionIndex = 0;
void loop() {
  if (digitalRead(BUTTON_PIN) == LOW) {
    delay(20);
    if (digitalRead(BUTTON_PIN) != LOW) return;
    digitalWrite(LED_PIN, HIGH);       // LED 켜기
    expressionIndex = (expressionIndex + 1) % 2;
    if (expressionIndex == 1) drawHappy();
    else drawSurprised();
    playFeedback();                   // 효과음 재생
    delay(LED_ON_TIME);               // LED 유지
    digitalWrite(LED_PIN, LOW);        // LED 끄기
    while (digitalRead(BUTTON_PIN) == LOW) delay(10);
    delay(50);
  }
}

// I2S 파형 생성 — 이 아래는 그대로 두세요.
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

      // 시작과 끝 5ms에 음량을 서서히 바꿔 클릭음을 줄입니다.
      const int rampSamples = SAMPLE_RATE / 200;
      const int position = generated + i;
      const float fadeIn = fminf(1.0f, (float)position / rampSamples);
      const float fadeOut = fminf(1.0f, (float)(totalSamples - 1 - position) / rampSamples);
      int16_t sample = (int16_t)(sin(phase) * 3000 * fminf(fadeIn, fadeOut));

      phase += phaseStep;

      if (phase >= 2.0 * PI) {
        phase -= 2.0 * PI;
      }


      // 좌/우 동일 신호
      buffer[i * 2]     = sample;
      buffer[i * 2 + 1] = sample;
    }


    const uint8_t *data = (const uint8_t *)buffer;
    const size_t totalBytes = count * 2 * sizeof(int16_t);
    size_t offset = 0;
    while (offset < totalBytes) {
      size_t bytesWritten = 0;
      esp_err_t err = i2s_write(I2S_PORT, data + offset, totalBytes - offset,
                                &bytesWritten, portMAX_DELAY);
      if (err != ESP_OK || bytesWritten == 0) {
        Serial.printf("I2S write error: %d, bytes=%u\n", (int)err, (unsigned)bytesWritten);
        return;
      }
      offset += bytesWritten;
    }

    generated += count;
  }


  // DMA에 대기 중인 음을 지우지 않고 무음으로 이어줍니다.
  // 8개 DMA 버퍼보다 많은 무음을 보내 마지막 음이 출력되게 합니다.
  memset(buffer, 0, sizeof(buffer));
  for (int block = 0; block < 9; block++) {
    size_t offset = 0;
    while (offset < sizeof(buffer)) {
      size_t written = 0;
      esp_err_t err = i2s_write(I2S_PORT, ((const uint8_t *)buffer) + offset,
                                sizeof(buffer) - offset, &written, portMAX_DELAY);
      if (err != ESP_OK || written == 0) {
        Serial.printf("I2S silence error: %d\n", (int)err);
        return;
      }
      offset += written;
    }
  }
}
