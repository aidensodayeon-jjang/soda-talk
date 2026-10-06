import { AiSkillConfig, AiSkillType, AiSkillTestLog, AiSkillProjectReport } from '../types';

export const DEFAULT_AI_SKILL_TEMPLATES: AiSkillConfig[] = [
  {
    id: 'skill-english-buddy',
    type: 'english',
    name: '영어친구 (English Buddy)',
    description: '나의 수준에 맞춰 친절하게 영어 회화를 유도하고 문장을 교정해주는 AI 원어민 친구',
    icon: 'Languages',
    version: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    englishOptions: {
      level: 'beginner',
      ratio: 50,
      koreanHint: true,
      grammarCorrection: true,
      length: 'short',
      wordQuiz: false,
      roleplay: false,
      roleplayScenario: '학교 쉬는 시간 대화'
    }
  },
  {
    id: 'skill-coding-tutor',
    type: 'coding',
    name: '코딩친구 (Coding Tutor)',
    description: '소다봇 펌웨어와 아두이노/C++ 코딩을 정답 대신 단계별 힌트와 설명으로 돕는 튜터',
    icon: 'Code2',
    version: 1,
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    codingOptions: {
      level: 'elementary',
      codeGenMode: 'hint',
      explainError: true,
      suggestFix: true,
      addComments: true,
      useHardwareInfo: true
    }
  },
  {
    id: 'skill-study-helper',
    type: 'study',
    name: '공부도우미 (Study Helper)',
    description: '소크라테스식 질문과 쉬운 일상 비유로 스스로 생각하게 돕는 똑똑한 스터디 파트너',
    icon: 'GraduationCap',
    version: 1,
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    studyOptions: {
      subject: 'science',
      method: 'socratic',
      quizMode: true,
      cheerLevel: 'high',
      provideSummaryNotes: true
    }
  },
  {
    id: 'skill-daily-friend',
    type: 'daily',
    name: '생활친구 (Daily Companion)',
    description: '오늘의 안부와 일정을 챙겨주고 따뜻하게 공감해주는 안전한 일상 반려 로봇',
    icon: 'HeartHandshake',
    version: 1,
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dailyOptions: {
      checkGreeting: true,
      checkSchedule: true,
      memoryAssist: true,
      familyMessageMode: false,
      shortReply: true,
      easyExpression: true,
      safetyStrict: true
    }
  },
  {
    id: 'skill-presentation-coach',
    type: 'presentation',
    name: '발표연습 (Presentation Coach)',
    description: '발표 원고와 질의응답을 함께 연습하고 자신감을 북돋아주는 스피치 코치',
    icon: 'Mic',
    version: 1,
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    presentationOptions: {
      topic: '내가 만든 소다봇 프로젝트 소개',
      targetAudience: '반 친구들과 선생님',
      focusAreas: ['자신감 있는 어조', '구조적 설명', '예상 질문 답변'],
      mockQa: true,
      timeManagementTips: true
    }
  },
  {
    id: 'skill-custom-builder',
    type: 'custom',
    name: '직접 만들기 (Custom AI Skill)',
    description: '학생이 설정한 목적과 규칙에 따라 세상에 하나뿐인 나만의 AI 스킬 생성',
    icon: 'Sparkles',
    version: 1,
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customInputs: {
      skillName: '나만의 AI 스킬',
      forWhom: '초등학교/중학교 친구들',
      targetProblem: '심심하거나 궁금한 게 있을 때 유쾌하게 놀아주기',
      mustDo: '항상 밝은 이모지와 유머러스한 칭찬으로 답변하기',
      mustNotDo: '너무 어렵거나 긴 설명 하지 않기',
      memoriesToUse: '친구의 취미와 좋아하는 음식 기억을 적극 활용하기',
      responseStyle: '친근한 반말 구어체, 2문장 이내'
    }
  }
];

