import template from '../../firmware/soda-basic-template.ino?raw';

export interface CustomCodeParts {
  name: string;
  description?: string;
  headers?: string;
  globals?: string;
  setup?: string;
  functionCode: string;
  targetSlot?: string; // 'CUSTOM_1' | 'CUSTOM_2' | 'CUSTOM_3'
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  extractedFunctions: string[];
  mainFunctionName: string;
}

export interface GeneratedFirmwareResult {
  mergedCode: string;
  fileName: string;
  mainFunctionName: string;
  includedParts: {
    headers: boolean;
    globals: boolean;
    setup: boolean;
    function: boolean;
  };
}

// 소다봇 핵심 예약 함수명 목록
const RESERVED_CORE_FUNCTIONS = new Set([
  'setup', 'loop', 'onwsevent', 'checkhardwarebutton', 
  'startwebserverifready', 'processmessage', 'handlewscommand', 
  'setupble', 'setupspeaker', 'renderdefaultidleface', 
  'loadsettingsfromnvs', 'playtonei2s', 'drawmessage', 
  'handleusercustomfunction', 'executelocalbuttonaction',
  'rendercustomface', 'clearscreen', 'renderstandbyscreen'
]);

/**
 * 기능 이름을 안전한 영문 PascalCase 파일명으로 변환
 */
export function sanitizeToPascalCase(name: string): string {
  if (!name || !name.trim()) return 'CustomFunction';

  // 한글 주요 단어 변환 매핑
  const koreanMap: Record<string, string> = {
    '시계': 'Clock',
    '인터넷': 'Internet',
    '인터넷시계': 'InternetClock',
    '인터넷 시계': 'InternetClock',
    '날씨': 'Weather',
    '온도': 'Temp',
    '미세먼지': 'Dust',
    '타이머': 'Timer',
    '스톱워치': 'Stopwatch',
    '카운트다운': 'Countdown',
    '알람': 'Alarm',
    '음악': 'Music',
    '멜로디': 'Melody',
    '센서': 'Sensor',
    '거리': 'Distance',
    '빛': 'Light',
    '조도': 'Illuminance',
    '소리': 'Sound',
    '표정': 'Face',
    '인공지능': 'AI',
    '챗봇': 'Chatbot',
    '게임': 'Game',
    '주사위': 'Dice',
    '계산기': 'Calculator'
  };

  let translated = name.trim();
  for (const [kr, en] of Object.entries(koreanMap)) {
    translated = translated.replace(new RegExp(kr, 'g'), en);
  }

  // 영문/숫자 외 제거 및 단어별 PascalCase 생성
  const words = translated.replace(/[^a-zA-Z0-9\s_-]/g, '').split(/[\s_-]+/);
  const pascal = words
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

  return pascal.length > 0 ? pascal : 'CustomFunction';
}

export interface FunctionInfo {
  name: string;
  returnType: string;
  parameters: string;
  isVoidZeroParam: boolean;
}

/**
 * FUNCTION 코드 내 정의된 함수들을 파싱하여 정보 추출
 */
