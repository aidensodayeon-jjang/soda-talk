#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>

// ==================================
// 오늘의 실습
// ==================================
//
// 오늘 배울 기능: X값을 줄여 선인장을 왼쪽으로 움직이기
// 학생이 수정할 부분: gameSpeed
// 수정하지 않아도 되는 부분: 점프와 화면 갱신
//

// ========================
// 학생 게임 설정
// ========================
float gameSpeed = 5.0f;  // 3.0, 5.0, 7.0으로 바꿔 보세요.
float JUMP_POWER = -8.5f;
float GRAVITY = 0.48f;

// ==================================
// 수정하지 마세요: 게임 기본 코드
// ==================================
namespace Pin {
constexpr uint8_t BUTTON = 4;
constexpr int MOSI = 11, CLK = 12, CS = 13, DC = 7, RST = 6;
}

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
