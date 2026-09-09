#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <driver/i2s.h>

// ==================================
// 오늘의 실습
// ==================================
//
// 오늘 배울 기능: X값을 줄여 선인장을 왼쪽으로 움직이기 + I2S 점프 효과음
// 학생이 수정할 부분: 
//   1. 19라인 gameSpeed (선인장 이동 속도)
// 수정하지 않아도 되는 부분: 점프, I2S 스피커 사운드, 화면 갱신
//

// ========================
// 학생 게임 설정
// ========================
// ★★★ [실습 미션: 선인장 속도 조절하기] ★★★
float gameSpeed = 5.0f;  // 👈 [여기!] 3.0(느림), 5.0(보통), 7.0(빠름)으로 바꿔 보세요.
float JUMP_POWER = -8.5f;
float GRAVITY = 0.48f;

// ==================================
// 수정하지 마세요: 게임 기본 코드
// ==================================
namespace Pin {
constexpr uint8_t LED = 2;
constexpr uint8_t BUTTON = 4;
constexpr int I2S_BCLK = 5;
constexpr int I2S_LRC = 3;
constexpr int I2S_DOUT = 44;  // ESP32-S3 SuperMini RX 핀
constexpr int MOSI = 11, CLK = 12, CS = 13, DC = 7, RST = 6;
}

constexpr i2s_port_t I2S_PORT = I2S_NUM_0;
constexpr int SAMPLE_RATE = 44100;
constexpr int SCREEN_W = 320;
constexpr int GROUND_Y = 190;
constexpr int DINO_X = 45, DINO_H = 38;
constexpr int DINO_GROUND_Y = GROUND_Y - DINO_H;
constexpr int CACTUS_W = 20, CACTUS_H = 38;
constexpr uint32_t FRAME_MS = 33;

SPIClass screenSPI(HSPI);
Adafruit_ST7789 lcd(&screenSPI, Pin::CS, Pin::DC, Pin::RST);

float dinoY = DINO_GROUND_Y;
float jumpSpeed = 0;
float cactusX = SCREEN_W + 60;
bool jumping = false;
bool lastButton = HIGH;
uint32_t nextFrame = 0;
TaskHandle_t soundTaskHandle = nullptr;

void playJumpSound() {
  constexpr int SOUND_MS = 100;
  constexpr int TOTAL_FRAMES = SAMPLE_RATE * SOUND_MS / 1000;
  constexpr int CHUNK_FRAMES = 128;
  int16_t samples[CHUNK_FRAMES * 2];
  float phase = 0.0f;

  for (int frame = 0; frame < TOTAL_FRAMES;) {
    int framesNow = min(CHUNK_FRAMES, TOTAL_FRAMES - frame);
    for (int i = 0; i < framesNow; ++i) {
      float progress = float(frame + i) / TOTAL_FRAMES;
      float frequency = 650.0f + 1050.0f * progress;
      float volume = 0.30f * (1.0f - progress);
      phase += TWO_PI * frequency / SAMPLE_RATE;
      int16_t sample = int16_t(sinf(phase) * 32767.0f * volume);
      samples[i * 2] = sample;
      samples[i * 2 + 1] = sample;
    }

    size_t bytesWritten;
    i2s_write(I2S_PORT, samples, framesNow * 2 * sizeof(int16_t),
              &bytesWritten, portMAX_DELAY);
    frame += framesNow;
  }
  vTaskDelay(pdMS_TO_TICKS(25));
  i2s_zero_dma_buffer(I2S_PORT);
}

void soundTask(void *parameter) {
  while (true) {
    ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
    playJumpSound();
  }
}

void setupSpeaker() {
  i2s_config_t config = {};
  config.mode = i2s_mode_t(I2S_MODE_MASTER | I2S_MODE_TX);
  config.sample_rate = SAMPLE_RATE;
  config.bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT;
  config.channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT;
  config.communication_format = I2S_COMM_FORMAT_STAND_I2S;
  config.intr_alloc_flags = ESP_INTR_FLAG_LEVEL1;
  config.dma_buf_count = 4;
  config.dma_buf_len = 256;
  config.use_apll = false;
  config.tx_desc_auto_clear = true;

  i2s_pin_config_t pins = {};
  pins.mck_io_num = I2S_PIN_NO_CHANGE;
  pins.bck_io_num = Pin::I2S_BCLK;
  pins.ws_io_num = Pin::I2S_LRC;
  pins.data_out_num = Pin::I2S_DOUT;
  pins.data_in_num = I2S_PIN_NO_CHANGE;

  i2s_driver_install(I2S_PORT, &config, 0, nullptr);
  i2s_set_pin(I2S_PORT, &pins);
  i2s_zero_dma_buffer(I2S_PORT);
  xTaskCreatePinnedToCore(soundTask, "jumpSound", 2048, nullptr, 1,
                         &soundTaskHandle, 0);
}

