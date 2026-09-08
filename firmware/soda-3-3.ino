#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <SPI.h>

// LCD 핀
#define TFT_MOSI 11
#define TFT_CLK  12
#define TFT_CS   13
#define TFT_DC   7
#define TFT_RST  6

SPIClass hspi(HSPI);
Adafruit_ST7789 tft = Adafruit_ST7789(&hspi, TFT_CS, TFT_DC, TFT_RST);

void setup() {

  // LCD 시작
  hspi.begin(TFT_CLK, -1, TFT_MOSI, TFT_CS);
  tft.init(240, 320);
  tft.setSPISpeed(4000000);
  tft.setRotation(3);
  tft.invertDisplay(true);

  // 화면 지우기
  tft.fillScreen(ST77XX_BLACK);


  // ① 선
  tft.drawLine(
    20, 20,       // 시작점 x, y
    100, 60,      // 끝점 x, y
    ST77XX_WHITE
  );

  delay(2000);


  // ② 사각형
  tft.drawRect(
    40, 80,       // 시작점 x, y
    120, 60,      // width, height
    ST77XX_YELLOW
  );

  delay(2000);


  // ③ 원
  tft.drawCircle(
    220, 60,      // 중심 x, y
    40,           // radius
    ST77XX_CYAN
  );

  delay(2000);


  // ④ 채운 원
  tft.fillCircle(
    240, 170,     // 중심 x, y
    35,           // radius
    ST77XX_RED
  );
}

void loop() {

}
