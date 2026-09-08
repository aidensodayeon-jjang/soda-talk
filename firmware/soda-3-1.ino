#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <SPI.h>

// ========================
// LCD 핀 설정 (하드웨어 SPI)
// ========================
#define TFT_MOSI 11  // 보드: DIN
#define TFT_CLK  12  // 보드: CLK
#define TFT_CS   13  // 보드: CS
#define TFT_DC   7   // 보드: DC
#define TFT_RST  6   // 보드: RST

SPIClass hspi(HSPI);
Adafruit_ST7789 tft = Adafruit_ST7789(&hspi, TFT_CS, TFT_DC, TFT_RST);

void setup() {
  Serial.begin(115200);

  // ---- LCD 초기화 ----
  hspi.begin(TFT_CLK, -1, TFT_MOSI, TFT_CS);
  tft.init(240, 320);
  tft.setSPISpeed(4000000);   // 통신 속도 설정
  tft.setRotation(3);         // 320x240 가로 화면 모드
  tft.invertDisplay(true);    // 색상 반전

  // ---- 화면 지우기 ----
  tft.fillScreen(ST77XX_BLACK);

  // ---- 중앙 글씨 출력 ----
  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(3);
  tft.setCursor(60, 105);
  tft.print("Hello SODA!");
}

void loop() {
  // 기본 대기
}
