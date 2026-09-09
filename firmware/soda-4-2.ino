#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>

// ==================================
// 오늘의 실습
// ==================================
//
// 오늘 배울 기능: 여러 Y 위치를 빠르게 보여 주어 움직임 만들기
// 학생이 수정할 부분: 
//   1. 18라인 JUMP_DELAY 숫자 (점프 속도)
//   2. 59라인 jumpY[] 점프 높이 배열 (점프 높이 Y좌표 목록)
// 수정하지 않아도 되는 부분: LCD 설정과 공룡 그리기 함수
//

// ========================
// 학생 게임 설정
// ========================
int JUMP_DELAY = 70;  // 작을수록 점프 애니메이션이 빨라집니다.

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
constexpr int DINO_GROUND_Y = 152;

SPIClass screenSPI(HSPI);
Adafruit_ST7789 lcd(&screenSPI, Pin::CS, Pin::DC, Pin::RST);

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

void showDinoAt(int y) {
  // 화면 전체가 아니라 공룡이 움직이는 부분만 지웁니다.
  lcd.fillRect(DINO_X - 5, 85, 55, GROUND_Y - 84, ST77XX_WHITE);
  lcd.drawFastHLine(0, GROUND_Y, SCREEN_W, ST77XX_BLACK);
  drawDino(DINO_X, y);
}

void simpleJump() {
  // ========================================================
  // ★★★ [실습 미션: 59라인 점프 높이(Y좌표) 바꾸기] ★★★
  // 숫자가 작을수록 화면 더 높은 곳으로 점프합니다! (예: 90 -> 60)
  // ========================================================
  int jumpY[] = {152, 130, 110, 90, 110, 130, 152}; // 👈 [여기!] 공룡이 거쳐갈 Y좌표 목록
  int stepCount = sizeof(jumpY) / sizeof(jumpY[0]);

  for (int step = 0; step < stepCount; step++) {
    showDinoAt(jumpY[step]);
    delay(JUMP_DELAY);
  }
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
  drawDino(DINO_X, DINO_GROUND_Y);
}

void loop() {
  if (digitalRead(Pin::BUTTON) == LOW) {
    simpleJump();
    while (digitalRead(Pin::BUTTON) == LOW) delay(5);
    delay(20);
  }
}
