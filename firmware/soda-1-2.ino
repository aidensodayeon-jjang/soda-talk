#include <driver/i2s.h>
#include <math.h>

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


  i2s_driver_install(
    I2S_PORT,
    &i2s_config,
    0,
    NULL
  );


  i2s_set_pin(
    I2S_PORT,
    &pin_config
  );
}


// ========================
// 메인
// ========================

void loop() {

  if (digitalRead(BUTTON_PIN) == LOW) {

    digitalWrite(LED_PIN, HIGH);

    // 도
    playTone(523.25, 180);

    delay(40);

    // 미
    playTone(659.25, 180);

    delay(40);

    // 솔
    playTone(783.99, 300);


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

      // 볼륨
      int16_t sample =
        (int16_t)(sin(phase) * 6000);

      phase += phaseStep;

      if (phase >= 2.0 * PI) {
        phase -= 2.0 * PI;
      }


      // 좌/우 동일 신호
      buffer[i * 2]     = sample;
      buffer[i * 2 + 1] = sample;
    }


    size_t bytesWritten;

    i2s_write(
      I2S_PORT,
      buffer,
      count * 2 * sizeof(int16_t),
      &bytesWritten,
      portMAX_DELAY
    );


    generated += count;
  }


  // 소리 끄기
  i2s_zero_dma_buffer(I2S_PORT);
}