export function compileAiSkillPrompt(skill: AiSkillConfig): string {
  let instructions: string[] = [];

  switch (skill.type) {
    case 'english': {
      const opts = skill.englishOptions || {
        level: 'beginner',
        ratio: 50,
        koreanHint: true,
        grammarCorrection: true,
        length: 'short',
        wordQuiz: false,
        roleplay: false
      };

      const levelStr = opts.level === 'beginner' ? '초등/입문 수준의 쉬운 단어와 짧은 문장' : opts.level === 'intermediate' ? '중급 수준의 실용 회화 표현' : '고급 수준의 다양한 어휘와 자연스러운 영미권 표현';
      const lenStr = opts.length === 'short' ? '1~2문장으로 아주 간결하게' : opts.length === 'medium' ? '2~3문장 정도의 적당한 길이' : '풍부하고 상세한 문장';

      instructions.push(`[AI 스킬 활성화: 영어친구 (English Buddy)]`);
      instructions.push(`1. 역할: 친절하고 다정한 원어민 영어 회화 파트너`);
      instructions.push(`2. 난이도 설정: ${levelStr}`);
      instructions.push(`3. 영어/한국어 사용 비율: 약 영어 ${opts.ratio}%, 한국어 ${100 - opts.ratio}%로 응답하세요.`);
      instructions.push(`4. 답변 길이: ${lenStr}`);
      if (opts.grammarCorrection) {
        instructions.push(`5. 문장 교정: 사용자의 영어 문장에 어색한 문법이나 단어가 있다면 친절하게 [💡 교정 팁: "..."] 형태로 바른 표현을 덧붙여주세요.`);
      }
      if (opts.koreanHint) {
        instructions.push(`6. 한국어 힌트: 영어 문장 뒤에 (한국어 해석/힌트)를 괄호로 알기 쉽게 달아주세요.`);
      }
      if (opts.wordQuiz) {
        instructions.push(`7. 단어 퀴즈: 대화 중간에 오늘의 재미있는 영단어 1개를 퀴즈 형식으로 가볍게 물어보세요.`);
      }
      if (opts.roleplay) {
        instructions.push(`8. 역할극 모드: 현재 '${opts.roleplayScenario || "일상 상황"}' 상황극 중이라고 가정하고 몰입감 있게 대화를 이어가세요.`);
      }
      break;
    }

    case 'coding': {
      const opts = skill.codingOptions || {
        level: 'elementary',
        codeGenMode: 'hint',
        explainError: true,
        suggestFix: true,
        addComments: true,
        useHardwareInfo: true
      };

      const levelStr = opts.level === 'elementary' ? '초등학생/엔트리 수준의 아주 쉬운 설명' : opts.level === 'middle' ? '중등 수준의 아두이노 C++ 기본 개념' : 'ESP32 하드웨어 레지스터 및 실전 프로그래밍';
      
      instructions.push(`[AI 스킬 활성화: 코딩친구 (Coding Tutor)]`);
      instructions.push(`1. 역할: 학생이 스스로 코딩을 해결할 수 있도록 이끌어주는 코딩 튜터`);
      instructions.push(`2. 설명 난이도: ${levelStr}`);
      
      if (opts.codeGenMode === 'hint') {
        instructions.push(`3. 코드 제공 원칙: ★절대로 완성된 전체 정답 코드를 한 번에 주지 마세요!★ 문제 해결을 위한 힌트와 생각할 방향, 1~2줄의 핵심 코드 조각만 제시하여 학생이 직접 작성해보도록 유도하세요.`);
      } else if (opts.codeGenMode === 'step_by_step') {
        instructions.push(`3. 코드 제공 원칙: 단계별로 나누어 1단계씩 코드를 설명하고 확인하며 진행하세요.`);
      } else {
        instructions.push(`3. 코드 제공 원칙: 깔끔하고 동작 가능한 예제 코드를 직접 제공하고 원리를 설명하세요.`);
      }

      if (opts.explainError) {
        instructions.push(`4. 오류 설명: 컴파일 에러나 오작동 질문 시, 에러가 발생한 이유를 학생 눈높이에 맞추어 공감하며 친절히 설명하세요.`);
      }
      if (opts.suggestFix) {
        instructions.push(`5. 수정 제안: 틀린 부분을 바르게 고치는 방법과 팁을 단계별로 안내하세요.`);
      }
      if (opts.addComments) {
        instructions.push(`6. 친절한 주석: 제공하는 코드 조각에는 이해를 돕는 한글 주석(//)을 명확하게 달아주세요.`);
      }
      if (opts.useHardwareInfo) {
        instructions.push(`7. SODABOT 하드웨어 핀 정보:
- 보드: ESP32-S3 SuperMini
- 2.0" ST7789 LCD (SPI): MOSI:11, CLK:12, CS:13, DC:7, RST:6, BL:5V
- I2S 마이크: SCK(BCLK):9, WS(LRC):10, SD(DIN):8 (3.3V)
- I2S 앰프스피커 (MAX98357A): BCLK:5, LRC:3, DIN:44 (5V)
- 입력 버튼: GPIO4 (내부 풀업 INPUT_PULLUP)
- 기본 LED: GPIO2`);
      }
      break;
    }

    case 'study': {
      const opts = skill.studyOptions || {
        subject: 'science',
        method: 'socratic',
        quizMode: true,
        cheerLevel: 'high',
        provideSummaryNotes: true
      };

      const subjectName = {
        math: '수학',
        science: '과학',
        social: '사회',
        korean: '국어',
        general: '전과목/일반 상식'
      }[opts.subject] || '과학';

      instructions.push(`[AI 스킬 활성화: 공부도우미 (Study Helper)]`);
      instructions.push(`1. 담당 과목: ${subjectName}`);
      
      if (opts.method === 'socratic') {
        instructions.push(`2. 교수법: 질문으로 생각 열기(소크라테스 문답법). 일방적 정답 전달보다 "너는 왜 그렇게 생각했어?", "만약 ~라면 어떻게 될까?"처럼 질문으로 유도하세요.`);
      } else if (opts.method === 'analogy') {
        instructions.push(`2. 교수법: 일상 속 재미있는 비유와 예시를 들어 어려운 개념을 쉽게 이해시켜주세요.`);
      } else {
        instructions.push(`2. 교수법: 핵심 요점만을 1-2-3 목록으로 명쾌하게 정리해주는 요약형 설명.`);
      }

      if (opts.quizMode) {
        instructions.push(`3. 퀴즈 모드: 설명 후 "확인 퀴즈! Q. ..." 형식으로 가벼운 퀴즈를 1문제 내어보세요.`);
      }
      if (opts.cheerLevel === 'high') {
        instructions.push(`4. 동기부여: "정말 훌륭한 질문이야!", "점점 더 똑똑해지고 있어!" 같은 폭풍 칭찬과 따뜻한 격려를 듬뿍 담아주세요.`);
      }
      if (opts.provideSummaryNotes) {
        instructions.push(`5. 요약 정리: 답변 끝에 [📌 3줄 핵심 요약]을 간결하게 덧붙여주세요.`);
      }
      break;
    }

    case 'daily': {
      const opts = skill.dailyOptions || {
        checkGreeting: true,
        checkSchedule: true,
        memoryAssist: true,
        familyMessageMode: false,
        shortReply: true,
        easyExpression: true,
        safetyStrict: true
      };

      instructions.push(`[AI 스킬 활성화: 생활친구 (Daily Companion)]`);
      instructions.push(`1. 역할: 곁에서 다정하게 이야기를 들어주고 안부를 챙기는 감성 반려 로봇`);
      if (opts.checkGreeting) instructions.push(`2. 안부 대화: "오늘 밥은 맛있게 먹었어?", "오늘 하루 어떤 재미있는 일이 있었어?"처럼 다정하게 일상을 물어보세요.`);
      if (opts.checkSchedule) instructions.push(`3. 일정 챙김: 오늘의 할 일이나 숙제, 내일 준비물을 잊지 않았는지 챙겨주세요.`);
      if (opts.memoryAssist) instructions.push(`4. 기억 보조: 친구가 전에 말했던 취미나 관심사, 좋아하는 것들을 기억하고 자연스럽게 대화에 녹여내세요.`);
      if (opts.shortReply) instructions.push(`5. 답변 스타일: 너무 길지 않게 1~2문장으로 귀엽고 명료하게 이야기하세요.`);
      if (opts.easyExpression) instructions.push(`6. 어휘: 초등학생도 바로 이해할 수 있는 순화된 쉬운 우리말과 이모지를 사용하세요.`);
      
      // 안전 규칙 (필수 내장)
      if (opts.safetyStrict) {
        instructions.push(`7. ★안전 및 윤리 규칙 (절대 준수)★:
- 질병 진단, 약 복용 등 전문 의료 판단이나 치료 조언은 절대 하지 말고 "꼭 부모님이나 의사 선생님께 여쭤보자!"라고 안내하세요.
- 위험한 행동(높은 곳 오르기, 불/칼 장난, 낯선 사람 따라가기 등)을 권유하거나 지시하지 마세요.
- 폭력적, 혐오적, 비속어 표현을 사용하지 마세요.`);
      }
      break;
    }

    case 'presentation': {
      const opts = skill.presentationOptions || {
        topic: '소다봇 프로젝트 소개',
        targetAudience: '반 친구들과 선생님',
        focusAreas: ['자신감', '구조'],
        mockQa: true,
        timeManagementTips: true
      };

      instructions.push(`[AI 스킬 활성화: 발표연습 (Presentation Coach)]`);
      instructions.push(`1. 발표 주제: "${opts.topic}"`);
      instructions.push(`2. 대상 청중: "${opts.targetAudience}"`);
      instructions.push(`3. 집중 코칭 포인트: ${opts.focusAreas.join(', ')}`);
      instructions.push(`4. 코칭 방식: 학생이 말한 발표 대본이나 아이디어를 듣고, "서론-본론-결론" 흐름에 맞게 더 멋진 발표 멘트로 다듬어주세요.`);
      if (opts.mockQa) {
        instructions.push(`5. 모의 질의응답(Q&A): 발표 내용에 대해 청중이 할 법한 예리한 질문 1개를 던져주고 어떻게 답변할지 연습시켜주세요.`);
      }
      if (opts.timeManagementTips) {
        instructions.push(`6. 스피치 팁: 말하는 속도, 목소리 톤, 시선 처리, 시간 배분에 관한 꿀팁을 조언하세요.`);
      }
      break;
    }

    case 'custom': {
      const inputs = skill.customInputs || {
        skillName: '나만의 AI 스킬',
        forWhom: '친구들',
        targetProblem: '즐거운 대화',
        mustDo: '항상 다정하게 대답하기',
        mustNotDo: '화를 내거나 어려운 말 쓰지 않기',
        memoriesToUse: '기억 활용',
        responseStyle: '친근한 반말'
      };

      instructions.push(`[AI 스킬 활성화: ${inputs.skillName || '나만의 맞춤 AI 스킬'}]`);
      instructions.push(`1. 스킬 대상: ${inputs.forWhom || '사용자'}`);
      instructions.push(`2. 해결할 문제 및 목표: ${inputs.targetProblem || '유익하고 재미있는 대화 제공'}`);
      if (inputs.mustDo) {
        instructions.push(`3. 반드시 지켜야 할 행동 (DO): ${inputs.mustDo}`);
      }
      if (inputs.mustNotDo) {
        instructions.push(`4. 절대로 하지 말아야 할 행동 (DON'T): ${inputs.mustNotDo}`);
      }
      if (inputs.memoriesToUse) {
        instructions.push(`5. 기억 활용 지침: ${inputs.memoriesToUse}`);
      }
      if (inputs.responseStyle) {
        instructions.push(`6. 답변 스타일 및 분량: ${inputs.responseStyle}`);
      }
      break;
    }
  }

  return instructions.join('\n');
}

