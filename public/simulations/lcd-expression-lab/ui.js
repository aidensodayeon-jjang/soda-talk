import {faceCode,replaceFunction,soundCode,replaceLed,palette,readFunctionBody} from "./settings-model.js";
import {compileExpression} from "./expression-engine.js";
import {compileShapes,shapeSvg} from "./shapes-engine.js";
const shapesTemplate="#include <driver/i2s.h>\n#include <math.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_ST7789.h>\n#include <SPI.h>\n\n// ========================\n// \ud540 \uc124\uc815\n// ========================\n\n// LED / \ubc84\ud2bc\n#define LED_PIN     2\n#define BUTTON_PIN  4\n\n// MAX98357A \uc570\ud504\n#define I2S_BCLK    5\n#define I2S_LRC     3\n#define I2S_DOUT    44      // ESP32-S3 SuperMini RX \ud540\n\n#define I2S_PORT    I2S_NUM_0\n#define SAMPLE_RATE 44100\n\n// LCD: Waveshare 2inch LCD Module (ST7789V, 240x320), \ud558\ub4dc\uc6e8\uc5b4 SPI\n// \ubcf4\ub4dc \uc2e4\ud06c \ud45c\uae30 \uc21c\uc11c \uadf8\ub300\ub85c:\n//   VCC -> 3V3\n//   GND -> GND\n//   DIN -> GPIO11   (= MOSI, \ub370\uc774\ud130\uc120)\n//   CLK -> GPIO12   (= SCLK, \ud074\ub7ed)\n//   CS  -> GPIO13   (\ube0c\ub808\ub4dc\ubcf4\ub4dc\uc5d0\uc120 GPIO\ub85c \uc81c\uc5b4)\n//   DC  -> GPIO7\n//   RST -> GPIO6\n//   BL  -> 3V3\n#define TFT_MOSI 11  // \ubcf4\ub4dc: DIN\n#define TFT_CLK  12  // \ubcf4\ub4dc: CLK\n#define TFT_CS   13  // \ubcf4\ub4dc: CS\n#define TFT_DC   7   // \ubcf4\ub4dc: DC\n#define TFT_RST  6   // \ubcf4\ub4dc: RST\n\nSPIClass hspi(HSPI);\nAdafruit_ST7789 tft = Adafruit_ST7789(&hspi, TFT_CS, TFT_DC, TFT_RST);\n// 2.0\" ST7789 240x320, setRotation(3) -> 320x240 \uac00\ub85c \ud654\uba74\n\n\n\n#include <string.h>\nvoid setup() {\n\n  Serial.begin(115200);\n\n  pinMode(LED_PIN, OUTPUT);\n  pinMode(BUTTON_PIN, INPUT_PULLUP);\n  digitalWrite(LED_PIN, LOW);\n\n  // ---- LCD \ucd08\uae30\ud654 ----\n  hspi.begin(TFT_CLK, -1, TFT_MOSI, TFT_CS);\n  tft.init(240, 320);\n  tft.setSPISpeed(4000000);    // \uc810\ud37c\uc120 40cm+ \ub85c \uae40 -> 4MHz\ub85c \uc548\uc804\ud558\uac8c (\ub290\ub824\ub3c4 \ud2f0 \uc548 \ub0a8)\n  tft.setRotation(3);\n  tft.invertDisplay(true);   // \uc774 ST7789 \ud328\ub110\uc740 \ubc18\uc804 \ubaa8\ub4dc\uc5d0\uc11c \uc0c9\uc774 \uc815\uc0c1 \ud45c\uc2dc\ub428\n  drawIdle();\n\n  // ---- I2S \uc124\uc815 ----\n  i2s_config_t i2s_config = {\n    .mode                 = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),\n    .sample_rate          = SAMPLE_RATE,\n    .bits_per_sample      = I2S_BITS_PER_SAMPLE_16BIT,\n    .channel_format       = I2S_CHANNEL_FMT_RIGHT_LEFT,\n    .communication_format = I2S_COMM_FORMAT_STAND_I2S,\n    .intr_alloc_flags     = 0,\n    .dma_buf_count        = 8,\n    .dma_buf_len          = 256,\n    .use_apll             = false,\n    .tx_desc_auto_clear   = true,\n    .fixed_mclk           = 0\n  };\n\n  i2s_pin_config_t pin_config = {\n    .bck_io_num   = I2S_BCLK,\n    .ws_io_num    = I2S_LRC,\n    .data_out_num = I2S_DOUT,\n    .data_in_num  = I2S_PIN_NO_CHANGE\n  };\n\n  i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);\n  i2s_set_pin(I2S_PORT, &pin_config);\n\n  delay(300);\n}\n\n\n\n// [\uc218\uc815 1] \ud45c\uc815 \uc601\uc5ed \u2014 \ub208\u00b7\uc785\uc758 \uc88c\ud45c, \ud06c\uae30, \uc0c9\uc0c1\uc744 \ubc14\uafd4\ubcf4\uc138\uc694.\nvoid drawIdle() {\n  tft.fillScreen(ST77XX_BLACK);\n  tft.fillCircle(110, 90, 12, ST77XX_WHITE);\n  tft.fillCircle(210, 90, 12, ST77XX_WHITE);\n  tft.drawLine(125, 160, 195, 160, ST77XX_CYAN);\n}\nvoid drawHappy() {\n  tft.fillScreen(ST77XX_BLACK);\n  tft.drawLine(90, 95, 110, 75, ST77XX_YELLOW);\n  tft.drawLine(110, 75, 130, 95, ST77XX_YELLOW);\n  tft.drawLine(190, 95, 210, 75, ST77XX_YELLOW);\n  tft.drawLine(210, 75, 230, 95, ST77XX_YELLOW);\n  tft.drawLine(115, 145, 140, 170, ST77XX_CYAN);\n  tft.drawLine(140, 170, 180, 170, ST77XX_CYAN);\n  tft.drawLine(180, 170, 205, 145, ST77XX_CYAN);\n}\nvoid drawSurprised() {\n  tft.fillScreen(ST77XX_BLUE);\n  tft.fillCircle(110, 85, 15, ST77XX_WHITE);\n  tft.fillCircle(210, 85, 15, ST77XX_WHITE);\n  tft.drawCircle(160, 160, 25, ST77XX_YELLOW);\n}\n// [/\uc218\uc815 1]\n\n// [\uc218\uc815 2] \uc18c\ub9ac \uc601\uc5ed \u2014 playTone(\uc8fc\ud30c\uc218 Hz, \uc2dc\uac04 ms)\ub97c \ubc14\uafd4\ubcf4\uc138\uc694.\nvoid playFeedback() {\n  playTone(523.25, 120);\n  playTone(659.25, 120);\n  playTone(783.99, 200);\n}\n// [/\uc218\uc815 2]\n\n// [\uc218\uc815 3] LED \uc601\uc5ed \u2014 \uc18c\ub9ac \ub4a4 LED\ub97c \ub354 \ucf1c\ub458 \uc2dc\uac04(ms)\uc744 \ubc14\uafd4\ubcf4\uc138\uc694.\n#define LED_ON_TIME 700\n// [/\uc218\uc815 3]\n\nint expressionIndex = 0;\nvoid loop() {\n  if (digitalRead(BUTTON_PIN) == LOW) {\n    delay(20);\n    if (digitalRead(BUTTON_PIN) != LOW) return;\n    digitalWrite(LED_PIN, HIGH);       // LED \ucf1c\uae30\n    expressionIndex = (expressionIndex + 1) % 2;\n    if (expressionIndex == 1) drawHappy();\n    else drawSurprised();\n    playFeedback();                   // \ud6a8\uacfc\uc74c \uc7ac\uc0dd\n    delay(LED_ON_TIME);               // LED \uc720\uc9c0\n    digitalWrite(LED_PIN, LOW);        // LED \ub044\uae30\n    while (digitalRead(BUTTON_PIN) == LOW) delay(10);\n    delay(50);\n  }\n}\n\n// I2S \ud30c\ud615 \uc0dd\uc131 \u2014 \uc774 \uc544\ub798\ub294 \uadf8\ub300\ub85c \ub450\uc138\uc694.\nvoid playTone(float frequency, int duration_ms) {\n\n  const int BUFFER_FRAMES = 256;\n\n  int16_t buffer[BUFFER_FRAMES * 2];\n\n  float phase = 0;\n\n  float phaseStep =\n    2.0 * PI * frequency / SAMPLE_RATE;\n\n\n  int totalSamples =\n    SAMPLE_RATE * duration_ms / 1000;\n\n  int generated = 0;\n\n\n  while (generated < totalSamples) {\n\n    int count =\n      min(BUFFER_FRAMES,\n          totalSamples - generated);\n\n\n    for (int i = 0; i < count; i++) {\n\n      // \uc2dc\uc791\uacfc \ub05d 5ms\uc5d0 \uc74c\ub7c9\uc744 \uc11c\uc11c\ud788 \ubc14\uafd4 \ud074\ub9ad\uc74c\uc744 \uc904\uc785\ub2c8\ub2e4.\n      const int rampSamples = SAMPLE_RATE / 200;\n      const int position = generated + i;\n      const float fadeIn = fminf(1.0f, (float)position / rampSamples);\n      const float fadeOut = fminf(1.0f, (float)(totalSamples - 1 - position) / rampSamples);\n      int16_t sample = (int16_t)(sin(phase) * 3000 * fminf(fadeIn, fadeOut));\n\n      phase += phaseStep;\n\n      if (phase >= 2.0 * PI) {\n        phase -= 2.0 * PI;\n      }\n\n\n      // \uc88c/\uc6b0 \ub3d9\uc77c \uc2e0\ud638\n      buffer[i * 2]     = sample;\n      buffer[i * 2 + 1] = sample;\n    }\n\n\n    const uint8_t *data = (const uint8_t *)buffer;\n    const size_t totalBytes = count * 2 * sizeof(int16_t);\n    size_t offset = 0;\n    while (offset < totalBytes) {\n      size_t bytesWritten = 0;\n      esp_err_t err = i2s_write(I2S_PORT, data + offset, totalBytes - offset,\n                                &bytesWritten, portMAX_DELAY);\n      if (err != ESP_OK || bytesWritten == 0) {\n        Serial.printf(\"I2S write error: %d, bytes=%u\\n\", (int)err, (unsigned)bytesWritten);\n        return;\n      }\n      offset += bytesWritten;\n    }\n\n    generated += count;\n  }\n\n\n  // DMA\uc5d0 \ub300\uae30 \uc911\uc778 \uc74c\uc744 \uc9c0\uc6b0\uc9c0 \uc54a\uace0 \ubb34\uc74c\uc73c\ub85c \uc774\uc5b4\uc90d\ub2c8\ub2e4.\n  // 8\uac1c DMA \ubc84\ud37c\ubcf4\ub2e4 \ub9ce\uc740 \ubb34\uc74c\uc744 \ubcf4\ub0b4 \ub9c8\uc9c0\ub9c9 \uc74c\uc774 \ucd9c\ub825\ub418\uac8c \ud569\ub2c8\ub2e4.\n  memset(buffer, 0, sizeof(buffer));\n  for (int block = 0; block < 9; block++) {\n    size_t offset = 0;\n    while (offset < sizeof(buffer)) {\n      size_t written = 0;\n      esp_err_t err = i2s_write(I2S_PORT, ((const uint8_t *)buffer) + offset,\n                                sizeof(buffer) - offset, &written, portMAX_DELAY);\n      if (err != ESP_OK || written == 0) {\n        Serial.printf(\"I2S silence error: %d\\n\", (int)err);\n        return;\n      }\n      offset += written;\n    }\n  }\n}\n";
import counterTemplate from "./counter-template.js";
import {lcdConnections,lcdWiring,compileDisplay,compileCounter} from "./lcd-engine.js";
import {soundWiring,compileTones,buttonConnected,buttonStatus,buttonHoles} from './sound-engine.js';
import {topPins,bottomPins,group,validate,compile,createRuntime} from './engine.js';
const firmwareTemplate="#include <Adafruit_GFX.h>\n#include <Adafruit_ST7789.h>\n#include <SPI.h>\n\n// ========================\n// LCD \ud540 \uc124\uc815 (\ud558\ub4dc\uc6e8\uc5b4 SPI)\n// ========================\n#define TFT_MOSI 11  // \ubcf4\ub4dc: DIN\n#define TFT_CLK  12  // \ubcf4\ub4dc: CLK\n#define TFT_CS   13  // \ubcf4\ub4dc: CS\n#define TFT_DC   7   // \ubcf4\ub4dc: DC\n#define TFT_RST  6   // \ubcf4\ub4dc: RST\n\nSPIClass hspi(HSPI);\nAdafruit_ST7789 tft = Adafruit_ST7789(&hspi, TFT_CS, TFT_DC, TFT_RST);\n\nvoid setup() {\n  Serial.begin(115200);\n\n  // ---- LCD \ucd08\uae30\ud654 ----\n  hspi.begin(TFT_CLK, -1, TFT_MOSI, TFT_CS);\n  tft.init(240, 320);\n  tft.setSPISpeed(4000000);   // \ud1b5\uc2e0 \uc18d\ub3c4 \uc124\uc815\n  tft.setRotation(3);         // 320x240 \uac00\ub85c \ud654\uba74 \ubaa8\ub4dc\n  tft.invertDisplay(true);    // \uc0c9\uc0c1 \ubc18\uc804\n\n  // ---- \ud654\uba74 \uc9c0\uc6b0\uae30 ----\n  tft.fillScreen(ST77XX_BLACK);\n\n  // ---- \uc911\uc559 \uae00\uc528 \ucd9c\ub825 ----\n  tft.setTextColor(ST77XX_WHITE);\n  tft.setTextSize(3);\n  tft.setCursor(60, 105);\n  tft.print(\"Hello SODA!\");\n}\n\nvoid loop() {\n  // \uae30\ubcf8 \ub300\uae30\n}\n";
const buttonCode="void setup() {\n  pinMode(2, OUTPUT);\n  pinMode(4, INPUT_PULLUP);\n}\n\nvoid loop() {\n  if (digitalRead(4) == LOW) {\n    digitalWrite(2, HIGH);\n  }\n  else {\n    digitalWrite(2, LOW);\n  }\n}";
const $=id=>document.getElementById(id),svg=$('workspace');
const ledStarter=()=>({
 led:{a:'A20',b:'A21',color:'#ff4545'},
 resistor:{a:'A17',b:'A20',ohms:220},
 button:{x:143,y:155},
 wires:[{a:'button:a',b:'pin:4',color:'#2da674'},{a:'button:b',b:'N4',color:'#3b82f6'},{a:'pin:2',b:'B17',color:'#f2a82d'},{a:'B21',b:'N21',color:'#3b82f6'},{a:'pin:5V',b:'P30',color:'#ef4444'},{a:'pin:GND',b:'N29',color:'#3b82f6'}]
});
function previousSoundWires(){return [
 {a:'amp:VDD',b:'P10',color:'#ef4444'},{a:'amp:GND',b:'N10',color:'#3b82f6'},
 {a:'amp:BCLK',b:'pin:5',color:'#3b82f6'},{a:'amp:LRC',b:'pin:3',color:'#f59e0b'},
 {a:'amp:DIN',b:'pin:RX',color:'#8b5cf6'},{a:'amp:OUTP',b:'speaker:plus',color:'#ef4444'},
 {a:'amp:OUTN',b:'speaker:minus',color:'#334155'}];}
