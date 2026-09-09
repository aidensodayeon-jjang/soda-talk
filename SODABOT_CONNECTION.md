# 소다봇 연결 수정

사용할 펌웨어: 웹 맞춤 다운로드 또는 Arduino soda-basic 스케치. ESP32-S3, USB CDC On Boot 활성화.
웹 앱은 소다봇의 `ws://IP:8080/soda/ws`에 접속합니다. HTTPS에서 로컬 WebSocket이 차단되면 BLE 직접 제어 또는 localhost 웹을 사용합니다.

원인: 웹의 중복 소켓/HTTP/BLE 전송, 생성 펌웨어의 단일 TCP 클라이언트 처리, 저장된 연결 상태 오인, 이전 기본 코드와 명령 형식 불일치. 생성 펌웨어의 핀도 원본 v2 보드와 달랐습니다.

수정: 전역 단일 전송 객체, JSON 명령과 id별 처리 완료 응답, BLE 20바이트 분할/줄바꿈 조립, 실제 연결 상태 추적, 기본 표정/한글 텍스트 처리. 웹 다운로드 코드는 동일한 프로토콜과 v2 핀을 사용하며 API 키를 포함하지 않습니다.

명령 예:
- `{"id":"1","action":"set_expression","value":"heart"}`
- `{"id":"2","action":"send_message","value":"안녕하세요"}`
- `{"id":"3","action":"get_status"}`
- 성공: `{"id":"2","state":"success"}`
- 미지원 명령은 error 응답. 텍스트는 화면 표시이며 GPT/TTS 호출이 아닙니다.
- BLE/USB 메시지는 줄바꿈으로 끝냅니다. 한글 텍스트 최대 360바이트.

현재 기본 펌웨어는 기본 표정/텍스트/효과음을 지원합니다. render_face/render_pixels 등 임의 도안 명령은 미지원 오류를 반환합니다.

검증: npm run lint, npm run build. 회귀 테스트는 src/utils/sodabotTransport.test.ts를 esbuild로 Node ESM 번들링해 실행합니다.
실제 ESP32-S3에 업로드 후 USB와 Wi-Fi WebSocket에서 표정/한글 텍스트 완료 응답을 확인했습니다.
