#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>

// ==================================
// 오늘의 실습
// ==================================
//
// 오늘 배울 기능: 점프의 힘과 중력으로 자연스럽게 움직이기
// 학생이 수정할 부분: JUMP_POWER, GRAVITY
// 수정하지 않아도 되는 부분: 버튼 처리와 화면 갱신
//

// ========================
// 학생 게임 설정
// ========================
float JUMP_POWER = -8.5f;  // 점프의 힘
float GRAVITY = 0.48f;     // 공룡을 아래로 끌어당기는 힘

// ==================================
// 수정하지 마세요: 게임 기본 코드
// ==================================
namespace Pin {
constexpr uint8_t BUTTON = 4;
constexpr int MOSI = 11, CLK = 12, CS = 13, DC = 7, RST = 6;
}

constexpr int SCREEN_W = 320;
constexpr int GROUND_Y = 190;
constexpr int DINO_X = 45;
constexpr int DINO_H = 38;
constexpr int DINO_GROUND_Y = GROUND_Y - DINO_H;
constexpr uint32_t FRAME_MS = 33;

SPIClass screenSPI(HSPI);
Adafruit_ST7789 lcd(&screenSPI, Pin::CS, Pin::DC, Pin::RST);

float dinoY = DINO_GROUND_Y;
float jumpSpeed = 0;
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

void redrawDino() {
  lcd.fillRect(DINO_X - 5, 65, 55, GROUND_Y - 64, ST77XX_WHITE);
  lcd.drawFastHLine(0, GROUND_Y, SCREEN_W, ST77XX_BLACK);
  drawDino(DINO_X, int(dinoY));
}

void startJump() {
  if (jumping) return;  // 점프 중에는 다시 점프하지 않습니다.
  jumping = true;
  jumpSpeed = JUMP_POWER;
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
  redrawDino();
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
}

void loop() {
  bool buttonNow = digitalRead(Pin::BUTTON);
  bool justPressed = buttonNow == LOW && lastButton == HIGH;
  lastButton = buttonNow;
  if (justPressed) startJump();

  uint32_t now = millis();
  if (int32_t(now - nextFrame) < 0) return;
  nextFrame = now + FRAME_MS;
  updateJump();
}
