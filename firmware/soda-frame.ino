#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <SPI.h>

#define TFT_MOSI 11
#define TFT_CLK 12
#define TFT_CS 13
#define TFT_DC 7
#define TFT_RST 6
SPIClass hspi(HSPI);
Adafruit_ST7789 tft(&hspi, TFT_CS, TFT_DC, TFT_RST);

void setup() {
  // LCD 준비 — 이 부분은 그대로 두세요.
  hspi.begin(TFT_CLK, -1, TFT_MOSI, TFT_CS);
  tft.init(240, 320);
  tft.setSPISpeed(4000000);
  tft.setRotation(3);
  tft.invertDisplay(true);

  // [수정 1] 액자 색상: BLACK, BLUE, GREEN 등으로 바꿔보세요.
  tft.fillScreen(ST77XX_BLACK);
  tft.drawRect(8, 8, 304, 224, ST77XX_YELLOW);
  tft.drawRect(14, 14, 292, 212, ST77XX_YELLOW);
  // [/수정 1]

  // [수정 2] 장식 위치·크기: x, y, 반지름을 바꿔보세요.
  tft.fillCircle(55, 65, 20, ST77XX_CYAN);
  tft.drawCircle(265, 65, 20, ST77XX_MAGENTA);
  tft.drawLine(45, 175, 275, 175, ST77XX_WHITE);
  // [/수정 2]

  // [수정 3] 액자 제목: 따옴표 안을 영문 이름이나 문구로 바꿔보세요.
  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(3);
  tft.setCursor(65, 110);
  tft.print("MY FRAME");
  // [/수정 3]
}

void loop() {
}
