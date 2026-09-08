#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>

// ==================================
// 오늘의 실습
// ==================================
//
// 오늘 배울 기능: Y좌표로 공룡의 높이 바꾸기
// 학생이 수정할 부분: 아래 dinoY 숫자
// 수정하지 않아도 되는 부분: LCD 설정과 공룡 그리기 함수
//

// ========================
// 학생 실습: 152, 120, 90을 차례로 입력하세요.
// ========================
int dinoY = 152;

// ==================================
// 수정하지 마세요: 게임 기본 코드
// ==================================
namespace Pin {
constexpr int MOSI = 11, CLK = 12, CS = 13, DC = 7, RST = 6;
}

constexpr int SCREEN_W = 320;
constexpr int GROUND_Y = 190;
constexpr int DINO_X = 45;

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

void setup() {
  screenSPI.begin(Pin::CLK, -1, Pin::MOSI, Pin::CS);
  lcd.init(240, 320);
  lcd.setSPISpeed(20000000);
  lcd.setRotation(3);
  lcd.invertDisplay(true);

  lcd.fillScreen(ST77XX_WHITE);
  lcd.drawFastHLine(0, GROUND_Y, SCREEN_W, ST77XX_BLACK);
  drawDino(DINO_X, dinoY);
}

void loop() {
  // 숫자를 바꾼 뒤 다시 업로드하여 위치를 확인합니다.
}
