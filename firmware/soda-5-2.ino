#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <driver/i2s.h>

// ==================================
// 오늘의 실습
// ==================================
//
// 오늘 배울 기능: 충돌 규칙, GAME OVER, 다시 시작하기 + I2S 효과음
// 학생이 수정할 부분: 
//   1. 19라인 JUMP_POWER (점프의 힘)
//   2. 21라인 gameSpeed (게임 속도)
// 수정하지 않아도 되는 부분: hitCactus() 안의 충돌 계산, I2S 스피커 사운드
//

// ========================
// 학생 게임 설정
// ========================
// ★★★ [실습 미션: 점프 힘과 게임 속도 조절하기] ★★★
float JUMP_POWER = -8.5f;  // 👈 [여기!] 점프의 힘
float GRAVITY = 0.48f;
float gameSpeed = 5.0f;    // 👈 [여기!] 선인장 속도

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
constexpr int DINO_X = 45, DINO_W = 34, DINO_H = 38;
constexpr int DINO_GROUND_Y = GROUND_Y - DINO_H;
constexpr int CACTUS_W = 20, CACTUS_H = 38;
constexpr uint32_t FRAME_MS = 33;

SPIClass screenSPI(HSPI);
Adafruit_ST7789 lcd(&screenSPI, Pin::CS, Pin::DC, Pin::RST);

enum GameState { READY, PLAYING, GAME_OVER };
GameState state = READY;

enum SoundType { SOUND_NONE = 0, SOUND_JUMP = 1, SOUND_HIT = 2 };
TaskHandle_t soundTaskHandle = nullptr;

float dinoY = DINO_GROUND_Y;
float jumpSpeed = 0;
float cactusX = SCREEN_W + 70;
bool jumping = false;
bool lastButton = HIGH;
uint32_t nextFrame = 0;

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

void playHitSound() {
  constexpr int SOUND_MS = 180;
  constexpr int TOTAL_FRAMES = SAMPLE_RATE * SOUND_MS / 1000;
  constexpr int CHUNK_FRAMES = 128;
  int16_t samples[CHUNK_FRAMES * 2];
  float phase = 0.0f;

  for (int frame = 0; frame < TOTAL_FRAMES;) {
    int framesNow = min(CHUNK_FRAMES, TOTAL_FRAMES - frame);
    for (int i = 0; i < framesNow; ++i) {
      float progress = float(frame + i) / TOTAL_FRAMES;
      float frequency = 320.0f - 180.0f * progress;
      float volume = 0.35f * (1.0f - progress);
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
    uint32_t soundVal = ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
    if (soundVal == SOUND_HIT) {
      playHitSound();
    } else {
      playJumpSound();
    }
  }
}

void triggerSound(SoundType type) {
  if (soundTaskHandle != nullptr) {
    xTaskNotify(soundTaskHandle, (uint32_t)type, eSetValueWithOverwrite);
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

void centerText(const char *text, int y, int size) {
  int16_t x1, y1;
  uint16_t w, h;
  lcd.setTextSize(size);
  lcd.getTextBounds(text, 0, y, &x1, &y1, &w, &h);
  lcd.setTextColor(ST77XX_BLACK, ST77XX_WHITE);
  lcd.setCursor((SCREEN_W - w) / 2, y);
  lcd.print(text);
}

void drawScene() {
  lcd.fillScreen(ST77XX_WHITE);
  lcd.drawFastHLine(0, GROUND_Y, SCREEN_W, ST77XX_BLACK);
  drawDino(DINO_X, int(dinoY));
  drawCactus(int(cactusX));
}

void showReady() {
  drawScene();
  centerText("PRESS UP", 65, 3);
  centerText("READY = START WAIT", 105, 1);
}

void showGameOver() {
  lcd.fillRect(55, 55, 210, 86, ST77XX_WHITE);
  lcd.drawRect(55, 55, 210, 86, ST77XX_BLACK);
  centerText("GAME OVER", 70, 3);
  centerText("PRESS UP TO RETRY", 112, 1);
}

void startGame() {
  state = PLAYING;
  dinoY = DINO_GROUND_Y;
  jumpSpeed = 0;
  jumping = false;
  cactusX = SCREEN_W + 70;
  drawScene();
}

void startJump() {
  if (!jumping) {
    jumping = true;
    jumpSpeed = JUMP_POWER;
    triggerSound(SOUND_JUMP);
  }
}

void redrawMovingObjects(int oldCactusX) {
  // 움직였던 공룡과 선인장 영역만 지워 깜빡임을 줄입니다.
  lcd.fillRect(DINO_X - 5, 65, 55, GROUND_Y - 64, ST77XX_WHITE);
  lcd.fillRect(oldCactusX - 2, GROUND_Y - CACTUS_H - 2,
               CACTUS_W + 5, CACTUS_H + 3, ST77XX_WHITE);
  lcd.drawFastHLine(0, GROUND_Y, SCREEN_W, ST77XX_BLACK);
  drawDino(DINO_X, int(dinoY));
  drawCactus(int(cactusX));
}

bool hitCactus() {
  // 공룡 상자와 선인장 상자가 겹치는지 확인합니다.
  int dinoLeft = DINO_X + 5;
  int dinoRight = DINO_X + DINO_W;
  int dinoTop = int(dinoY) + 3;
  int dinoBottom = int(dinoY) + DINO_H;
  int cactusLeft = int(cactusX) + 2;
  int cactusRight = int(cactusX) + CACTUS_W;
  int cactusTop = GROUND_Y - CACTUS_H + 2;
  return dinoRight > cactusLeft && dinoLeft < cactusRight &&
         dinoBottom > cactusTop && dinoTop < GROUND_Y;
}

void updateGame() {
  int oldCactusX = int(cactusX);
  if (jumping) {
    jumpSpeed += GRAVITY;
    dinoY += jumpSpeed;
    if (dinoY >= DINO_GROUND_Y) {
      dinoY = DINO_GROUND_Y;
      jumpSpeed = 0;
      jumping = false;
    }
  }
  cactusX -= gameSpeed;
  if (cactusX < -CACTUS_W) cactusX = SCREEN_W + 80;

  if (hitCactus()) {
    state = GAME_OVER;
    triggerSound(SOUND_HIT);
    drawScene();
    showGameOver();
    return;
  }
  redrawMovingObjects(oldCactusX);
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
  showReady();
}

void loop() {
  bool buttonNow = digitalRead(Pin::BUTTON);
  bool justPressed = buttonNow == LOW && lastButton == HIGH;
  lastButton = buttonNow;

  if (justPressed && state == READY) startGame();
  else if (justPressed && state == PLAYING) startJump();
  else if (justPressed && state == GAME_OVER) startGame();

  uint32_t now = millis();
  if (state != PLAYING || int32_t(now - nextFrame) < 0) return;
  nextFrame = now + FRAME_MS;
  updateGame();
}
