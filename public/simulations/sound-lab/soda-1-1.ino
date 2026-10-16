#include <driver/i2s.h>
#include <math.h>

// ========================
// 스피커 핀 설정
// ========================
#define I2S_BCLK  5
#define I2S_LRC   3
#define I2S_DOUT  44

#define I2S_PORT I2S_NUM_0
#define SAMPLE_RATE 44100


// ========================
// 소리 내기 함수
// 수정하지 마세요
// ========================
void playTone(float freq, int duration) {

  int samples = SAMPLE_RATE * duration / 1000;
  int16_t buffer[2];

  for (int i = 0; i < samples; i++) {

    int16_t sound =
      sin(2 * PI * freq * i / SAMPLE_RATE) * 6000;

    buffer[0] = sound;
    buffer[1] = sound;

    size_t written;

    i2s_write(
      I2S_PORT,
      buffer,
      sizeof(buffer),
      &written,
      portMAX_DELAY
    );
  }

  i2s_zero_dma_buffer(I2S_PORT);
}


// ========================
// 처음 한 번 실행
// ========================
void setup() {

  // I2S 설정
  i2s_config_t i2s_config = {

    .mode = (i2s_mode_t)(
      I2S_MODE_MASTER |
      I2S_MODE_TX
    ),

    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,

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


  // 핀 연결
  i2s_pin_config_t pin_config = {

    .bck_io_num = I2S_BCLK,
    .ws_io_num = I2S_LRC,
    .data_out_num = I2S_DOUT,
    .data_in_num = I2S_PIN_NO_CHANGE
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


  // ==================================
  // 🎵 학생 실습 : 여기만 수정하세요!
  // ==================================

  playTone(262, 200);   // 도
  playTone(294, 200);   // 레
  playTone(330, 200);   // 미
  playTone(349, 200);   // 파
  playTone(392, 200);   // 솔
  playTone(440, 200);   // 라
  playTone(494, 200);   // 시
  playTone(523, 500);   // 높은 도

  // ==================================
}


// 반복 실행 없음
void loop() {

}