export function generateInitialReport(
  userDisplayName: string,
  botName: string,
  activeSkill: AiSkillConfig,
  logs: AiSkillTestLog[]
): AiSkillProjectReport {
  const v1Logs = logs.filter(l => l.version === 1);
  const v2Logs = logs.filter(l => l.version >= 2);

  const sampleV1 = v1Logs[0];
  const sampleV2 = v2Logs[v2Logs.length - 1] || v1Logs[v1Logs.length - 1];

  return {
    id: `report-${Date.now()}`,
    userId: '',
    title: `10~11주차 SODABOT AI 스킬 프로젝트 보고서 - ${activeSkill.name}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sodabotIntro: `나의 소다봇 '${botName}'(은)는 학생 ${userDisplayName}의 반려 로봇으로, 10~11주차 프로젝트를 통해 '${activeSkill.name}' 기능을 부여받았습니다.`,
    targetProblem: activeSkill.type === 'english'
      ? '원어민과 영어로 대화할 기회가 부족하고 문법이 틀릴까 봐 두려운 문제를 해결하고자 합니다.'
      : activeSkill.type === 'coding'
      ? '아두이노 회로와 C++ 코딩 중 오류가 났을 때 혼자서 원인을 파악하기 어려운 점을 돕고자 합니다.'
      : activeSkill.type === 'study'
      ? '혼자 공부할 때 핵심 개념을 이해하기 어렵고 동기부여가 필요한 문제를 해결하고자 합니다.'
      : activeSkill.type === 'daily'
      ? '바쁜 일상에서 안부를 챙기고 따뜻하게 공감해줄 수 있는 안전한 반려 친구를 만들고자 합니다.'
      : activeSkill.type === 'presentation'
      ? '발표를 앞두고 긴장되거나 발표 구조를 잡기 어려운 문제를 해결하고자 합니다.'
      : (activeSkill.customInputs?.targetProblem || '일상 속 불편함을 해결하고 유익한 대화를 나누고자 합니다.'),
    selectedSkill: `${activeSkill.name} (버전: V${activeSkill.version}) - ${activeSkill.description}`,
    usageScenario: `${userDisplayName}(이)가 소다봇에게 음성이나 웹 대화로 상황에 맞는 질문을 하면, 소다봇이 설정된 AI 스킬 규칙에 따라 즉시 맞춤형 응답을 제공하는 시나리오입니다.`,
    actualLogs: logs.slice(-5),
    goodPoints: sampleV2?.goodPoints || '질문의 의도를 잘 파악하고 친근한 어조로 즉시 답변을 제공하여 만족스러웠습니다.',
    painPoints: sampleV1?.badPoints || '초기 버전(V1)에서는 설명이 다소 길거나 원하는 방식(힌트 위주 등)과 조금 차이가 있었습니다.',
    modifications: sampleV2?.modifications || 'AI 스킬 옵션 조정을 통해 답변 길이와 규칙을 세분화하고, 핵심 피드백을 추가하도록 설정을 개선했습니다.',
    comparisonV1V2: {
      v1Summary: `V1 초기 설정: ${sampleV1?.situation || '기본 질문 테스트'}`,
      v1Response: sampleV1?.aiResponse || '초기 AI 응답 예시',
      v2Summary: `V2 개선 설정: ${sampleV2?.situation || '설정 튜닝 후 동일 질문 재테스트'}`,
      v2Response: sampleV2?.aiResponse || '개선된 맞춤형 AI 응답 예시',
      improvements: '규칙을 세밀하게 조정한 후 답변의 정확도와 친밀도가 대폭 향상되었습니다.'
    },
    futureFeatures: '앞으로 소다봇의 LCD 화면 표정 애니메이션 및 모션과 AI 스킬을 더욱 긴밀하게 연동하고 싶습니다.',
    attachedImages: [],
    completed: false
  };
}

export function generateSkillSimulatedReply(
  skill: AiSkillConfig,
  userText: string,
  userDisplayName: string = '친구'
): string {
  const skillType = skill.type || 'english';

  if (skillType === 'english') {
    const opts = skill.englishOptions || {
      level: 'beginner',
      ratio: 50,
      koreanHint: true,
      grammarCorrection: true,
      length: 'short',
      wordQuiz: false,
      roleplay: false
    };

    if (userText.toLowerCase().includes('hello') || userText.toLowerCase().includes('hi') || userText.includes('안녕')) {
      let res = `Hello ${userDisplayName}! It's great to speak English with you today! 🌟`;
      if (opts.koreanHint) res += `\n(안녕 ${userDisplayName}! 오늘 너와 영어로 이야기하게 되어 정말 기뻐!)`;
      if (opts.wordQuiz) res += `\n\n[💡 Quick Quiz!]: What is the English word for '로봇'? (Answer: Robot!)`;
      return res;
    } else if (userText.toLowerCase().includes('name') || userText.includes('이름')) {
      let res = `My name is SODA English Buddy! What should I call you?`;
      if (opts.koreanHint) res += `\n(내 이름은 소다 영어친구야! 너를 뭐라고 부르면 될까?)`;
      return res;
    } else {
      let res = `Awesome! You said: "${userText}". Keep up the great work! 🚀`;
      if (opts.grammarCorrection && userText.length > 4 && !userText.includes('.')) {
        res += `\n\n[💡 교정 팁: "${userText}." 처럼 마침표나 자연스러운 문장 구조로 마무리하면 더욱 좋아요!]`;
      }
      if (opts.koreanHint) res += `\n(멋져! 영어로 자신감 있게 대화해보자!)`;
      return res;
    }
  } else if (skillType === 'coding') {
    const opts = skill.codingOptions || {
      level: 'elementary',
      codeGenMode: 'hint',
      explainError: true,
      suggestFix: true,
      addComments: true,
      useHardwareInfo: true
    };
    const isError = userText.includes('에러') || userText.includes('error') || userText.includes('오류') || userText.includes('안돼') || userText.includes('안 켜져');

    if (isError) {
      return `오류가 발생했구나! 에러는 훌륭한 개발자가 되기 위한 최고의 공부 기회야 🛠️\n\n1. 하드웨어 배선: 버튼은 GPIO 4, LED는 GPIO 2에 제대로 연결되어 있는지 확인해봐!\n2. 코드 확인: \`pinMode(4, INPUT_PULLUP);\`가 setup() 함수 안에 빠짐없이 들어있는지 점검해볼까?\n\n어떤 에러 메시지가 나오는지 알려주면 단계별로 해결해줄게!`;
    } else if (opts.codeGenMode === 'hint') {
      return `좋은 코딩 질문이야! 💡\n\n힌트: 소다봇의 ST7789 LCD는 SPI 통신(MOSI:11, CLK:12, CS:13, DC:7, RST:6)을 사용해. 한 번에 전체 코드를 짜기보다, 먼저 \`tft.init()\`과 \`tft.fillScreen()\`으로 배경색부터 출력해보자!\n\n궁금한 점이 더 생기면 언제든 질문해줘!`;
    } else {
      return `소다봇 코딩 예제 코드야! 🤖\n\n\`\`\`cpp\n// 소다봇 기본 인터랙션\nvoid setup() {\n  Serial.begin(115200);\n  pinMode(4, INPUT_PULLUP); // GPIO 4 풀업 버튼\n  pinMode(2, OUTPUT);       // GPIO 2 LED\n}\n\nvoid loop() {\n  if (digitalRead(4) == LOW) {\n    digitalWrite(2, HIGH);\n    Serial.println("버튼 누름 감지!");\n  } else {\n    digitalWrite(2, LOW);\n  }\n}\n\`\`\`\n\n한 줄씩 읽어보고 직접 업로드해봐!`;
    }
  } else if (skillType === 'study') {
    const opts = skill.studyOptions || { subject: 'science', method: 'socratic', quizMode: true, cheerLevel: 'high', provideSummaryNotes: true };
    if (opts.method === 'socratic') {
      return `와, 핵심을 찌르는 훌륭한 호기심이야! 👏\n\n너는 "${userText}"에 대해 어떻게 생각해? 왜 그런 일이 일어날까?\n\n너만의 재미있는 가설을 편하게 이야기해줘!`;
    } else {
      return `쉽게 설명해줄게! 🌱\n\n컴퓨터의 CPU가 우리의 '생각하는 두뇌'라면, 메모리(RAM)는 책을 펼쳐놓는 '공부 책상'이야!\n\n[📌 3줄 핵심 요약]\n1. CPU는 연산과 판단을 해요.\n2. RAM은 현재 작업 공간이에요.\n3. 차근차근 생각하면 원리가 쏙쏙 들어와요!`;
    }
  } else if (skillType === 'daily') {
    return `안녕 ${userDisplayName}! 오늘 하루도 정말 수고 많았어! 💖\n\n오늘 기분은 어때? 맛있는 건 잘 먹었니? 오늘 학교에서 재미있었던 일이나 나누고 싶은 이야기가 있다면 다 들려줘! 언제나 네 곁에 있을게 ✨`;
  } else if (skillType === 'presentation') {
    return `발표 코칭 소다봇이야! 🎤\n\n말해준 "${userText}" 내용은 청중의 관심을 끌기에 아주 좋아!\n\n[💡 스피치 코칭 팁]:\n- 첫인사 후 "제가 소다봇을 만든 이유는..."처럼 스토리텔링으로 시작해보세요.\n- 결론에서는 당당한 목소리로 배운 점을 강조하세요!\n\n[모의 질의응답 (Q&A)]: "가장 만들기 어려웠던 부품 연결은 무엇이었나요?"라는 질문을 받는다면 어떻게 대답해볼까?`;
  } else {
    const custom = skill.customInputs;
    const sName = custom?.skillName || skill.name || '맞춤 AI';
    const sDo = custom?.mustDo || '항상 밝은 미소로 응답';
    return `안녕! 나는 '${sName}'이야! ✨\n\n"${userText}"에 대해 규칙대로 성심껏 답변할게! (${sDo}) 다음 이야기도 들려줘!`;
  }
}

