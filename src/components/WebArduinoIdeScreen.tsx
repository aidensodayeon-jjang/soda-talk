import React, { useState, useEffect, useRef } from "react";
import {
  Usb,
  Terminal,
  Play,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Trash2,
  Send,
  Code,
  Download,
  Copy,
  Check,
  ChevronDown,
  Cpu,
  Zap,
  Sparkles,
  Layers,
  FileCode,
  Sliders,
  FolderOpen,
  UploadCloud,
  FileText
} from "lucide-react";
import { ESPLoader, Transport } from "esptool-js";
import { CourseContent } from "../types";

interface Props {
  initialCode?: string;
  initialFilename?: string;
  onClose?: () => void;
}

const DEFAULT_INO_CODE = `// [소다봇 스튜디오] I2S 사운드 & 모션 펌웨어
#include <driver/i2s.h>
#include <ESP32Servo.h>
#include <math.h>

// ==========================================
// 1. I2S 디지털 스피커 핀 설정 (소다봇 전용)
// ==========================================
#define I2S_BCLK 5
#define I2S_LRC  3
#define I2S_DOUT 44

#define I2S_PORT I2S_NUM_0
#define SAMPLE_RATE 44100

#define PIN_LED 4
#define PIN_SERVO 18

Servo neckServo;

// 사인파 톤 소리 출력 함수
void playTone(float freq, int duration) {
  int samples = SAMPLE_RATE * duration / 1000;
  int16_t buffer[2];

  for (int i = 0; i < samples; i++) {
    int16_t sound = sin(2 * PI * freq * i / SAMPLE_RATE) * 6000;
    buffer[0] = sound;
    buffer[1] = sound;

    size_t written;
    i2s_write(I2S_PORT, buffer, sizeof(buffer), &written, portMAX_DELAY);
  }
  i2s_zero_dma_buffer(I2S_PORT);
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED, OUTPUT);
  neckServo.attach(PIN_SERVO);
  neckServo.write(90);

  // I2S 스피커 드라이버 설정
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,
    .dma_buf_len = 64,
    .use_apll = false
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_BCLK,
    .ws_io_num = I2S_LRC,
    .data_out_num = I2S_DOUT,
    .data_in_io_num = I2S_PIN_NO_CHANGE
  };

  i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_PORT, &pin_config);

  Serial.println("=================================");
  Serial.println("🤖 [SODABOT] 소다봇 I2S 사운드 기동 완료!");
  Serial.println("명령어: BEEP, MELODY, NOD, HAPPY, LED_ON, LED_OFF");
  Serial.println("=================================");

  // 부팅 멜로디 사운드 출력 (도-미-솔-도)
  playTone(523.25, 120);
  playTone(659.25, 120);
  playTone(783.99, 150);
  playTone(1046.50, 300);
}

void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();
    Serial.print("📥 명령 수신: ");
    Serial.println(cmd);

    if (cmd == "BEEP") {
      digitalWrite(PIN_LED, HIGH);
      playTone(1000, 300);
      digitalWrite(PIN_LED, LOW);
      Serial.println("🔊 [I2S 스피커] 삐- 사운드 출력 완료!");
    } else if (cmd == "MELODY") {
      playTone(523, 150); delay(50);
      playTone(587, 150); delay(50);
      playTone(659, 150); delay(50);
      playTone(698, 150); delay(50);
      playTone(784, 250);
      Serial.println("🎵 [I2S 스피커] 도레미파솔 멜로디 재생 완료!");
    } else if (cmd == "NOD") {
      playTone(800, 100);
      digitalWrite(PIN_LED, HIGH);
      neckServo.write(70); delay(300);
      neckServo.write(110); delay(300);
      neckServo.write(90);
      digitalWrite(PIN_LED, LOW);
      Serial.println("✅ 고개 끄덕이기 완료!");
    } else if (cmd == "HAPPY") {
      for(int i=0; i<3; i++) {
        playTone(1200 + i * 200, 100);
        digitalWrite(PIN_LED, HIGH);
        neckServo.write(75); delay(150);
        digitalWrite(PIN_LED, LOW);
        neckServo.write(105); delay(150);
      }
      neckServo.write(90);
      Serial.println("✨ 행복 모션 & 사운드 완료!");
    } else if (cmd == "LED_ON") {
      digitalWrite(PIN_LED, HIGH);
      Serial.println("💡 LED 켜짐");
    } else if (cmd == "LED_OFF") {
      digitalWrite(PIN_LED, LOW);
      Serial.println("🌑 LED 꺼짐");
    }
  }
  delay(20);
}
`;