void drawDino(int x, int y) {
  lcd.fillRect(x + 13, y + 13, 15, 20, ST77XX_BLACK);
  lcd.fillRect(x + 20, y, 23, 18, ST77XX_BLACK);
  lcd.fillRect(x + 38, y + 13, 7, 5, ST77XX_BLACK);
  lcd.fillTriangle(x + 14, y + 17, x - 4, y + 9,
                   x + 10, y + 27, ST77XX_BLACK);
  lcd.fillRect(x + 34, y + 4, 3, 3, ST77XX_WHITE);
  lcd.fillRect(x + 14, y + 30, 5, 8, ST77XX_BLACK);
  lcd.fillRect(x + 25, y + 34, 8, 4, ST77XX_BLACK);
}

void drawCactus(int x) {
  int y = GROUND_Y - CACTUS_H;
  lcd.fillRect(x + 6, y, 7, CACTUS_H, ST77XX_BLACK);
  lcd.fillRect(x, y + 13, 7, 5, ST77XX_BLACK);
  lcd.fillRect(x, y + 6, 4, 11, ST77XX_BLACK);
  lcd.fillRect(x + 12, y + 20, 7, 5, ST77XX_BLACK);
  lcd.fillRect(x + 16, y + 12, 4, 12, ST77XX_BLACK);
}

void startJump() {
  if (!jumping) {
    jumping = true;
    jumpSpeed = JUMP_POWER;
    if (soundTaskHandle != nullptr) xTaskNotifyGive(soundTaskHandle);
  }
}

void updateJump() {
  if (!jumping) return;
  jumpSpeed += GRAVITY;
  dinoY += jumpSpeed;
  if (dinoY >= DINO_GROUND_Y) {
    dinoY = DINO_GROUND_Y;
    jumpSpeed = 0;
    jumping = false;
  }
}

void updateCactus() {
  cactusX -= gameSpeed;  // 핵심: X값이 작아지면 왼쪽으로 갑니다.
  if (cactusX < -CACTUS_W) cactusX = SCREEN_W + 80;
}

void redrawMovingObjects(int oldCactusX) {
  lcd.fillRect(DINO_X - 5, 65, 55, GROUND_Y - 64, ST77XX_WHITE);
  lcd.fillRect(oldCactusX - 2, GROUND_Y - CACTUS_H - 2,
               CACTUS_W + 5, CACTUS_H + 3, ST77XX_WHITE);
  lcd.drawFastHLine(0, GROUND_Y, SCREEN_W, ST77XX_BLACK);
  drawDino(DINO_X, int(dinoY));
  drawCactus(int(cactusX));
}

void setup() {
  pinMode(Pin::BUTTON, INPUT_PULLUP);
  pinMode(Pin::LED, OUTPUT);
  setupSpeaker();
  screenSPI.begin(Pin::CLK, -1, Pin::MOSI, Pin::CS);
  lcd.init(240, 320);
  lcd.setSPISpeed(20000000);
  lcd.setRotation(3);
  lcd.invertDisplay(true);
  lcd.fillScreen(ST77XX_WHITE);
  lcd.drawFastHLine(0, GROUND_Y, SCREEN_W, ST77XX_BLACK);
  drawDino(DINO_X, int(dinoY));
  drawCactus(int(cactusX));
}

void loop() {
  bool buttonNow = digitalRead(Pin::BUTTON);
  bool justPressed = buttonNow == LOW && lastButton == HIGH;
  lastButton = buttonNow;
  if (justPressed) startJump();

  uint32_t now = millis();
  if (int32_t(now - nextFrame) < 0) return;
  nextFrame = now + FRAME_MS;
  int oldCactusX = int(cactusX);
  updateJump();
  updateCactus();
  redrawMovingObjects(oldCactusX);
}
