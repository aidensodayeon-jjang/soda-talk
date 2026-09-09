#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <Preferences.h>
#include <driver/i2s.h>

// ==================================
// 오늘의 실습
// ==================================
//
// 오늘 배울 기능: 지금까지 배운 기능을 합쳐 완성형 디노 게임 완성하기 (I2S 사운드 포함)
// 학생이 수정할 부분: 바로 아래의 "학생 게임 설정"
// 수정하지 않아도 되는 부분: 충돌 계산, I2S 스피커 사운드, 부드러운 화면 처리
//

// ========================
// 학생 게임 설정
// ========================
// ★★★ [실습 미션: 나만의 게임으로 커스텀하기] ★★★
float JUMP_POWER = -8.5f;  // 👈 MISSION A: SUPER JUMP (점프의 힘)
float GRAVITY = 0.48f;     // 중력

float START_SPEED = 5.0f;  // 👈 MISSION B: HARD MODE (시작 속도)
float SPEED_UP = 0.08f;    // 👈 MISSION C: SPEED UP (가속도)

int CACTUS_WIDTH = 20;     // 👈 MISSION D: BIG CACTUS (장애물 너비)
int DINO_X = 45;

// MISSION E: drawDino()를 바꾸어 NEW DINO 만들기
// MISSION F: drawCactus()를 바꾸어 NEW ENEMY 만들기
// MISSION G: 제목, 캐릭터, 장애물, 속도를 모두 바꾸어 MY GAME 만들기

// ==================================
// 수정하지 마세요: 보드와 게임 기본 설정
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
constexpr int SCREEN_H = 240;
constexpr int GROUND_Y = 190;
constexpr int DINO_W = 34, DINO_H = 38;
constexpr int DINO_GROUND_Y = GROUND_Y - DINO_H;
constexpr int CACTUS_H = 38;
constexpr uint32_t FRAME_MS = 33;

SPIClass screenSPI(HSPI);
Adafruit_ST7789 lcd(&screenSPI, Pin::CS, Pin::DC, Pin::RST);
GFXcanvas1 gameScreen(SCREEN_W, SCREEN_H);
Preferences scoreMemory;

enum GameState { READY, PLAYING, GAME_OVER };
GameState state = READY;

enum SoundType { SOUND_NONE = 0, SOUND_JUMP = 1, SOUND_HIT = 2, SOUND_POINT = 3 };
TaskHandle_t soundTaskHandle = nullptr;

float dinoY = DINO_GROUND_Y;
float jumpSpeed = 0;
float cactusX = SCREEN_W + 70;
float gameSpeed = START_SPEED;
unsigned score = 0;
unsigned bestScore = 0;
bool jumping = false;
bool cactusPassed = false;
bool runFrame = false;
uint32_t nextFrame = 0;

bool stableButton = HIGH;
bool previousReading = HIGH;
bool buttonPressed = false;
uint32_t buttonChangedAt = 0;

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