const initial=()=>({version:1,started:false,breadboard:true,board:{row:22},amp:{x:299,y:155},speaker:{x:143,y:305},lcd:{x:481,y:305},button:null,split:false,usb:true,code:shapesTemplate,hints:0,errors:0,circuitSuccess:true,simulationSuccess:false,completedAt:null,...ledStarter(),wires:[...ledStarter().wires,...previousSoundWires(),...lcdConnections.map(([pin,target],i)=>({a:"lcd:"+pin,b:target,color:["#ef4444","#3b82f6","#8b5cf6","#f59e0b","#22a69b","#ec4899","#64748b","#ef4444"][i]}))]});
const session=localStorage.getItem('authSessionId')||'guest';const key='soda-lcd-expression-lab:'+session;
let s=initial();
try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.version===1)s={...s,...saved};}catch{}
// Every entry to 2-3 starts with the completed LED circuit, independently of 2-2 work.
const starter=ledStarter();
s.led=starter.led;s.resistor=starter.resistor;s.button=starter.button;
s.wires=[...(Array.isArray(s.wires)?s.wires:[]).filter(w=>[w.a,w.b].some(id=>/^(amp|speaker|lcd):/.test(id))),...starter.wires];

// Migrate saved amplifier power wires to the shared upper supply rails.
s.wires=s.wires.map(w=>{
 if(![w.a,w.b].some(id=>/^amp:/.test(id)))return w;
 const endpoint=id=>id==='pin:5V'?'P10':id==='pin:GND'?'N10':id==='pin:44'?'pin:RX':id;
 return {...w,a:endpoint(w.a),b:endpoint(w.b)};
});
s.amp ||= {x:299,y:155};s.speaker ||= {x:377,y:305};
if(!s.shapesDefaultVersion){s.code=shapesTemplate;s.shapesDefaultVersion=1;}
s.breadboard=true;s.board={row:22};s.usb=true;s.split=false;s.circuitSuccess=true;
for(const part of ['button','amp','speaker','lcd'])if(s[part])Object.assign(s[part],snapModule(s[part].x,s[part].y));
let displayOutput=null,counterProgram=null,pressCount=0,shapeProgram=null;
let tool='',selected='',pending='',hover='',runtime=null,timer=null,lit=false,zoom=1,pan={x:0,y:0},drag=null,wireEdit=null;
function save(){try{localStorage.setItem(key,JSON.stringify(s));$('saved').textContent='이 기기에 저장됨';}catch{$('saved').textContent='저장 실패 · 결과를 내려받으세요';}if(false)fetch('/api/circuit-progress',{method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session},body:JSON.stringify(s)}).then(r=>{if(r.ok)$('saved').textContent='학습 결과 저장됨';}).catch(()=>{});}
function xy(id){if(id==='pin:44')id='pin:RX';const [module,pin]=id.split(':');if(module==='lcd'&&s.lcd){const i=['VCC','GND','DIN','CLK','CS','DC','RST','BL'].indexOf(pin);return [s.lcd.x-63+i*18,s.lcd.y+57];}if(module==='button'&&s.button)return xy(buttonHoles(s.button)[pin]);if(['amp','speaker','button','lcd'].includes(module)&&s[module]){const offsets={amp:{VDD:[-40,-52],GND:[-40,-26],BCLK:[-40,0],LRC:[-40,26],DIN:[-40,52],OUTP:[40,-13],OUTN:[40,13]},speaker:{plus:[-25,25],minus:[25,25]},button:{a:[-18,18],b:[18,18]}};const o=offsets[module][pin];return module==='amp'?[s[module].x-o[1],s[module].y+o[0]]:[s[module].x+o[0],s[module].y+o[1]];}const m=/^([A-JPN])(\d+)$/.exec(id);if(m){const row=Number(m[2]);const ys={P:55,N:75,A:115,B:135,C:155,D:175,E:195,F:265,G:285,H:305,I:325,J:345};return [65+(row-1)*26,ys[m[1]]];}if(id.startsWith('pin:')&&s.board){let i=topPins.indexOf(id.slice(4));return xy((i>=0?'E':'F')+(s.board.row+(i>=0?i:bottomPins.indexOf(id.slice(4)))));}return [0,0];}
function esc(x){return String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function isSpeakerOutput(w){return [w.a,w.b].some(id=>/^amp:OUT/.test(id))&&[w.a,w.b].some(id=>/^speaker:/.test(id));}
function line(a,b,color,width=3,extra=''){
 const [x,y]=xy(a),[u,v]=xy(b);
 const output=[a,b].some(id=>/^amp:OUT/.test(id))&&[a,b].some(id=>/^speaker:/.test(id));
 let path=`M${x},${y} Q${(x+u)/2},${Math.min(y,v)-40} ${u},${v}`;
 if(output){const amp=a.startsWith('amp:')?[x,y]:[u,v],speaker=a.startsWith('speaker:')?[x,y]:[u,v];const depth=amp[0]===xy('amp:OUTP')[0]?365:390;path=`M${amp[0]},${amp[1]} C${amp[0]},${depth} ${speaker[0]},${depth} ${speaker[0]},${speaker[1]}`;}
 return `<path pointer-events="stroke" d="${path}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" fill="none" ${extra}/>`;
}

function render(){let h=`<defs>
<linearGradient id="metal" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#667080"/><stop offset=".3" stop-color="#f6f8fc"/><stop offset=".55" stop-color="#b4bfcb"/><stop offset="1" stop-color="#637183"/></linearGradient>
<linearGradient id="ledGlass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffbbb9"/><stop offset=".25" stop-color="#fa5357"/><stop offset=".7" stop-color="#d01d34"/><stop offset="1" stop-color="#7e1029"/></linearGradient>
<radialGradient id="ledLight" cx=".4" cy=".35"><stop stop-color="#fff9db"/><stop offset=".35" stop-color="#ffb47b"/><stop offset="1" stop-color="#ff3548"/></radialGradient>
<linearGradient id="resistorBody" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#bca477"/><stop offset=".3" stop-color="#fff0c9"/><stop offset=".65" stop-color="#e4cb98"/><stop offset="1" stop-color="#ae9060"/></linearGradient>
<linearGradient id="plastic" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#141c29"/><stop offset=".45" stop-color="#4f5d70"/><stop offset="1" stop-color="#182131"/></linearGradient>
<linearGradient id="boardPlastic" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#eef0f4"/></linearGradient>
<filter id="componentShadow" x="-100%" y="-100%" width="300%" height="300%"><feDropShadow dx="1" dy="3" stdDeviation="2" flood-color="#18263b" flood-opacity=".25"/></filter>
</defs>`+'<g transform="translate('+pan.x+' '+pan.y+') scale('+zoom+')">';if(s.breadboard){h+='<rect x="30" y="30" width="835" height="355" rx="18" fill="url(#boardPlastic)" stroke="#cdd2df"/><rect x="45" y="214" width="805" height="28" rx="6" fill="#e8ebf1"/>';h+='<path d="M57 42H830" stroke="#e75257" stroke-width="2.5"/><path d="M57 86H830" stroke="#3885db" stroke-width="2.5"/><text x="43" y="59" fill="#dc3544" font-size="15" font-weight="700">+</text><text x="43" y="79" fill="#2676cc" font-size="17" font-weight="700">−</text>';for(const letter of 'P N A B C D E F G H I J'.split(' ')){const y=xy(letter+'1')[1];if(!['P','N'].includes(letter))h+=`<text x="43" y="${y+4}" font-size="10" fill="#7d8596">${letter}</text>`;for(let row=1;row<=30;row++){const id=letter+row,[x,y]=xy(id);const active=false&&hover&&group(id,s.split)===group(hover,s.split);h+=`<circle data-node="${id}" cx="${x}" cy="${y}" r="${pending===id?7:5}" fill="${active?'#a9a5ff':pending===id?'#6366f1':'#bfc6d3'}"/><circle cx="${x}" cy="${y}" r="2" fill="#667085" pointer-events="none"/>`;if(letter==='A')h+=`<text x="${x-5}" y="100" font-size="9" fill="#9299a8">${row}</text>`;}}}
if(s.board){const [x]=xy('E'+s.board.row);h+=`<g data-fixed="board"><rect x="${x-12}" y="202" width="232" height="56" rx="8" fill="#202938" stroke="#111827" stroke-width="3"/><rect x="${x+45}" y="213" width="75" height="34" rx="4" fill="#7b8493"/><text x="${x+49}" y="233" fill="white" font-size="9">ESP32-S3</text><rect x="${x+205}" y="215" width="25" height="29" rx="4" fill="#c6cbd2"/></g>`;[topPins,bottomPins].forEach((pins,j)=>pins.forEach((p,i)=>{const [u,v]=xy('pin:'+p);h+=`<circle data-node="pin:${p}" cx="${u}" cy="${v}" r="7" fill="#d7b76c"/><text x="${u-5}" y="${v+(j?18:-12)}" font-size="10" fill="#414b60">${p}</text>`;}));}
s.wires.forEach((w,i)=>{

 const color=selected==='wire:'+i?'#f59e0b':w.color;
 h+=line(w.a,w.b,'transparent',20,`data-wire="${i}"`);
 h+=line(w.a,w.b,'#263248',7,`data-wire="${i}" opacity=".25" transform="translate(1 3)"`);
 h+=line(w.a,w.b,color,6,`data-wire="${i}"`);
 h+=line(w.a,w.b,'#fff',1.5,`data-wire="${i}" opacity=".38" transform="translate(0 -1)"`);
 for(const id of [w.a,w.b]){const [x,y]=xy(id);h+=`<g data-wire="${i}"><path d="M${x} ${y-7}v7" stroke="url(#metal)" stroke-width="3"/><rect x="${x-4}" y="${y-17}" width="8" height="12" rx="2" fill="url(#plastic)"/><path d="M${x-2} ${y-15}v7" stroke="#94a1b2" stroke-width=".7" opacity=".5"/></g>`;}
});
for(const part of ['resistor','led'])if(s[part]){
 const p=s[part],[x,y]=xy(p.a),[u,v]=xy(p.b),cx=(x+u)/2,cy=(y+v)/2;
 h+=`<g data-part="${part}">`;
 if(part==='led'){
 h+=`<path d="M${x} ${y}L${cx-6} ${cy-7}v-13M${u} ${v}L${cx+6} ${cy-7}v-13" stroke="#798695" stroke-width="3" fill="none"/><path d="M${x-0.5} ${y}L${cx-6.5} ${cy-7}v-13M${u-0.5} ${v}L${cx+5.5} ${cy-7}v-13" stroke="#e9edf2" stroke-width="1" fill="none"/>`;
 if(lit)h+=`<ellipse cx="${cx}" cy="${cy-24}" rx="26" ry="28" fill="${p.color}" opacity=".16" style="filter:blur(7px)"/>`;
 h+=`<g filter="url(#componentShadow)"><path d="M${cx-11} ${cy-14}v-16a11 11 0 0 1 22 0v16z" fill="url(#${lit?'ledLight':'ledGlass'})" stroke="#b52b3d" stroke-width=".8"/><ellipse cx="${cx}" cy="${cy-14}" rx="14" ry="4" fill="#df3d4c" stroke="#a72436" stroke-width=".8"/><path d="M${cx-5} ${cy-17}v-12h10v12" stroke="#ac6670" stroke-width="1.5" fill="none" opacity=".6"/><path d="M${cx-7} ${cy-26}v-4a7 7 0 0 1 5-7" stroke="#fff" stroke-width="3" opacity=".65" fill="none" stroke-linecap="round"/><ellipse cx="${cx+5}" cy="${cy-30}" rx="2" ry="5" fill="#fff" opacity=".17"/></g>`;
 }else{
 const angle=Math.atan2(v-y,u-x)*180/Math.PI;
 h+=`<line x1="${x}" y1="${y}" x2="${u}" y2="${v}" stroke="#7c8899" stroke-width="3"/><line x1="${x}" y1="${y-1}" x2="${u}" y2="${v-1}" stroke="#eff2f7" stroke-width="1"/><g transform="translate(${cx} ${cy}) rotate(${angle})" filter="url(#componentShadow)"><path d="M-24 -6Q-24 -10 -18 -10L-11 -7H11L18 -10Q24 -10 24 -6V6Q24 10 18 10L11 7H-11L-18 10Q-24 10 -24 6Z" fill="url(#resistorBody)" stroke="#b1986c" stroke-width=".8"/><path d="M-15 -8V8M-7 -7V7" stroke="#b53d35" stroke-width="4"/><path d="M2 -7V7" stroke="#70462d" stroke-width="4"/><path d="M17 -9V9" stroke="#bb9135" stroke-width="3"/><path d="M-19 -6H19" stroke="#fff" stroke-width="1.5" opacity=".3"/></g>`;
 }
 if(selected===part)h+=`<ellipse cx="${cx}" cy="${cy-(part==='led'?23:0)}" rx="${part==='led'?18:29}" ry="${part==='led'?25:15}" fill="none" stroke="#8b5cf6" stroke-width="1.5" stroke-dasharray="3 3"/>`;
 h+='</g>';
 for(const [n,id]of [['a',p.a],['b',p.b]]){const [px,py]=xy(id);h+=`<circle data-node="${part}:${n}" cx="${px}" cy="${py}" r="5" fill="url(#metal)" stroke="#667384"/><text x="${px-4}" y="${py+17}" font-size="11" fill="${n==='a'?'#d34748':'#53657b'}">${part==='led'?(n==='a'?'+':'−'):''}</text>`;}
}
// Keep terminals above wire hit areas so a crossing wire cannot steal a hole click.
h+=renderSoundParts();
const targets=[...h.matchAll(/<circle data-node="([^"]+)" cx="([^"]+)" cy="([^"]+)" r="([^"]+)"/g)];
for(const m of targets)h+=`<circle data-node="${m[1]}" cx="${m[2]}" cy="${m[3]}" r="7" fill="transparent"/>`;
if(timer&&counterProgram&&s.button){const {x,y}=s.button;h+=`<circle data-press="button" cx="${x}" cy="${y-3}" r="17" fill="transparent" style="cursor:pointer"/>`;}
if(pending){const [px,py]=xy(resolve(pending));h+=`<circle cx="${px}" cy="${py}" r="11" fill="none" stroke="#6366f1" stroke-width="3" pointer-events="none"/><text x="${px+14}" y="${py-14}" font-size="13" fill="#5145cd">① ${esc(pending)}</text>`;}h+='</g>';svg.innerHTML=h;
const activeWire=selected.startsWith('wire:')?s.wires[Number(selected.slice(5))]:null;
$('wireSelection').hidden=!activeWire;
if(activeWire)$('wireName').textContent=`${activeWire.a} → ${activeWire.b}`;
document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));}

