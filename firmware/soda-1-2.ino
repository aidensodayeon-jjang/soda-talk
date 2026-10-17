#include <driver/i2s.h>
#include <math.h>
#include <string.h>

// ========================
// 핀 설정
// ========================

// LED / 버튼
#define LED_PIN     2
#define BUTTON_PIN  4

// MAX98357A 앰프
#define I2S_BCLK    5
#define I2S_LRC     3
#define I2S_DOUT    44      // ESP32-S3 SuperMini RX 핀

#define I2S_PORT    I2S_NUM_0
#define SAMPLE_RATE 44100

// I2S 초기화 성공 시에만 재생합니다.
bool audioReady = false;


// ========================
// I2S 설정
// ========================

void setup() {

  Serial.begin(115200);

  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  digitalWrite(LED_PIN, LOW);


  i2s_config_t i2s_config = {

    .mode = (i2s_mode_t)(
      I2S_MODE_MASTER |
      I2S_MODE_TX
    ),

    .sample_rate = SAMPLE_RATE,

    .bits_per_sample =
      I2S_BITS_PER_SAMPLE_16BIT,

    .channel_format =
      I2S_CHANNEL_FMT_RIGHT_LEFT,

    .communication_format =
      I2S_COMM_FORMAT_STAND_I2S,

    .intr_alloc_flags = 0,

    .dma_buf_count = 8,
    .dma_buf_len = 256,

    .use_apll = false,
    .tx_desc_auto_clear = true,
    .fixed_mclk = 0
  };


  i2s_pin_config_t pin_config = {

    .bck_io_num = I2S_BCLK,

    .ws_io_num = I2S_LRC,

    .data_out_num = I2S_DOUT,

    .data_in_num =
      I2S_PIN_NO_CHANGE
  };


  esp_err_t err = i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("I2S driver error: %d\n", (int)err);
    return;
  }
  err = i2s_set_pin(I2S_PORT, &pin_config);
  if (err != ESP_OK) {
    Serial.printf("I2S pin error: %d\n", (int)err);
    return;
  }
  i2s_zero_dma_buffer(I2S_PORT);
  audioReady = true;
  Serial.println("I2S ready: BCLK=5, LRC=3, DIN=44 (RX)");

}


// ========================
// 메인
// ========================

void loop() {
  // USB 시리얼 진단: s=상태, t=440Hz 테스트음
  if (Serial.available()) {
    char command = Serial.read();
    if (command == 's') {
      Serial.printf("audioReady=%d, button=%d, BCLK=5 LRC=3 DIN=44\n", audioReady, digitalRead(BUTTON_PIN));
    } else if (command == 't') {
      Serial.println("TEST 440Hz begin");
      playTone(440.0, 700);
      Serial.println("TEST 440Hz end");
    }
  }


  if (digitalRead(BUTTON_PIN) == LOW) {

    digitalWrite(LED_PIN, HIGH);

    Serial.println("BUTTON: melody begin");
    // 도
    playTone(523.25, 180);

    delay(40);

    // 미
    playTone(659.25, 180);

    delay(40);

    // 솔
    playTone(783.99, 300);


    Serial.println("BUTTON: melody end");
    // 버튼을 놓을 때까지 기다림
    while (digitalRead(BUTTON_PIN) == LOW) {
      delay(10);
    }

    digitalWrite(LED_PIN, LOW);

    delay(50);
  }
}


// ========================
// 사인파 소리 출력
// ========================

void playTone(float frequency, int duration_ms) {

  if (!audioReady) {
    Serial.println("Audio unavailable: check I2S setup errors.");
    return;
  }
  const int BUFFER_FRAMES = 256;

  int16_t buffer[BUFFER_FRAMES * 2];

  float phase = 0;

  float phaseStep =
    2.0 * PI * frequency / SAMPLE_RATE;


  int totalSamples =
    SAMPLE_RATE * duration_ms / 1000;

  int generated = 0;


  while (generated < totalSamples) {

    int count =
      min(BUFFER_FRAMES,
          totalSamples - generated);


    for (int i = 0; i < count; i++) {

      // 시작과 끝 5ms에 음량을 서서히 바꿔 클릭음을 줄입니다.
      const int rampSamples = SAMPLE_RATE / 200;
      const int position = generated + i;
      const float fadeIn = fminf(1.0f, (float)position / rampSamples);
      const float fadeOut = fminf(1.0f, (float)(totalSamples - 1 - position) / rampSamples);
      int16_t sample = (int16_t)(sin(phase) * 3000 * fminf(fadeIn, fadeOut));

      phase += phaseStep;

      if (phase >= 2.0 * PI) {
        phase -= 2.0 * PI;
      }


      // 좌/우 동일 신호
      buffer[i * 2]     = sample;
      buffer[i * 2 + 1] = sample;
    }


    const uint8_t *data = (const uint8_t *)buffer;
    const size_t totalBytes = count * 2 * sizeof(int16_t);
    size_t offset = 0;
    while (offset < totalBytes) {
      size_t bytesWritten = 0;
      esp_err_t err = i2s_write(I2S_PORT, data + offset, totalBytes - offset,
                                &bytesWritten, portMAX_DELAY);
      if (err != ESP_OK || bytesWritten == 0) {
        Serial.printf("I2S write error: %d, bytes=%u\n", (int)err, (unsigned)bytesWritten);
        return;
      }
      offset += bytesWritten;
    }

    generated += count;
  }


  // DMA에 대기 중인 음을 지우지 않고 무음으로 이어줍니다.
  // 8개 DMA 버퍼보다 많은 무음을 보내 마지막 음이 출력되게 합니다.
  memset(buffer, 0, sizeof(buffer));
  for (int block = 0; block < 9; block++) {
    size_t offset = 0;
    while (offset < sizeof(buffer)) {
      size_t written = 0;
      esp_err_t err = i2s_write(I2S_PORT, ((const uint8_t *)buffer) + offset,
                                sizeof(buffer) - offset, &written, portMAX_DELAY);
      if (err != ESP_OK || written == 0) {
        Serial.printf("I2S silence error: %d\n", (int)err);
        return;
      }
      offset += written;
    }
  }
}
