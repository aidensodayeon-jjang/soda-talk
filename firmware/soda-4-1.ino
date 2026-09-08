#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>

// ==================================
// 오늘의 실습
// ==================================
//
// 오늘 배울 기능: 도형으로 공룡과 바닥 그리기
// 학생이 수정할 부분: drawDino() 안의 도형을 바꿔 보세요.
// 수정하지 않아도 되는 부분: LCD 연결과 초기화
//

// ========================
// 학생 그림 설정
// ========================
int DINO_X = 45;
int DINO_Y = 152;

// ==================================
// 수정하지 마세요: LCD 기본 설정
// ==================================
namespace Pin {
constexpr int MOSI = 11, CLK = 12, CS = 13, DC = 7, RST = 6;
}

constexpr int SCREEN_W = 320;
constexpr int SCREEN_H = 240;
constexpr int GROUND_Y = 190;

SPIClass screenSPI(HSPI);
Adafruit_ST7789 lcd(&screenSPI, Pin::CS, Pin::DC, Pin::RST);

void drawDino(int x, int y) {
  lcd.fillRect(x + 13, y + 13, 15, 20, ST77XX_BLACK);       // 몸통
  lcd.fillRect(x + 20, y, 23, 18, ST77XX_BLACK);            // 머리
  lcd.fillRect(x + 38, y + 13, 7, 5, ST77XX_BLACK);         // 입
  lcd.fillTriangle(x + 14, y + 17, x - 4, y + 9,
                   x + 10, y + 27, ST77XX_BLACK);           // 꼬리
  lcd.fillRect(x + 34, y + 4, 3, 3, ST77XX_WHITE);          // 눈
  lcd.fillRect(x + 14, y + 30, 5, 8, ST77XX_BLACK);         // 왼쪽 다리
  lcd.fillRect(x + 25, y + 34, 8, 4, ST77XX_BLACK);         // 오른쪽 다리
}

void setup() {
  screenSPI.begin(Pin::CLK, -1, Pin::MOSI, Pin::CS);
  lcd.init(240, 320);
  lcd.setSPISpeed(20000000);
  lcd.setRotation(3);
  lcd.invertDisplay(true);

  lcd.fillScreen(ST77XX_WHITE);
  lcd.drawFastHLine(0, GROUND_Y, SCREEN_W, ST77XX_BLACK);
  drawDino(DINO_X, DINO_Y);
}

void loop() {
  // 1단계에서는 공룡이 움직이지 않습니다.
}