const icons={
 led:`<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M19 25v12m10-12v9" stroke="#8b95a5" stroke-width="3"/><path d="M14 24V16a10 10 0 0 1 20 0v8z" fill="#ff5a63" stroke="#dc3647" stroke-width="1.5"/><path d="M18 16a6 6 0 0 1 4-6" fill="none" stroke="#ffb7bb" stroke-width="2.5" stroke-linecap="round"/><path d="M12 25h24" stroke="#dc3647" stroke-width="3" stroke-linecap="round"/></svg>`,
 resistor:`<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M2 20h44" stroke="#8b95a5" stroke-width="2.5"/><rect x="10" y="13" width="28" height="14" rx="5" fill="#e5cca0" stroke="#c6a979"/><path d="M16 14v12" stroke="#b34438" stroke-width="3"/><path d="M22 14v12" stroke="#b34438" stroke-width="3"/><path d="M28 14v12" stroke="#785438" stroke-width="3"/><path d="M34 14v12" stroke="#c59b37" stroke-width="2"/></svg>`,
 wire:`<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M9 29V15Q9 6 24 8t15 17v4" fill="none" stroke="#7164e8" stroke-width="4" stroke-linecap="round"/><path d="M9 28v9m30-9v9" stroke="#9aa3b1" stroke-width="2.5"/><path d="M9 25v6m30-6v6" stroke="#30394d" stroke-width="6"/></svg>`
};
icons.amp='<svg viewBox="0 0 48 40" aria-hidden="true"><rect x="9" y="4" width="30" height="32" rx="3" fill="#2771a5"/><rect x="19" y="14" width="10" height="12" fill="#263243"/><path d="M13 8v24m22-24v24" stroke="#dab96c" stroke-width="3" stroke-dasharray="2 4"/></svg>';icons.speaker='<svg viewBox="0 0 48 40" aria-hidden="true"><circle cx="24" cy="20" r="17" fill="#333"/><circle cx="24" cy="20" r="12" fill="#555"/><circle cx="24" cy="20" r="6" fill="#262626"/></svg>';icons.button='<svg viewBox="0 0 48 40" aria-hidden="true"><rect x="10" y="6" width="28" height="28" rx="3" fill="#b9bec4" stroke="#697282"/><circle cx="24" cy="20" r="9" fill="#262d37"/></svg>';
icons.lcd='<svg viewBox="0 0 48 40" aria-hidden="true"><rect x="3" y="4" width="42" height="31" rx="3" fill="#246e9c"/><rect x="8" y="8" width="32" height="22" fill="#182b35"/><text x="12" y="22" fill="#9be8cf" font-size="7">LCD</text></svg>';
const parts=[['lcd','LCD'],['button','버튼'],['amp','I2S 앰프'],['speaker','스피커'],['led','LED'],['resistor','저항'],['wire','점퍼선']];
$('library').innerHTML=parts.map(([id,label])=>`<button draggable="true" data-tool="${id}">${icons[id]}<span>${label}</span></button>`).join('');
$('library').onclick=e=>{const button=e.target.closest('[data-tool]');if(!button)return;tool=button.dataset.tool;pending='';wireEdit=null;selected='';render();};
$('library').ondragstart=e=>{const button=e.target.closest('[data-tool]');if(!button)return;tool=button.dataset.tool;e.dataTransfer.setData('text/plain',tool);};
function snapModule(x,y){
 const id=nearest(Math.max(117,Math.min(767,x)),Math.max(135,Math.min(325,y)));
 const [sx,sy]=xy(id);return {x:sx,y:sy};
}
function nearest(x,y){let best='',distance=Infinity;for(const c of 'ABCDEFGHIJ')for(let r=1;r<=30;r++){const [u,v]=xy(c+r),d=Math.hypot(x-u,y-v);if(d<distance){distance=d;best=c+r;}}return best;}
function position(e){const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const p=pt.matrixTransform(svg.getScreenCTM().inverse());return {x:(p.x-pan.x)/zoom,y:(p.y-pan.y)/zoom};}
function place(id){if(!/^[A-JPN]\d+$/.test(id))return;if(!s.breadboard){$('log').textContent='브레드보드를 먼저 준비하세요.';return;}if(tool==='led'){s.led={a:id,b:id[0]+Math.min(30,Number(id.slice(1))+1),color:'#ff4545'};tool='';}else if(tool==='resistor'){if(!pending){pending=id;render();return;}if(pending===id){$('log').textContent='두 번째 다리는 다른 구멍을 선택하세요.';return;}s.resistor={a:pending,b:id,ohms:220};pending='';selected='resistor';tool='';}changed();}
function resolve(id){const [p,n]=id.split(':');return ['led','resistor'].includes(p)?s[p][n]:id;}
function changed(){s.circuitSuccess=validate(s).ok;save();render();}
svg.onclick=e=>{
 const part=e.target.closest('[data-part]')?.dataset.part,wire=e.target.closest('[data-wire]')?.dataset.wire,id=e.target.dataset.node;
 if(['amp','speaker','button','lcd'].includes(tool)){const point=position(e);s[tool]=snapModule(point.x,point.y);selected=tool;tool='';changed();return;}
 if(['led','resistor'].includes(tool)){const point=position(e);place(id?resolve(id):nearest(point.x,point.y));return;}
 if(wire!==undefined){selected='wire:'+wire;pending='';wireEdit=null;tool='';render();return;}
 if(part){selected=part;pending='';render();return;}
 if(!id)return;
 if(wireEdit){const w=s.wires[wireEdit.index],target=resolve(id);if(target===w[wireEdit.end==='a'?'b':'a']){$('log').textContent='양 끝점은 서로 다른 연결점을 선택하세요.';return;}w[wireEdit.end]=target;wireEdit=null;changed();return;}
 if(tool==='lead'){if(!pending){if(!/^(led|resistor):[ab]$/.test(id)){$('log').textContent='LED 또는 저항의 주황색/회색 다리를 먼저 선택하세요.';return;}pending=id;render();return;}if(!/^[A-J]\d+$/.test(id))return;const [part,terminal]=pending.split(':');s[part][terminal]=id;pending='';tool='';changed();return;}
 if(tool&&tool!=='wire'){place(resolve(id));return;}
 if(tool!=='wire'){selected=/^(led|resistor):/.test(id)?id.split(':')[0]:'';pending='';render();return;}
 if(pending){if(resolve(pending)===resolve(id)){pending='';render();return;}const a=resolve(pending),b=resolve(id);if(s.wires.some(w=>(w.a===a&&w.b===b)||(w.a===b&&w.b===a))){$('log').textContent='이미 연결된 두 점이에요.';pending='';render();return;}s.wires.push({a,b,color:'#6366f1'});selected='wire:'+(s.wires.length-1);pending='';changed();}else{selected='';pending=id;render();}
};