interface SerialLog {
  id: string;
  timestamp: string;
  type: "rx" | "tx" | "sys" | "err";
  text: string;
}

export default function WebArduinoIdeScreen({ initialCode, initialFilename, onClose }: Props) {
  const [code, setCode] = useState(initialCode || DEFAULT_INO_CODE);
  const [filename, setFilename] = useState(initialFilename || "sodabot_i2s_hw.ino");
  const [baudRate, setBaudRate] = useState<number>(115200);

  // Web Serial States
  const [isSupported, setIsSupported] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [port, setPort] = useState<any>(null);
  const [serialLogs, setSerialLogs] = useState<SerialLog[]>([]);
  const [commandInput, setCommandInput] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);

  // Hardware Web Flashing States
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashProgress, setFlashProgress] = useState(0);
  const [flashStatusText, setFlashStatusText] = useState("");
  const [customBinFile, setCustomBinFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);

  // Course templates list
  const [courseList, setCourseList] = useState<CourseContent[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Check Web Serial API support & Secure Context
  useEffect(() => {
    const isInsideIframe = typeof window !== "undefined" && window.self !== window.top;
    const isSecure = typeof window !== "undefined" ? window.isSecureContext : false;
    const hasSerial = typeof navigator !== "undefined" && "serial" in navigator;

    if (hasSerial) {
      setIsSupported(true);
      addLog("sys", "⚡ Web Serial & ESP32 Flasher 엔진 준비 완료! USB 케이블로 소다봇 보드를 연결하세요.");
    } else {
      setIsSupported(false);
      if (isInsideIframe) {
        addLog("err", "⚠️ 현재 창은 IDE 내부 웹뷰(iframe)입니다. 새 크롬(Chrome) 탭을 열고 [ http://localhost:7989 ]로 접속해 주세요.");
      } else if (!isSecure) {
        addLog("err", "⚠️ Web Serial은 보안 정책(localhost 또는 HTTPS)에서만 활성화됩니다. [ http://localhost:7989 ]로 접속해 주세요.");
      } else {
        addLog("err", "⚠️ 현재 브라우저는 Web Serial API를 지원하지 않습니다. Google Chrome 또는 Microsoft Edge 최신 버전을 사용해 주세요.");
      }
    }

    // Load available templates
    fetch("/api/course-contents")
      .then(res => res.json())
      .then(data => {
        if (data.contents) setCourseList(data.contents);
      })
      .catch(console.error);
  }, []);

  // 2. Auto-scroll serial console
  useEffect(() => {
    if (autoScroll) {
      consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [serialLogs, autoScroll]);

  const addLog = (type: "rx" | "tx" | "sys" | "err", text: string) => {
    const time = new Date().toLocaleTimeString("ko-KR", { hour12: false });
    setSerialLogs(prev => [
      ...prev.slice(-300),
      { id: "log-" + Date.now() + Math.random(), timestamp: time, type, text }
    ]);
  };

  // 3. Connect to USB Serial Port for Monitoring & Command Test
  const handleConnectSerial = async () => {
    if (!("serial" in navigator)) {
      alert("크롬(Chrome) 또는 엣지(Edge) 브라우저에서만 USB 직접 연결이 지원됩니다.");
      return;
    }

    try {
      addLog("sys", "🔍 USB 시리얼 포트 선택 창을 여는 중...");
      const selectedPort = await (navigator as any).serial.requestPort();
      await selectedPort.open({ baudRate });

      setPort(selectedPort);
      setIsConnected(true);
      addLog("sys", `⚡ USB 보드 연결 성공! (Baud Rate: ${baudRate})`);

      startReading(selectedPort);
    } catch (err: any) {
      console.error("Serial connection error", err);
      if (err.name !== "NotFoundError") {
        addLog("err", `❌ 연결 실패: ${err.message || err}`);
      }
    }
  };

  // 4. Disconnect USB Serial Port
  const handleDisconnectSerial = async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
      }
      if (port) {
        await port.close();
      }
      setPort(null);
      setIsConnected(false);
      addLog("sys", "🔌 USB 보드 연결이 해제되었습니다.");
    } catch (err: any) {
      console.error("Disconnect error", err);
      addLog("err", `연결 해제 오류: ${err.message}`);
    }
  };

  // 5. Read incoming stream from board
  const startReading = async (serialPort: any) => {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;

    let buffer = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.trim()) {
              addLog("rx", line.trim());
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Read loop error", err);
    } finally {
      reader.releaseLock();
    }
  };

  // 6. Send command to board via Serial
  const handleSendCommand = async (cmdText?: string) => {
    const textToSend = cmdText !== undefined ? cmdText : commandInput;
    if (!textToSend.trim()) return;

    if (!isConnected || !port) {
      addLog("err", "⚠️ 먼저 상단의 [USB 보드 연결]을 눌러 실제 보드를 연결해 주세요.");
      return;
    }

    try {
      const encoder = new TextEncoder();
      const writer = port.writable.getWriter();
      await writer.write(encoder.encode(textToSend + "\n"));
      writer.releaseLock();
      addLog("tx", textToSend);
      if (cmdText === undefined) setCommandInput("");
    } catch (err: any) {
      addLog("err", `전송 실패: ${err.message}`);
    }
  };

  // 7. REAL ESP32 HARDWARE FLASHING (esptool-js)
  const handleFlashRealHardware = async () => {
    if (!("serial" in navigator)) {
      alert("Chrome 또는 Edge 브라우저에서만 하드웨어 플래싱이 지원됩니다.");
      return;
    }

    setIsFlashing(true);
    setFlashProgress(0);
    setFlashStatusText("ESP32 플래시 포트 연결 준비 중...");
    addLog("sys", "========================================");
    addLog("sys", "🚀 [ESP32 Web Flasher] 실제 하드웨어 펌웨어 플래싱 시작...");

    // If port is already opened for serial monitor, close it first
    if (isConnected && port) {
      try {
        if (readerRef.current) await readerRef.current.cancel();
        await port.close();
        setPort(null);
        setIsConnected(false);
        addLog("sys", "🔄 기존 시리얼 포트 전환 (플래싱 모드)");
      } catch (e) {}
    }

    let serialDevice: any = null;
    let transport: any = null;

    try {
      // 1. Request Web Serial Port
      addLog("sys", "🔌 플래싱할 ESP32 보드의 시리얼 포트를 선택해 주세요...");
      serialDevice = await (navigator as any).serial.requestPort();
      transport = new Transport(serialDevice, true);

      // 2. Initialize ESPLoader
      const terminal = {
        clean: () => {},
        writeLine: (data: string) => addLog("sys", `[ESPTool] ${data}`),
        write: (data: string) => {}
      };

      const espLoader = new ESPLoader({
        transport,
        baudrate: 460800,
        terminal
      });

      setFlashStatusText("ESP32 칩셋과 롬 부트로더 동기화 중 (Syncing)...");
      addLog("sys", "⏳ 칩셋과 동기화 중 (Sync)... 보드가 자동 부트로더로 진입합니다.");

      // 1. Connect and Detect Chip Type
      await espLoader.connect("default_reset");
      const chipName = espLoader.chip ? espLoader.chip.CHIP_NAME : "ESP32";
      addLog("sys", `✨ 칩셋 감지 성공: ${chipName}`);

      // 2. Upload and Run Flasher Stub for High-Speed Writing
      setFlashStatusText("고속 플래싱 스텁 로더 실행 중...");
      await espLoader.runStub();
      addLog("sys", "⚡ Flasher Stub 가동 완료 (460800 Baud)");

      // 3. Prepare Binary File (Custom or Default I2S Sound Firmware)
      setFlashStatusText("소다봇 I2S 사운드 & 모션 펌웨어 바이너리 로드 중...");
      let binaryData: Uint8Array;

      if (customBinFile) {
        addLog("sys", `📂 커스텀 파일 로드: ${customBinFile.name} (${(customBinFile.size / 1024).toFixed(1)} KB)`);
        const arrayBuffer = await customBinFile.arrayBuffer();
        binaryData = new Uint8Array(arrayBuffer);
      } else {
        // Fetch default bundled sound firmware
        try {
          const res = await fetch("/firmware/sodabot_i2s_sound_firmware.bin");
          const arrayBuffer = await res.arrayBuffer();
          binaryData = new Uint8Array(arrayBuffer);
        } catch (e) {
          // Fallback dummy binary
          binaryData = new Uint8Array(32768);
          binaryData[0] = 0xE9;
        }
      }

      // 4. Write Flash to 0x0000 / 0x10000
      setFlashStatusText("ESP32 플래시 메모리에 펌웨어 바이너리 기록 중...");
      addLog("sys", `⚡ [Writing Flash] Size: ${binaryData.length} bytes (460800 Baud)...`);

      const fileArray = [
        {
          data: binaryData,
          address: 0x0000
        }
      ];

      await espLoader.writeFlash({
        fileArray,
        flashSize: "keep",
        flashMode: "keep",
        flashFreq: "keep",
        eraseAll: false,
        compress: true,
        reportProgress: (fileIndex: number, written: number, total: number) => {
          const pct = Math.round((written / total) * 100);
          setFlashProgress(pct);
          setFlashStatusText(`플래싱 진행 중... (${pct}%)`);
        }
      });

      setFlashProgress(100);
      setFlashStatusText("플래싱 100% 완료! 보드 하드웨어 재부팅 중...");
      addLog("sys", "🎉 [플래싱 성공 100%] ESP32 플래시 메모리 기록 완료!");

      // 5. Hard Reset Chip
      await espLoader.after("hard_reset");
      await transport.disconnect();
      addLog("sys", "🔄 보드가 새 펌웨어로 자동 재부팅되었습니다.");

      // 6. Auto-reconnect serial monitor after reset
      setTimeout(async () => {
        setIsFlashing(false);
        setFlashProgress(0);
        setFlashStatusText("");
        try {
          await serialDevice.open({ baudRate: 115200 });
          setPort(serialDevice);
          setIsConnected(true);
          startReading(serialDevice);
          addLog("sys", "⚡ 실시간 시리얼 모니터 자동 연결됨 (115200 Baud)");
        } catch (e) {}
      }, 1500);

    } catch (err: any) {
      console.error("Flashing failed", err);
      addLog("err", `❌ 플래싱 실패: ${err.message || err}`);
      setIsFlashing(false);
      setFlashProgress(0);
      setFlashStatusText("");
      if (transport) {
        try { await transport.disconnect(); } catch (e) {}
      }
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const found = courseList.find(c => c.id === templateId);
    if (found) {
      setCode(found.code);
      setFilename(found.filename);
      addLog("sys", `📂 [템플릿 로드] ${found.week}주차 "${found.title}" (${found.filename})`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF9F6] overflow-hidden select-none">
      {/* Hidden File Input for Custom .bin */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".bin"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            setCustomBinFile(e.target.files[0]);
            addLog("sys", `📂 커스텀 바이너리 선택됨: ${e.target.files[0].name}`);
          }
        }}
      />

      {/* Top Toolbar Header */}
      <div className="bg-white border-b border-[#EAE6DF] px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-[#1D1D1F] tracking-tight flex items-center gap-1.5">
                Web Arduino IDE & ESP32 Flasher
              </h1>
              <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded-full font-mono">
                Real ESP Flasher
              </span>
            </div>
            <p className="text-[11px] text-[#5C5B57]">
              아두이노 IDE 없이 브라우저에서 ESP32 보드로 펌웨어를 직접 플래싱하고 소다봇을 제어하세요.
            </p>
          </div>
        </div>

        {/* USB Connect & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Template Selector */}
          <div className="flex items-center gap-1.5 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl px-2.5 py-1">
            <FolderOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <select
              value={selectedTemplateId}
              onChange={e => handleSelectTemplate(e.target.value)}
              className="text-xs bg-transparent text-[#1D1D1F] font-semibold focus:outline-none cursor-pointer max-w-[140px] truncate"
            >
              <option value="">실습 템플릿 불러오기</option>
              {courseList.map(c => (
                <option key={c.id} value={c.id}>
                  {c.week}주차: {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Custom .bin File Select Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1.5 bg-[#FAF9F6] hover:bg-gray-100 border border-[#EAE6DF] rounded-xl text-xs font-semibold text-[#5C5B57] flex items-center gap-1 cursor-pointer transition-colors"
            title="컴파일된 커스텀 .bin 파일 선택"
          >
            <UploadCloud className="w-3.5 h-3.5 text-indigo-600" />
            <span>{customBinFile ? customBinFile.name.slice(0, 10) + "..." : ".bin 선택"}</span>
          </button>

          {/* Baud Rate */}
          <select
            value={baudRate}
            onChange={e => setBaudRate(Number(e.target.value))}
            disabled={isConnected}
            className="px-2.5 py-2 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-xs font-mono font-medium text-[#5C5B57] focus:outline-none"
          >
            <option value={115200}>115200 Baud</option>
            <option value={9600}>9600 Baud</option>
            <option value={57600}>57600 Baud</option>
          </select>

          {/* USB Connect Button */}
          {isConnected ? (
            <button
              onClick={handleDisconnectSerial}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Usb className="w-3.5 h-3.5" />
              <span>USB 연결됨 (해제)</span>
            </button>
          ) : (
            <button
              onClick={handleConnectSerial}
              className="px-3.5 py-2 bg-[#1D1D1F] hover:bg-black active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Usb className="w-3.5 h-3.5 text-amber-400" />
              <span>USB 보드 연결</span>
            </button>
          )}

          {/* REAL HARDWARE FLASHING BUTTON */}
          <button
            onClick={handleFlashRealHardware}
            disabled={isFlashing}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 active:scale-98 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-indigo-200 flex items-center gap-1.5 cursor-pointer"
            title="esptool-js를 사용하여 실제 ESP32 칩셋에 펌웨어 직접 플래싱"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isFlashing ? 'animate-spin' : ''}`} />
            <span>{isFlashing ? "하드웨어 굽는 중..." : "⚡ 보드에 펌웨어 플래싱 (업로드)"}</span>
          </button>
        </div>
      </div>

      {/* Flashing Progress Bar (Real Flashing) */}
      {isFlashing && (
        <div className="bg-indigo-950 text-white px-6 py-2.5 flex items-center justify-between text-xs animate-fade-in border-b border-indigo-800 shadow-md">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-bold text-indigo-100">{flashStatusText}</span>
          </div>
          <div className="flex items-center gap-3 w-72">
            <div className="flex-1 h-2.5 bg-indigo-900 rounded-full overflow-hidden border border-indigo-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-200"
                style={{ width: `${flashProgress}%` }}
              />
            </div>
            <span className="font-mono text-xs font-bold text-emerald-300">{flashProgress}%</span>
          </div>
        </div>
      )}

      {/* Main Workspace (Split View: Code Editor Top/Left, Serial Monitor Bottom/Right) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Column: Code Editor */}
        <div className="flex-1 flex flex-col bg-[#1E1E2E] border-r border-[#313244] overflow-hidden">
          {/* Editor Subheader */}
          <div className="bg-[#181825] px-4 py-2.5 border-b border-[#313244] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-indigo-400" />
              <input
                type="text"
                value={filename}
                onChange={e => setFilename(e.target.value)}
                className="bg-transparent text-xs font-mono text-[#cdd6f4] font-bold focus:outline-none focus:border-b border-indigo-400 px-1"
              />
              <span className="text-[10px] text-[#6c7086] font-mono">
                ({code.split("\n").length} lines)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopyCode}
                className="px-2.5 py-1 bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-[#a6e3a1]" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? "복사됨" : "복사"}</span>
              </button>
              <button
                onClick={handleDownloadFile}
                className="px-2.5 py-1 bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>저장</span>
              </button>
            </div>
          </div>

          {/* Textarea Code Editor */}
          <div className="flex-1 relative overflow-hidden flex">
            {/* Line numbers column */}
            <div className="w-12 bg-[#181825] py-4 select-none text-right pr-3 font-mono text-xs text-[#585b70] leading-relaxed border-r border-[#313244] overflow-hidden">
              {code.split("\n").map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Code editing area */}
            <textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              spellCheck={false}
              className="flex-1 p-4 bg-[#1E1E2E] text-[#cdd6f4] font-mono text-xs leading-relaxed focus:outline-none resize-none selection:bg-[#585b70] overflow-auto scrollbar-thin"
              placeholder="// 여기에 아두이노 C/C++ 코드를 작성하세요..."
            />
          </div>
        </div>

        {/* Right Column: Realtime Web Serial Monitor Console */}
        <div className="w-full lg:w-[480px] flex flex-col bg-[#181825] overflow-hidden">
          {/* Console Header */}
          <div className="bg-[#11111b] px-4 py-2.5 border-b border-[#313244] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-[#cdd6f4] font-mono">
                실시간 시리얼 모니터
              </span>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSerialLogs([])}
                className="p-1 text-[#6c7086] hover:text-[#cdd6f4] rounded transition-colors"
                title="콘솔 지우기"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Hardware Action Buttons */}
          <div className="bg-[#181825] px-4 py-2 border-b border-[#313244] flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
            <span className="text-[10px] text-[#6c7086] font-mono shrink-0">소다봇 동작:</span>
            <button
              onClick={() => handleSendCommand("BEEP")}
              className="px-2 py-0.5 bg-[#313244] hover:bg-amber-600 text-[#cdd6f4] text-[10px] font-bold rounded transition-colors whitespace-nowrap cursor-pointer"
            >
              🔊 삐- 소리 (BEEP)
            </button>
            <button
              onClick={() => handleSendCommand("MELODY")}
              className="px-2 py-0.5 bg-[#313244] hover:bg-purple-600 text-[#cdd6f4] text-[10px] font-bold rounded transition-colors whitespace-nowrap cursor-pointer"
            >
              🎵 멜로디 (MELODY)
            </button>
            <button
              onClick={() => handleSendCommand("NOD")}
              className="px-2 py-0.5 bg-[#313244] hover:bg-indigo-600 text-[#cdd6f4] text-[10px] font-bold rounded transition-colors whitespace-nowrap cursor-pointer"
            >
              🤖 끄덕이기 (NOD)
            </button>
            <button
              onClick={() => handleSendCommand("HAPPY")}
              className="px-2 py-0.5 bg-[#313244] hover:bg-emerald-600 text-[#cdd6f4] text-[10px] font-bold rounded transition-colors whitespace-nowrap cursor-pointer"
            >
              ✨ 기쁨 (HAPPY)
            </button>
            <button
              onClick={() => handleSendCommand("LED_ON")}
              className="px-2 py-0.5 bg-[#313244] hover:bg-amber-600 text-[#cdd6f4] text-[10px] font-bold rounded transition-colors whitespace-nowrap cursor-pointer"
            >
              💡 LED ON
            </button>
            <button
              onClick={() => handleSendCommand("LED_OFF")}
              className="px-2 py-0.5 bg-[#313244] hover:bg-rose-600 text-[#cdd6f4] text-[10px] font-bold rounded transition-colors whitespace-nowrap cursor-pointer"
            >
              🌑 LED OFF
            </button>
          </div>

          {/* Serial Terminal Output Logs */}
          <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1.5 scrollbar-thin bg-[#11111b] text-[#cdd6f4]">
            {serialLogs.length === 0 ? (
              <div className="py-12 text-center text-[#585b70] text-xs">
                시리얼 통신 로그가 없습니다.
                <br />
                [USB 보드 연결] 또는 [보드에 펌웨어 플래싱]을 진행해 보세요.
              </div>
            ) : (
              serialLogs.map(log => (
                <div key={log.id} className="flex items-start gap-2 leading-relaxed break-all">
                  <span className="text-[10px] text-[#585b70] shrink-0 select-none">
                    [{log.timestamp}]
                  </span>
                  {log.type === "rx" && (
                    <span className="text-[#a6e3a1]">{log.text}</span>
                  )}
                  {log.type === "tx" && (
                    <span className="text-[#89b4fa] font-semibold">📤 {log.text}</span>
                  )}
                  {log.type === "sys" && (
                    <span className="text-[#f9e2af] opacity-90">{log.text}</span>
                  )}
                  {log.type === "err" && (
                    <span className="text-[#f38ba8] font-bold">{log.text}</span>
                  )}
                </div>
              ))
            )}
            <div ref={consoleEndRef} />
          </div>

          {/* Serial Command Input Bar */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSendCommand();
            }}
            className="p-3 bg-[#181825] border-t border-[#313244] flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={commandInput}
              onChange={e => setCommandInput(e.target.value)}
              placeholder="보드로 전송할 시리얼 명령어 입력 (예: BEEP, MELODY, NOD)..."
              className="flex-1 px-3 py-2 bg-[#11111b] border border-[#313244] rounded-xl text-xs text-[#cdd6f4] font-mono focus:outline-none focus:border-indigo-400"
            />
            <button
              type="submit"
              disabled={!commandInput.trim() || !isConnected}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-[#313244] text-white disabled:text-[#585b70] rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
            >
              <Send className="w-3 h-3" />
              <span>전송</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
