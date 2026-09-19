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
 * 마커 사이의 기존 내용을 제거하고 새 코드로 안전하게 교체
 * - "없음", "NONE", 빈값인 경우 마커만 유지하고 내용 비움
 * - 마커 누락 시 명확한 에러 예외 발생
 * - 단순 append가 아닌 마커 구간 1:1 교체
 */
export function replaceCustomSection(
  source: string,
  startMarker: string,
  endMarker: string,
  newCode?: string | null,
  sectionName = 'SECTION'
): string {
  const startIndex = source.indexOf(startMarker);
  const endIndex = source.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    throw new Error(`[MERGE ERROR] ${startMarker} 또는 ${endMarker} 마커를 템플릿에서 찾을 수 없습니다.`);
  }

  const trimmed = (newCode || '').trim();
  const isEmpty = !trimmed || trimmed === '없음' || trimmed.toUpperCase() === 'NONE';

  let formattedCode = '';
  if (!isEmpty) {
    formattedCode = `\n${trimmed}\n`;
    console.log(`[MERGE] ${sectionName} inserted`);
  } else {
    console.log(`[MERGE] ${sectionName} empty - skipped`);
  }

  const before = source.substring(0, startIndex + startMarker.length);
  const after = source.substring(endIndex);

  return before + formattedCode + after;
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

  // 1. 기본 템플릿 로드
  let merged = template;

  // 2. Wi-Fi / BLE 설정 치환
  const substitutions: Record<string, string> = {
    __SODA_WIFI_SSID__: JSON.stringify(wifiSsid),
    __SODA_WIFI_PASSWORD__: JSON.stringify(wifiPass),
    __SODA_BLE_NAME__: JSON.stringify(`SODABOT_${name}`),
  };
  merged = merged.replace(/__SODA_WIFI_SSID__|__SODA_WIFI_PASSWORD__|__SODA_BLE_NAME__/g, key => substitutions[key]);

  // 3. HEADERS 영역 교체
  merged = replaceCustomSection(
    merged,
    '// === CUSTOM_HEADERS_START ===',
    '// === CUSTOM_HEADERS_END ===',
    parts.headers,
    'HEADERS'
  );

  // 4. GLOBALS 영역 교체 (전역 범위 유지)
  const cleanGlobals = (parts.globals || '').trim();
  if (/\bWEATHER_LATITUDE\b/.test(cleanGlobals)) {
    // 사용자가 직접 WEATHER_LATITUDE를 GLOBALS에 작성한 경우 기본 정의부를 주석 처리하여 중복 정의 방지
    merged = merged.replace(
      /const char\*\s+WEATHER_LATITUDE\s*=[\s\S]*?const char\*\s+WEATHER_LONGITUDE\s*=[\s\S]*?;\n?/,
      '// (기본 WEATHER_LATITUDE / WEATHER_LONGITUDE는 아래 사용자 GLOBALS에서 대체됨)\n'
    );
  }

  merged = replaceCustomSection(
    merged,
    '// === CUSTOM_GLOBALS_START ===',
    '// === CUSTOM_GLOBALS_END ===',
    parts.globals,
    'GLOBALS'
  );

  // 5. SETUP 영역 교체
  merged = replaceCustomSection(
    merged,
    '// === CUSTOM_SETUP_START ===',
    '// === CUSTOM_SETUP_END ===',
    parts.setup,
    'SETUP'
  );

  // 6. FUNCTIONS 영역 교체
  merged = replaceCustomSection(
    merged,
    '// === CUSTOM_FUNCTIONS_START ===',
    '// === CUSTOM_FUNCTIONS_END ===',
    parts.functionCode,
    'FUNCTIONS'
  );

  // 7. 슬롯 자동 연결 및 중복 함수 정의 방지
  const cleanFunctions = (parts.functionCode || '').trim();
  const targetSlot = parts.targetSlot || 'CUSTOM_1';

  if (/\bvoid\s+customFunction1\s*\(\s*\)/.test(cleanFunctions)) {
    merged = merged.replace(/void customFunction1\(\)\s*\{[\s\S]*?\n\}/, '// (customFunction1은 상단 커스텀 영역에서 정의됨)');
  } else if (targetSlot === 'CUSTOM_1' && mainFunctionName && mainFunctionName !== 'customFunction1') {
    merged = merged.replace(
      /void customFunction1\(\)\s*\{[\s\S]*?\n\}/,
      `void customFunction1() {\n  Serial.println("[MY FUNCTION] customFunction1() 실행");\n  ${mainFunctionName}();\n}`
    );
  }

  if (/\bvoid\s+customFunction2\s*\(\s*\)/.test(cleanFunctions)) {
    merged = merged.replace(/void customFunction2\(\)\s*\{[\s\S]*?\n\}/, '// (customFunction2는 상단 커스텀 영역에서 정의됨)');
  } else if (targetSlot === 'CUSTOM_2' && mainFunctionName && mainFunctionName !== 'customFunction2') {
    merged = merged.replace(
      /void customFunction2\(\)\s*\{[\s\S]*?\n\}/,
      `void customFunction2() {\n  Serial.println("[MY FUNCTION] customFunction2() 실행");\n  ${mainFunctionName}();\n}`
    );
  }

  if (/\bvoid\s+customFunction3\s*\(\s*\)/.test(cleanFunctions)) {
    merged = merged.replace(/void customFunction3\(\)\s*\{[\s\S]*?\n\}/, '// (customFunction3는 상단 커스텀 영역에서 정의됨)');
  } else if (targetSlot === 'CUSTOM_3' && mainFunctionName && mainFunctionName !== 'customFunction3') {
    merged = merged.replace(
      /void customFunction3\(\)\s*\{[\s\S]*?\n\}/,
      `void customFunction3() {\n  Serial.println("[MY FUNCTION] customFunction3() 실행");\n  ${mainFunctionName}();\n}`
    );
  }

  // 8. 병합 후 검증 단계
  if (cleanGlobals && cleanGlobals !== '없음' && cleanGlobals.toUpperCase() !== 'NONE') {
    const firstCodeLine = cleanGlobals.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('//'));
    if (firstCodeLine && !merged.includes(firstCodeLine)) {
      throw new Error('GLOBALS 병합 실패: 입력한 전역변수가 최종 펌웨어에 반영되지 않았습니다.');
    }
  }

  if (cleanFunctions && cleanFunctions !== '없음' && cleanFunctions.toUpperCase() !== 'NONE') {
    const firstCodeLine = cleanFunctions.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('//'));
    if (firstCodeLine && !merged.includes(firstCodeLine)) {
      throw new Error('FUNCTION 병합 실패: 입력한 함수 코드가 최종 펌웨어에 반영되지 않았습니다.');
    }
  }

  console.log('[MERGE] validation passed');

  return {
    mergedCode: merged,
    fileName,
    mainFunctionName,
    includedParts: {
      headers: Boolean(parts.headers && parts.headers.trim() && parts.headers.trim() !== '없음' && parts.headers.trim().toUpperCase() !== 'NONE'),
      globals: Boolean(cleanGlobals && cleanGlobals !== '없음' && cleanGlobals.toUpperCase() !== 'NONE'),
      setup: Boolean(parts.setup && parts.setup.trim() && parts.setup.trim() !== '없음' && parts.setup.trim().toUpperCase() !== 'NONE'),
      function: Boolean(cleanFunctions && cleanFunctions !== '없음' && cleanFunctions.toUpperCase() !== 'NONE'),
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