let suppressClick=false,buttonDown=false;
svg.addEventListener('click',e=>{if(suppressClick){e.stopImmediatePropagation();suppressClick=false;}},true);
svg.onpointerdown=e=>{if(timer){if(e.target.closest('[data-press], [data-part="button"]')){buttonDown=true;svg.setPointerCapture(e.pointerId);render();}return;}
 if(['amp','speaker','button','lcd','led','resistor'].includes(tool)||tool==='wire'||wireEdit)return;
 const node=e.target.dataset.node,terminal=/^(led|resistor):([ab])$/.exec(node||''),part=terminal?.[1]||e.target.closest('[data-part]')?.dataset.part;
 if(part){selected=part;pending='';drag={part,terminal:terminal?.[2],start:position(e),original:{...s[part]}};}
 else if(e.target===svg)drag={part:'pan',start:position(e)};
 if(drag)svg.setPointerCapture(e.pointerId);
};
svg.onpointermove=e=>{
 if(!drag)return;
 const p=position(e);
 if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)<4&&!drag.moved)return;
 drag.moved=true;
 if(drag.part==='pan'){pan.x+=(p.x-drag.start.x)*zoom;pan.y+=(p.y-drag.start.y)*zoom;}
 else if(['amp','speaker','button','lcd'].includes(drag.part)){Object.assign(s[drag.part],snapModule(drag.original.x+p.x-drag.start.x,drag.original.y+p.y-drag.start.y));}
 else if(drag.terminal){const target=nearest(p.x,p.y),other=drag.terminal==='a'?'b':'a';if(target!==s[drag.part][other])s[drag.part][drag.terminal]=target;}
 else {
 const original=drag.original,[ax,ay]=xy(original.a),target=nearest(ax+p.x-drag.start.x,ay+p.y-drag.start.y);
 const columns='ABCDEFGHIJ',rowDelta=Number(target.slice(1))-Number(original.a.slice(1)),colDelta=columns.indexOf(target[0])-columns.indexOf(original.a[0]);
 const newRow=Number(original.b.slice(1))+rowDelta,newCol=columns.indexOf(original.b[0])+colDelta;
 if(newRow>=1&&newRow<=30&&newCol>=0&&newCol<10){s[drag.part].a=target;s[drag.part].b=columns[newCol]+newRow;}
 }
 render();
};
svg.onpointerup=()=>{if(buttonDown){buttonDown=false;render();}if(drag?.moved){suppressClick=true;changed();}drag=null;};
svg.onpointercancel=()=>{buttonDown=false;if(drag?.original)s[drag.part]=drag.original;drag=null;render();};
svg.ondragover=e=>e.preventDefault();
svg.ondrop=e=>{e.preventDefault();const p=position(e),id=nearest(p.x,p.y);if(['amp','speaker','button','lcd'].includes(tool)){s[tool]=snapModule(p.x,p.y);selected=tool;tool='';changed();return;}if(tool==='resistor'){const row=Number(id.slice(1)),end=row<=27?row+3:row-3;s.resistor={a:id,b:id[0]+end,ohms:220};tool='';pending='';selected='resistor';changed();}else place(id);};