void playPointSound() {
  constexpr int SOUND_MS = 80;
  constexpr int TOTAL_FRAMES = SAMPLE_RATE * SOUND_MS / 1000;
  constexpr int CHUNK_FRAMES = 128;
  int16_t samples[CHUNK_FRAMES * 2];
  float phase = 0.0f;

  for (int frame = 0; frame < TOTAL_FRAMES;) {
    int framesNow = min(CHUNK_FRAMES, TOTAL_FRAMES - frame);
    for (int i = 0; i < framesNow; ++i) {
      float progress = float(frame + i) / TOTAL_FRAMES;
      float frequency = 1200.0f + 400.0f * progress;
      float volume = 0.25f * (1.0f - progress);
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
  vTaskDelay(pdMS_TO_TICKS(20));
  i2s_zero_dma_buffer(I2S_PORT);
}

void soundTask(void *parameter) {
  while (true) {
    uint32_t soundVal = ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
    if (soundVal == SOUND_HIT) {
      playHitSound();
    } else if (soundVal == SOUND_POINT) {
      playPointSound();
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
  xTaskCreatePinnedToCore(soundTask, "dinoSound", 2048, nullptr, 1,
                         &soundTaskHandle, 0);
}

void updateButton(uint32_t now) {
  bool reading = digitalRead(Pin::BUTTON);
  buttonPressed = false;

  if (reading != previousReading) {
    previousReading = reading;
    buttonChangedAt = now;
  }
  if (reading != stableButton && now - buttonChangedAt >= 22) {
    stableButton = reading;
    buttonPressed = stableButton == LOW;
  }
}

void centerText(const char *text, int y, int size) {
  int16_t x1, y1;
  uint16_t width, height;
  gameScreen.setTextSize(size);
  gameScreen.getTextBounds(text, 0, y, &x1, &y1, &width, &height);
  gameScreen.setTextColor(1);
  gameScreen.setCursor((SCREEN_W - width) / 2, y);
  gameScreen.print(text);
}

void drawDino(int x, int y, bool legFrame) {
  gameScreen.fillRect(x + 13, y + 13, 15, 20, 1);       // 몸통
  gameScreen.fillRect(x + 20, y, 23, 18, 1);            // 머리
  gameScreen.fillRect(x + 38, y + 13, 7, 5, 1);         // 입
  gameScreen.fillTriangle(x + 14, y + 17, x - 4, y + 9,
                          x + 10, y + 27, 1);             // 꼬리
  gameScreen.fillRect(x + 34, y + 4, 3, 3, 0);          // 눈

  if (legFrame) {
    gameScreen.fillRect(x + 14, y + 30, 5, 8, 1);
    gameScreen.fillRect(x + 25, y + 34, 8, 4, 1);
  } else {
    gameScreen.fillRect(x + 25, y + 30, 5, 8, 1);
    gameScreen.fillRect(x + 13, y + 34, 8, 4, 1);
  }
}

void drawCactus(int x) {
  int width = max(8, CACTUS_WIDTH);
  int trunkWidth = max(5, width / 3);
  int trunkX = x + (width - trunkWidth) / 2;
  int y = GROUND_Y - CACTUS_H;

  gameScreen.fillRect(trunkX, y, trunkWidth, CACTUS_H, 1);
  gameScreen.fillRect(x, y + 13, trunkX - x + 1, 5, 1);
  gameScreen.fillRect(x, y + 6, 4, 11, 1);
  gameScreen.fillRect(trunkX + trunkWidth - 1, y + 20,
                      x + width - trunkX - trunkWidth + 1, 5, 1);
  gameScreen.fillRect(x + width - 4, y + 12, 4, 12, 1);
}

void drawGround() {
  gameScreen.drawFastHLine(0, GROUND_Y, SCREEN_W, 1);
  for (int x = 8; x < SCREEN_W; x += 31) {
    gameScreen.drawFastHLine(x, GROUND_Y + 8 + (x % 3), 11, 1);
  }
}

void drawHud() {
  gameScreen.setTextColor(1);
  gameScreen.setTextSize(2);
  gameScreen.setCursor(8, 9);
  gameScreen.print("DINO GAME");

  gameScreen.setTextSize(1);
  gameScreen.setCursor(185, 10);
  gameScreen.printf("SCORE %04u", score);
  gameScreen.setCursor(252, 23);
  gameScreen.printf("BEST %04u", bestScore);
}

void drawGame() {
  gameScreen.fillScreen(0);  // 메모리 속에서 새 화면을 먼저 완성합니다.
  drawHud();
  drawGround();
  drawDino(DINO_X, int(dinoY), runFrame);
  drawCactus(int(cactusX));

  if (state == READY) {
    centerText("PRESS UP", 65, 3);
    centerText("JUMP OVER THE CACTUS", 108, 1);
  } else if (state == GAME_OVER) {
    gameScreen.fillRect(45, 52, 230, 99, 0);
    gameScreen.drawRect(45, 52, 230, 99, 1);
    centerText("GAME OVER", 68, 3);
    centerText("PRESS UP TO RETRY", 112, 1);
    centerText("WRITE DOWN YOUR BEST SCORE!", 132, 1);
  }
}

void showGameScreen() {
  const uint8_t *pixels = gameScreen.getBuffer();
  constexpr int bytesPerRow = (SCREEN_W + 7) / 8;
  static uint16_t lcdRow[SCREEN_W];

  lcd.startWrite();
  lcd.setAddrWindow(0, 0, SCREEN_W, SCREEN_H);
  for (int y = 0; y < SCREEN_H; y++) {
    const uint8_t *source = pixels + y * bytesPerRow;
    for (int x = 0; x < SCREEN_W; x++) {
      bool blackPixel = source[x >> 3] & (0x80 >> (x & 7));
      lcdRow[x] = blackPixel ? ST77XX_BLACK : ST77XX_WHITE;
    }
    lcd.writePixels(lcdRow, SCREEN_W, true, false);
  }
  lcd.endWrite();
}

void startJump() {
  if (jumping) return;
  jumping = true;
  jumpSpeed = JUMP_POWER;
  triggerSound(SOUND_JUMP);
}

void startGame() {
  state = PLAYING;
  score = 0;
  gameSpeed = START_SPEED;
  dinoY = DINO_GROUND_Y;
  jumpSpeed = 0;
  cactusX = SCREEN_W + random(70, 150);
  jumping = false;
  cactusPassed = false;
  runFrame = false;
}

bool hitCactus() {
  int cactusWidth = max(8, CACTUS_WIDTH);
  int dinoLeft = DINO_X + 5;
  int dinoRight = DINO_X + DINO_W;
  int dinoTop = int(dinoY) + 3;
  int dinoBottom = int(dinoY) + DINO_H;
  int cactusLeft = int(cactusX) + 2;
  int cactusRight = int(cactusX) + cactusWidth;
  int cactusTop = GROUND_Y - CACTUS_H + 2;
  return dinoRight > cactusLeft && dinoLeft < cactusRight &&
         dinoBottom > cactusTop && dinoTop < GROUND_Y;
}

void finishGame() {
  state = GAME_OVER;
  triggerSound(SOUND_HIT);
  if (score > bestScore) {
    bestScore = score;
    scoreMemory.putUInt("best", bestScore);
  }
}

void updateGame() {
  if (jumping) {
    jumpSpeed += GRAVITY;
    dinoY += jumpSpeed;
    if (dinoY >= DINO_GROUND_Y) {
      dinoY = DINO_GROUND_Y;
      jumpSpeed = 0;
      jumping = false;
    }
  }

  int cactusWidth = max(8, CACTUS_WIDTH);
  cactusX -= gameSpeed;
  if (!cactusPassed && cactusX + cactusWidth < DINO_X) {
    cactusPassed = true;
    score++;
    gameSpeed = min(8.0f, START_SPEED + score * SPEED_UP);
    if (score % 10 == 0) {
      triggerSound(SOUND_POINT);
    }
  }
  if (cactusX < -cactusWidth) {
    cactusX = SCREEN_W + random(70, 160);  // 매번 간격이 달라집니다.
    cactusPassed = false;
  }

  if (!jumping) runFrame = !runFrame;
  if (hitCactus()) finishGame();
}

void setup() {
  pinMode(Pin::BUTTON, INPUT_PULLUP);
  pinMode(Pin::LED, OUTPUT);
  setupSpeaker();
  randomSeed(micros());
  scoreMemory.begin("dino-class", false);
  bestScore = scoreMemory.getUInt("best", 0);

  screenSPI.begin(Pin::CLK, -1, Pin::MOSI, Pin::CS);
  lcd.init(240, 320);
  lcd.setSPISpeed(20000000);
  lcd.setRotation(3);
  lcd.invertDisplay(true);

  drawGame();
  showGameScreen();
}

void loop() {
  uint32_t now = millis();
  updateButton(now);

  if (buttonPressed && state == READY) {
    startGame();
    startJump();
  } else if (buttonPressed && state == PLAYING) {
    startJump();
  } else if (buttonPressed && state == GAME_OVER) {
    startGame();
    startJump();
  }

  if (state != PLAYING || int32_t(now - nextFrame) < 0) return;
  nextFrame = now + FRAME_MS;
  updateGame();
  drawGame();
  showGameScreen();
}