export function parseFunctions(functionCode: string): FunctionInfo[] {
  if (!functionCode) return [];
  
  const functionRegex = /(void|int|bool|float|double|String|uint8_t|uint16_t|uint32_t|char|auto)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{/g;
  const list: FunctionInfo[] = [];
  let match;
  
  while ((match = functionRegex.exec(functionCode)) !== null) {
    const returnType = match[1];
    const name = match[2];
    const rawParams = (match[3] || '').trim();
    const isVoidZeroParam = returnType === 'void' && (rawParams === '' || rawParams === 'void');
    list.push({ name, returnType, parameters: rawParams, isVoidZeroParam });
  }
  return list;
}

/**
 * FUNCTION 코드에서 정의된 함수 이름들을 추출
 */
export function extractFunctionNames(functionCode: string): string[] {
  return parseFunctions(functionCode).map(f => f.name);
}

/**
 * 매개변수 없이 슬롯에서 안전하게 실행 가능한 대표 void 함수를 탐색
 */
export function findMainExecutableFunction(functionCode: string): string | null {
  const parsed = parseFunctions(functionCode);
  if (parsed.length === 0) return null;

  // 1순위: 매개변수 없는 void 함수
  const voidZero = parsed.filter(f => f.isVoidZeroParam);
  if (voidZero.length > 0) {
    const preferred = voidZero.find(f => /^(show|run|start|handle|play|do|exec|main|update|display|print)/i.test(f.name));
    return preferred ? preferred.name : voidZero[0].name;
  }

  // 2순위: 매개변수가 없는 함수 (반환형 있는 경우)
  const zeroParam = parsed.filter(f => f.parameters === '' || f.parameters === 'void');
  if (zeroParam.length > 0) {
    return zeroParam[0].name;
  }

  // 매개변수가 있는 함수만 있다면 슬롯에서 직접 호출 시 에러가 발생하므로 null 반환
  return null;
}

/**
 * 커스텀 코드 4개 파트 검증 함수
 */
export function validateCustomCode(parts: CustomCodeParts): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. 기능 이름 필수 검증
  if (!parts.name || !parts.name.trim()) {
    errors.push('기능 이름을 입력해주세요.');
  }

  // 2. FUNCTION 코드 필수 검증
  if (!parts.functionCode || !parts.functionCode.trim()) {
    errors.push('FUNCTION 영역에 실행 함수를 작성해주세요.');
  }

  // 3. SETUP 영역 검증 (setup() 전체 삽입 방지)
  const setupCode = parts.setup || '';
  if (/\bvoid\s+setup\s*\(\s*\)/i.test(setupCode)) {
    errors.push('SETUP 영역에 setup() 전체를 넣지 말고 초기화 코드만 입력해주세요.');
  }
  if (/\bvoid\s+loop\s*\(\s*\)/i.test(setupCode)) {
    errors.push('SETUP 영역에 loop() 함수를 작성할 수 없습니다.');
  }

  // 4. FUNCTION 영역 검증 (loop() 전체 삽입 방지 및 함수 추출)
  const fnCode = parts.functionCode || '';
  if (/\bvoid\s+loop\s*\(\s*\)/i.test(fnCode)) {
    errors.push('FUNCTION 영역에 loop() 전체를 넣지 말고 실행 함수 형태로 작성해주세요.');
  }
  if (/\bvoid\s+setup\s*\(\s*\)/i.test(fnCode)) {
    errors.push('FUNCTION 영역에 setup() 대신 실행할 커스텀 함수를 작성해주세요.');
  }

  // 5. 함수 정의 여부 및 이름 충돌 검사
  const extractedFunctions = extractFunctionNames(fnCode);
  if (fnCode.trim() && extractedFunctions.length === 0) {
    errors.push('FUNCTION 영역에 최소 하나의 함수 정의가 있어야 합니다. (예: void showClock() { ... })');
  }

  for (const fn of extractedFunctions) {
    if (RESERVED_CORE_FUNCTIONS.has(fn.toLowerCase())) {
      errors.push(`'${fn}'은(는) 소다봇 기본 핵심 함수명과 충돌합니다. 다른 함수명을 사용해주세요.`);
    }
  }

  const mainFunctionName = findMainExecutableFunction(fnCode) || extractedFunctions[0] || 'customFunction';

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    extractedFunctions,
    mainFunctionName
  };
}

/**
 * 기본 펌웨어와 4개 파트 커스텀 코드를 안전하게 자동 병합
 */