function deleteSelected(){if(selected.startsWith('wire:'))s.wires.splice(Number(selected.slice(5)),1);else if(['amp','speaker','button','lcd','led','resistor'].includes(selected))s[selected]=null;selected='';pending='';wireEdit=null;changed();}

function highlight(){
 const newline=String.fromCharCode(10);let editable=false;
 $('highlight').innerHTML=esc($('code').value).split(newline).map(line=>{if(line.includes('// [수정 '))editable=true;const html=editable?'<span class="editable-line">'+(line||' ')+'</span>':line;if(line.includes('[/수정 '))editable=false;return html;}).join(newline);
 updateFrameMission();
}
function frameBlock(code,n){const newline=String.fromCharCode(10),start=code.indexOf('// [수정 '+n+']'),end=code.indexOf('// [/수정 '+n+']');return start>=0&&end>start?code.slice(code.indexOf(newline,start)+1,end).split(newline).filter(line=>!line.trim().startsWith('//')).join(newline).trim():'';}
function updateFrameMission(){
 for(let n=1;n<=3;n++){const node=$('mission'+n);if(node){const changed=frameBlock($('code').value,n)!==frameBlock(shapesTemplate,n);node.classList.toggle('mission-edited',changed);node.querySelector('.mission-state').textContent=changed?'수정됨':'도전 전';}}
}
$('code').value=s.code;$('code').oninput=()=>{s.code=$('code').value;highlight();save();};$('code').onscroll=()=>{$('highlight').scrollTop=$('code').scrollTop;$('highlight').scrollLeft=$('code').scrollLeft;};
function stop(){clearInterval(timer);timer=null;runtime=null;lit=false;displayOutput=null;shapeProgram=null;counterProgram=null;pressCount=0;buttonDown=false;setRunning(false);$('run').classList.remove('running');$('run').setAttribute('aria-pressed','false');render();}$('stop').onclick=()=>{stop();$('log').textContent='시뮬레이션 정지';};let audioContext=null,audioNodes=[],soundTimer=null;
const stopLed=stop;
stop=function(){stopLed();clearInterval(soundTimer);soundTimer=null;audioNodes.forEach(n=>{try{n.stop();}catch{}});audioNodes=[];if(audioContext){audioContext.close();audioContext=null;}};
$('stop').onclick=()=>{stop();$('log').textContent='시뮬레이션 정지';};
$('run').onclick=async()=>{
 stop();try{
  const result=lcdWiring(s);if(!result.ok)throw Error(result.message);
  if(/void\s+playFeedback\s*\(/.test(s.code)){counterProgram=compileExpression(s.code,shapesTemplate);displayOutput=counterProgram.initial();try{audioContext=new AudioContext();await audioContext.resume();}catch{audioContext=null;}}
  else if(/tft\.(drawLine|drawRect|fillRect|drawCircle|fillCircle)\s*\(/.test(s.code)){shapeProgram=compileShapes(s.code,shapesTemplate);displayOutput=shapeProgram.frame(0);}
  else if(/void\s+showPress\s*\(/.test(s.code)){
   counterProgram=compileCounter(s.code,counterTemplate);displayOutput=counterProgram.initial();
   try{audioContext=new AudioContext();await audioContext.resume();}catch{audioContext=null;}
  }else displayOutput=compileDisplay(s.code,firmwareTemplate);
  const shapeStart=performance.now();let latched=false,busyUntil=0;tool='';pending='';wireEdit=null;
  timer=setInterval(()=>{
   const wiring=lcdWiring(s);if(!wiring.ok){stop();$('log').textContent=wiring.message;return;}
   if(shapeProgram){const elapsed=performance.now()-shapeStart,frame=shapeProgram.frame(elapsed);if(frame.stage!==displayOutput.stage){displayOutput=frame;render();}$('log').textContent=elapsed>=shapeProgram.duration?'도형 출력 완료 · '+frame.text:'도형 출력 중 · '+(elapsed/1000).toFixed(1)+'초 · '+frame.text;return;}
   if(!counterProgram)return;
   const button=buttonStatus(s),now=performance.now();
   if(buttonDown&&button.ok&&!latched&&now>=busyUntil){
    latched=true;pressCount++;displayOutput=counterProgram.press(pressCount,displayOutput);busyUntil=now+(counterProgram.duration||740);
    const audio=soundWiring(s);
    if(audio.ok&&audioContext){let time=audioContext.currentTime;for(const note of counterProgram.tones){const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.frequency.value=note.frequency;gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.06,time+.005);gain.gain.setValueAtTime(.06,time+note.duration/1000-.005);gain.gain.linearRampToValueAtTime(0,time+note.duration/1000);oscillator.connect(gain).connect(audioContext.destination);oscillator.start(time);oscillator.stop(time+note.duration/1000);audioNodes.push(oscillator);time+=note.duration/1000;}}
    render();
   }
   if(!buttonDown&&now>=busyUntil)latched=false;
   const on=Boolean(latched&&(counterProgram.kind==='expression'?now<busyUntil:(buttonDown||now<busyUntil))&&validate(s).ok);
   if(on!==lit){lit=on;render();}
   $('pressState').textContent=(buttonDown?'버튼 눌림':'버튼 놓임')+' · 표정 전환 '+pressCount+' · LED '+(lit?'ON':'OFF');
   $('log').textContent=!button.ok?button.message:'표정 전환 '+pressCount+'회'+(soundWiring(s).ok?' · 효과음 재생 준비':' · 스피커 배선을 확인하세요.');
  },25);
  setRunning(true);render();$('log').textContent='LCD 출력: '+displayOutput.text;
 }catch(err){stop();$('log').textContent=err.message;}
};
$('reset').onclick=()=>{if(!confirm('회로와 코드를 초기화할까요?'))return;stop();s=initial();$('code').value=s.code;pending='';selected='';tool='';wireEdit=null;highlight();changed();$('log').textContent='초기화 완료 · 부품을 배치하고 실행하세요.';};
highlight();render();
// Restore the authenticated student's work across sessions and devices.
if(false){
 const revision=JSON.stringify(s);
 fetch('/api/circuit-progress',{headers:{Authorization:'Bearer '+session}}).then(r=>r.ok?r.json():null).then(data=>{if(data?.progress?.data?.version===1&&JSON.stringify(s)===revision){s={...initial(),...data.progress.data,breadboard:true,board:{row:22},usb:true,split:false};$('code').value=s.code;highlight();render();$('saved').textContent='저장된 학습 결과 불러옴';}}).catch(()=>{});

}

function cancelWire(){pending='';wireEdit=null;tool='';render();}


for(const [id,end] of [['moveStart','a'],['moveEnd','b']])$(id).onclick=()=>{if(!selected.startsWith('wire:'))return;wireEdit={index:Number(selected.slice(5)),end};pending='';tool='';render();};
$('deleteWire').onclick=deleteSelected;

document.addEventListener('keydown',e=>{if(['TEXTAREA','INPUT'].includes(e.target.tagName))return;if(e.key==='Escape')cancelWire();if((e.key==='Delete'||e.key==='Backspace')&&selected){e.preventDefault();deleteSelected();}});


function renderSoundParts(){
 let h='';
 for(const part of ['amp','speaker','button','lcd']){
  const p=s[part];if(!p)continue;const {x,y}=p;
  h+=`<g data-part="${part}" filter="url(#componentShadow)">`;
  if(part==='lcd'){
 h+=`<rect x="${x-82}" y="${y-62}" width="164" height="126" rx="5" fill="#246c95" stroke="#194661" stroke-width="2"/><rect x="${x-75}" y="${y-53}" width="150" height="108" rx="3" fill="#101923"/><rect x="${x-69}" y="${y-47}" width="138" height="99" fill="${displayOutput?displayOutput.bg:'#090d12'}"/><text x="${x-76}" y="${y-68}" font-size="11" fill="#506078">ST7789 · 2.0 LCD</text>`;
 if(displayOutput)h+=`<svg x="${x-69}" y="${y-47}" width="138" height="99" viewBox="0 0 320 240">${(displayOutput.shapes||[]).map(shapeSvg).join('')}${(displayOutput.lines||[displayOutput]).map(line=>`<text x="${line.x}" y="${line.y+line.size*7}" font-family="monospace" font-size="${line.size*8}" fill="${line.fg}">${esc(line.text)}</text>`).join('')}</svg>`;
 }
 if(part==='amp')h+=`<g transform="rotate(90 ${x} ${y})"><rect x="${x-43}" y="${y-64}" width="86" height="128" rx="7" fill="#246b9b" stroke="#17496e" stroke-width="2"/><rect x="${x-9}" y="${y-14}" width="23" height="26" fill="#253040"/><path d="M${x-15} ${y-18}h38M${x-15} ${y+16}h38" stroke="#c9ced6" stroke-width="3" stroke-dasharray="2 3"/><text x="${x-28}" y="${y-30}" font-size="9" fill="white">MAX98357A</text></g>`;
  if(part==='speaker')h+=`<circle cx="${x}" cy="${y}" r="34" fill="#292e35" stroke="#151a21" stroke-width="3"/><circle cx="${x}" cy="${y}" r="27" fill="#555b63" stroke="#171e27" stroke-width="3"/><circle cx="${x}" cy="${y}" r="16" fill="#353b43"/><circle cx="${x}" cy="${y}" r="10" fill="url(#plastic)"/>`;
  if(part==='button')h+=`<rect x="${x-23}" y="${y-22}" width="46" height="42" rx="4" fill="url(#metal)" stroke="#647080"/><circle cx="${x}" cy="${y-(buttonDown?1:3)}" r="${buttonDown?12:14}" fill="${buttonDown?'#168571':'url(#plastic)'}" stroke="${buttonDown?'#60d9b4':'#212c3b'}" stroke-width="2"/><text x="${x-18}" y="${y-29}" font-size="10" fill="#54647b">버튼</text>`;
  h+='</g>';
  const pins=part==='lcd'?['VCC','GND','DIN','CLK','CS','DC','RST','BL']:part==='amp'?['VDD','GND','BCLK','LRC','DIN','OUTP','OUTN']:part==='speaker'?['plus','minus']:['a','b'];
  for(const pin of pins){const id=part+':'+pin,[u,v]=xy(id);if(part==='lcd'){h+=`<circle data-node="${id}" cx="${u}" cy="${v}" r="6" fill="#e1bd67" stroke="#7b5e24" stroke-width="1.5"/><path d="M${u} ${v+7}v9" stroke="#7d8ba0" stroke-width="1"/><text x="${u}" y="${v+29}" text-anchor="middle" font-size="10" font-weight="700" fill="#25354b" stroke="#f5f6fa" stroke-width="3" paint-order="stroke" transform="rotate(45 ${u} ${v+29})">${pin}</text>`;continue;}h+=`<circle data-node="${id}" cx="${u}" cy="${v}" r="5" fill="#d6b566" stroke="#725e32"/><text x="${part==='amp'?u-12:u+8}" y="${part==='amp'?(pin.startsWith('OUT')?v-10:v+17):v+3}" font-size="8" fill="${part==='amp'?'white':'#576378'}">${pin==='plus'?'+':pin==='minus'?'−':pin==='OUTP'?'OUT+':pin==='OUTN'?'OUT−':pin}</text>`;}
 }
 return h;
}

function setRunning(running){
 $('simulationState').textContent=running?'● 실행 중':'● 정지됨';
 $('simulationState').dataset.running=String(running);
 $('run').disabled=running;$('run').innerHTML=running?'▶ 실행 중':'▶ 실행';
 $('stop').disabled=!running;$('pressPanel').hidden=!(running&&counterProgram);
 $('pressButton').disabled=!s.button;
}
$('stop').disabled=true;
const pressControl=$('pressButton');
pressControl.onpointerdown=e=>{if(!timer||!s.button)return;e.preventDefault();buttonDown=true;pressControl.setPointerCapture(e.pointerId);render();};
pressControl.onpointerup=pressControl.onpointercancel=()=>{buttonDown=false;render();};
pressControl.onkeydown=e=>{if((e.key===' '||e.key==='Enter')&&timer){e.preventDefault();buttonDown=true;render();}};
pressControl.onkeyup=e=>{if(e.key===' '||e.key==='Enter'){buttonDown=false;render();}};
window.addEventListener('blur',()=>{buttonDown=false;render();});
const demoConnections=lcdConnections.map(([pin,target,label],i)=>({a:'lcd:'+pin,b:target,label,color:['#ef4444','#3b82f6','#8b5cf6','#f59e0b','#22a69b','#ec4899','#64748b','#ef4444'][i]}));
const demoLabels=['LCD를 브레드보드에 배치',...demoConnections.map(w=>w.label),'실행 · Hello SODA! 출력'];
const demoDetails=['기존 LED·버튼·스피커 회로는 유지됩니다. LCD를 아래쪽 빈 공간에 놓으세요.',...demoConnections.map(w=>'점퍼선으로 LCD '+w.label+'를 연결하세요.'),'시뮬레이션을 닫고 직접 연결한 뒤 실행을 눌러 화면 출력을 확인하세요.'];
$('placementDemo').onclick=()=>{
 stop();const dialog=document.createElement('dialog');dialog.className='placement-demo';
 dialog.innerHTML='<div class="demo-header"><div><span>SODA CIRCUIT LAB · 4-7</span><h2>LCD 배치 · 연결 순서</h2></div><button data-action="close">닫기 ✕</button></div><div class="demo-stage"><svg viewBox="0 0 920 460" aria-label="LCD 배치와 연결 그래픽"></svg></div><div class="demo-caption" role="status"></div><p class="demo-detail"></p><div class="demo-output" hidden></div><ol class="demo-steps"></ol><div class="demo-controls"><button data-action="previous">이전</button><button data-action="play">일시정지</button><button data-action="next">다음</button><button data-action="restart">처음부터</button><span>실습 회로는 변경되지 않습니다.</span></div>';
 document.body.append(dialog);let step=0,playing=true,playback=null;
 function paint(){
  const actual=s,preview=initial();preview.lcd={x:481,y:305};preview.wires.push(...demoConnections.slice(0,Math.min(step,8)));
  s=preview;const oldPan=pan,oldZoom=zoom;pan={x:0,y:0};zoom=1;render();
  const graphic=svg.innerHTML;s=actual;pan=oldPan;zoom=oldZoom;render();
  dialog.querySelector('.demo-stage svg').innerHTML=graphic;
  dialog.querySelector('.demo-caption').textContent=`${step+1} / ${demoLabels.length} · ${demoLabels[step]}`;
  dialog.querySelector('.demo-detail').textContent=demoDetails[step];
  dialog.querySelector('.demo-steps').innerHTML=demoLabels.map((label,i)=>`<li class="${i===step?'current':i<step?'complete':''}">${i<step?'✓ ':''}${label}</li>`).join('');
  dialog.querySelector('[data-action="previous"]').disabled=step===0;
  dialog.querySelector('[data-action="next"]').disabled=step===demoLabels.length-1;
  dialog.querySelector('[data-action="play"]').textContent=playing?'일시정지':'자동 재생';
 }
 function schedule(){clearInterval(playback);if(playing)playback=setInterval(()=>{if(step<demoLabels.length-1)step++;else{playing=false;clearInterval(playback);}paint();},4000);}
 dialog.onclick=e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;if(action==='close'){dialog.close();return;}if(action==='play'){playing=!playing;}else if(action==='restart'){step=0;playing=true;}else{playing=false;step=Math.max(0,Math.min(demoLabels.length-1,step+(action==='next'?1:-1)));}paint();schedule();};
 dialog.onclose=()=>{clearInterval(playback);dialog.remove();};dialog.showModal();paint();schedule();
};

$('checkFrame').onclick=()=>{try{const program=compileExpression(s.code,shapesTemplate);const changed=[1,2,3].filter(n=>frameBlock(s.code,n)!==frameBlock(shapesTemplate,n)).length;$('frameResult').textContent=changed===3?'세 부분을 모두 수정했어요! 실행해서 표정·소리·LED를 확인하세요.':changed+'/3 수정 완료 · 아직 바꾸지 않은 부분도 도전하세요.';if(!program.initial().shapes.length)$('frameResult').textContent='LCD에 표시할 표정을 넣어보세요.';}catch(err){$('frameResult').textContent='코드를 확인하세요: '+err.message;}};

const colorNames={BLACK:'검정',WHITE:'흰색',RED:'빨강',GREEN:'초록',BLUE:'파랑',YELLOW:'노랑',CYAN:'하늘색',MAGENTA:'분홍'};
function openSettings(section){
 const dialog=document.createElement('dialog');dialog.className='reaction-settings';
 const titles={1:'표정 수정',2:'소리 수정',3:'LED 수정'};
 dialog.innerHTML='<form novalidate><div class="settings-heading"><h2>'+titles[section]+'</h2><button type="button" data-close>닫기 ✕</button></div><div class="settings-content"></div><p class="settings-error" role="status"></p><div class="settings-footer"><button type="button" data-close>취소</button><button type="submit" class="primary">코드에 적용 · 미리보기</button></div></form>';
 const content=dialog.querySelector('.settings-content'),form=dialog.querySelector('form');
 let selectedTarget='happy';
 const options=(selected)=>palette.map(c=>'<option value="'+c+'"'+(selected===c?' selected':'')+'>'+colorNames[c]+'</option>').join('');
 if(section===1){
  content.innerHTML='<label>수정할 표정<select name="target"><option value="idle">기본 표정</option><option value="happy" selected>첫 번째 버튼 · 웃는 표정</option><option value="surprised">두 번째 버튼 · 놀란 표정</option></select></label><div class="settings-grid"><label>눈 모양<select name="eyes"><option value="round">동그란 눈</option><option value="happy">웃는 눈</option><option value="square">네모 눈</option></select></label><label>입 모양<select name="mouth"><option value="smile">웃는 입</option><option value="line">일자 입</option><option value="open">놀란 입</option></select></label><label>눈 크기<input name="radius" type="range" min="6" max="25" value="15"><output data-radius>15</output></label><label>눈·입 색상<select name="foreground">'+options('YELLOW')+'</select></label><label>배경색<select name="background">'+options('BLACK')+'</select></label></div><svg class="face-preview" viewBox="0 0 320 240" aria-label="수정할 표정 미리보기"></svg>';
  const hydrate=()=>{
   selectedTarget=form.elements.namedItem('target').value;
   const name={idle:'drawIdle',happy:'drawHappy',surprised:'drawSurprised'}[selectedTarget];
   const body=readFunctionBody($('code').value,name);
   const eye=/tft\.fillCircle\(\s*110\s*,\s*\d+\s*,\s*(\d+)/.exec(body);
   form.elements.namedItem('eyes').value=body.includes('fillRect')?'square':eye?'round':'happy';
   form.elements.namedItem('mouth').value=body.includes('drawCircle(160')?'open':body.includes('125, 160, 195')?'line':'smile';
   const square=/fillRect\(\s*\d+\s*,\s*\d+\s*,\s*(\d+)/.exec(body);const happy=/drawLine\(\s*(\d+)\s*,\s*90\s*,\s*110/.exec(body);
   form.elements.namedItem('radius').value=eye?eye[1]:square?Number(square[1])/2:happy?110-Number(happy[1]):15;
   form.elements.namedItem('background').value=/fillScreen\(ST77XX_(\w+)\)/.exec(body)?.[1]||'BLACK';
   form.elements.namedItem('foreground').value=[...body.matchAll(/ST77XX_(\w+)/g)].slice(1)[0]?.[1]||'WHITE';
  };
  form.elements.namedItem('target').onchange=()=>{hydrate();preview();};hydrate();
 }
 if(section===2){
  const body=readFunctionBody($('code').value,'playFeedback');
  const notes=[...body.matchAll(/playTone\(\s*([\d.]+)\s*,\s*(\d+)\s*\)/g)];
  content.innerHTML='<p>3개 음을 순서대로 재생합니다.</p>'+[0,1,2].map(i=>'<fieldset><legend>음 '+(i+1)+'</legend><div class="settings-grid"><label>주파수 (Hz)<input name="freq'+i+'" type="number" min="20" max="20000" value="'+(notes[i]?.[1]||[523.25,659.25,783.99][i])+'" step="0.01"></label><label>길이 (ms)<input name="duration'+i+'" type="number" min="10" max="5000" value="'+(notes[i]?.[2]||120)+'" step="10"></label></div></fieldset>').join('');
 }
 if(section===3){const hold=/#define\s+LED_ON_TIME\s+(\d+)/.exec($('code').value)?.[1]||700;content.innerHTML='<label>소리 뒤 LED 유지 시간 (ms)<input name="hold" type="range" min="0" max="10000" step="100" value="'+Math.min(10000,Number(hold))+'"><output data-hold></output></label><p>버튼을 누르면 LED가 켜지고, 효과음이 끝난 뒤 설정한 시간만큼 더 켜져 있습니다.</p><div class="led-preview"><i></i><span data-led-label></span></div>';}
 function value(name){return form.elements.namedItem(name).value;}
 function nextCode(){
  const source=$('code').value;
  if(section===1){const face=faceCode({target:value('target'),eyes:value('eyes'),mouth:value('mouth'),radius:Number(value('radius')),foreground:value('foreground'),background:value('background')});return replaceFunction(source,face.name,face.body);}
  if(section===2)return replaceFunction(source,'playFeedback',soundCode([0,1,2].map(i=>({frequency:Number(value('freq'+i)),duration:Number(value('duration'+i))}))));
  return replaceLed(source,Number(value('hold')));
 }
 function preview(){try{
  const program=compileExpression(nextCode(),shapesTemplate);
  if(section===1){const frame=value('target')==='idle'?program.initial():program.press(value('target')==='happy'?1:2);content.querySelector('svg').innerHTML='<rect width="320" height="240" fill="'+frame.bg+'"/>'+frame.shapes.map(shapeSvg).join('');content.querySelector('[data-radius]').textContent=value('radius');}
  if(section===3){content.querySelector('[data-hold]').textContent=value('hold')+' ms';content.querySelector('[data-led-label]').textContent=(Number(value('hold'))/1000).toFixed(1)+'초 더 켜짐';}
  dialog.querySelector('.settings-error').textContent='';
 }catch(err){dialog.querySelector('.settings-error').textContent=err.message;}}
 form.oninput=preview;
 form.onsubmit=e=>{e.preventDefault();try{
  const code=nextCode(),program=compileExpression(code,shapesTemplate);
  stop();s.code=code;$('code').value=code;highlight();save();
  displayOutput=section===1?(value('target')==='idle'?program.initial():program.press(value('target')==='happy'?1:2)):program.initial();render();
  $('log').textContent=titles[section]+' 적용 완료 · 실행 후 버튼을 눌러 확인하세요.';
  dialog.close();
 }catch(err){dialog.querySelector('.settings-error').textContent=err.message;}};
 dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dialog.close());
 dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();preview();
}
document.querySelectorAll('[data-edit-block]').forEach(button=>button.onclick=()=>openSettings(Number(button.dataset.editBlock)));
for(let n=1;n<=3;n++){const heading=$('mission'+n).querySelector('h3');heading.tabIndex=0;heading.setAttribute('role','button');heading.onclick=()=>openSettings(n);heading.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openSettings(n);}};}