export function generateCustomFirmware(
  parts: CustomCodeParts,
  robotName = 'LUMI',
  wifiSsid = '',
  wifiPass = ''
): GeneratedFirmwareResult {
  const name = robotName.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 10) || 'ROBOT';
  const cleanPascal = sanitizeToPascalCase(parts.name);
  const fileName = `SODABOT_${cleanPascal}.ino`;
  
  const extractedFunctions = extractFunctionNames(parts.functionCode || '');
  const mainFunctionName = findMainExecutableFunction(parts.functionCode || '') || extractedFunctions[0] || '';

  // 1. 헤더 정리 (중복 include 제거 및 들여쓰기)
  let cleanHeaders = (parts.headers || '').trim();
  if (cleanHeaders) {
    // 중복 제거
    const lines = cleanHeaders.split('\n').map(l => l.trim()).filter(Boolean);
    const uniqueLines = Array.from(new Set(lines));
    cleanHeaders = uniqueLines.join('\n');
  }

  // 2. 전역 변수 정리
  const cleanGlobals = (parts.globals || '').trim();

  // 3. 초기화 코드 정리
  const cleanSetup = (parts.setup || '').trim();

  // 4. 실행 함수 코드 정리
  let cleanFunctions = (parts.functionCode || '').trim();

  // 기본 템플릿 치환
  let merged = template;

  // Wi-Fi / BLE 설정 치환
  const substitutions: Record<string, string> = {
    __SODA_WIFI_SSID__: JSON.stringify(wifiSsid),
    __SODA_WIFI_PASSWORD__: JSON.stringify(wifiPass),
    __SODA_BLE_NAME__: JSON.stringify(`SODABOT_${name}`),
  };
  merged = merged.replace(/__SODA_WIFI_SSID__|__SODA_WIFI_PASSWORD__|__SODA_BLE_NAME__/g, key => substitutions[key]);

  // 마커 위치에 안전하게 삽입
  // ① HEADERS
  const headersBlock = cleanHeaders ? `\n// [CUSTOM HEADERS: ${parts.name}]\n${cleanHeaders}\n` : '';
  merged = merged.replace(
    /\/\/\s*===\s*CUSTOM_HEADERS_START\s*===[\s\S]*?\/\/\s*===\s*CUSTOM_HEADERS_END\s*===/,
    `// === CUSTOM_HEADERS_START ===${headersBlock}// === CUSTOM_HEADERS_END ===`
  );

  // ② GLOBALS
  const globalsBlock = cleanGlobals ? `\n// [CUSTOM GLOBALS: ${parts.name}]\n${cleanGlobals}\n` : '';
  merged = merged.replace(
    /\/\/\s*===\s*CUSTOM_GLOBALS_START\s*===[\s\S]*?\/\/\s*===\s*CUSTOM_GLOBALS_END\s*===/,
    `// === CUSTOM_GLOBALS_START ===${globalsBlock}// === CUSTOM_GLOBALS_END ===`
  );

  // ③ SETUP
  const setupBlock = cleanSetup ? `\n  // [CUSTOM SETUP: ${parts.name}]\n  ${cleanSetup.split('\n').join('\n  ')}\n` : '';
  merged = merged.replace(
    /\/\/\s*===\s*CUSTOM_SETUP_START\s*===[\s\S]*?\/\/\s*===\s*CUSTOM_SETUP_END\s*===/,
    `// === CUSTOM_SETUP_START ===${setupBlock}  // === CUSTOM_SETUP_END ===`
  );

  // ④ FUNCTION 및 슬롯 자동 연결
  // 대상 슬롯(예: CUSTOM_1)의 customFunction1() 내부에서 대표 함수를 호출할 수 있도록 슬롯 내부 코드 업데이트
  const targetSlot = parts.targetSlot || 'CUSTOM_1';
  let slotCallSnippet = '';
  if (mainFunctionName) {
    slotCallSnippet = `\n  // 커스텀 기능 [${parts.name}] 자동 실행\n  ${mainFunctionName}();`;
  }

  if (targetSlot === 'CUSTOM_1') {
    merged = merged.replace(
      /(void customFunction1\(\) \{[\s\S]*?)(drawMessage\([^)]+\);)/,
      `$1${slotCallSnippet}\n  $2`
    );
  } else if (targetSlot === 'CUSTOM_2') {
    merged = merged.replace(
      /(void customFunction2\(\) \{[\s\S]*?)(drawMessage\([^)]+\);)/,
      `$1${slotCallSnippet}\n  $2`
    );
  } else if (targetSlot === 'CUSTOM_3') {
    merged = merged.replace(
      /(void customFunction3\(\) \{[\s\S]*?)(drawMessage\([^)]+\);)/,
      `$1${slotCallSnippet}\n  $2`
    );
  }

  const functionsBlock = cleanFunctions ? `\n// ==============================================================================\n// [CUSTOM FUNCTION: ${parts.name}]\n// ==============================================================================\n${cleanFunctions}\n` : '';
  merged = merged.replace(
    /\/\/\s*===\s*CUSTOM_FUNCTIONS_START\s*===[\s\S]*?\/\/\s*===\s*CUSTOM_FUNCTIONS_END\s*===/,
    `// === CUSTOM_FUNCTIONS_START ===${functionsBlock}// === CUSTOM_FUNCTIONS_END ===`
  );

  return {
    mergedCode: merged,
    fileName,
    mainFunctionName,
    includedParts: {
      headers: Boolean(cleanHeaders),
      globals: Boolean(cleanGlobals),
      setup: Boolean(cleanSetup),
      function: Boolean(cleanFunctions),
    }
  };
}

/** Protocol 1 and the SODA v2 board pin map; no embedded API credentials. */
export function generateSodabotFirmware(
  robotName: string, wifiSsid: string, wifiPass: string,
  _apiKey = '', _apiHost = ''
): string {
  const name = robotName.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 10) || 'ROBOT';
  const substitutions: Record<string, string> = {
    __SODA_WIFI_SSID__: JSON.stringify(wifiSsid),
    __SODA_WIFI_PASSWORD__: JSON.stringify(wifiPass),
    __SODA_BLE_NAME__: JSON.stringify(`SODABOT_${name}`),
  };
  return template.replace(/__SODA_WIFI_SSID__|__SODA_WIFI_PASSWORD__|__SODA_BLE_NAME__/g, key => substitutions[key]);
}
