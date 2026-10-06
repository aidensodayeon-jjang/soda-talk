export interface FriendSettings {
  persona?: {
    robotName?: string;
    role?: string;
    tone?: string;
    speechStyle?: string;
    personality?: string;
  };
  profile?: {
    studentName?: string;
    school?: string;
    grade?: string;
    interests?: string;
    dream?: string;
  };
  memories?: Array<{ id: string; text: string; date?: string }>;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  role?: "admin" | "student" | "user";
  canAccessChat?: boolean;
  personalApiKey?: string;
  friendSettings?: FriendSettings;
}

export interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  modelUsed?: string;
  source?: "web" | "sodabot";
  deviceId?: string | null;
}

export interface ChatRoom {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  messages: Message[];
}

export interface LMStudioConfig {
  lmStudioUrl: string;
  modelName: string;
  fallbackMode: boolean;
}

export interface CourseContent {
  id: string;
  week: number;
  title: string;
  description: string;
  filename: string;
  language: "arduino" | "python" | "cpp" | "json";
  tags: string[];
  pinMap?: string;
  code: string;
  contentType?: "code" | "circuit" | "doc" | "editor";
  imageUrl?: string;
  updatedAt?: string;
}

// ----------------------------------------------------
// SODABOT Friends (친구 기능 및 1:1 메시지)
// ----------------------------------------------------
export interface SodabotPublicProfile {
  userId: string;
  botName: string;
  nickname: string;
  description: string;
  avatarUrl?: string;
  isPublic: boolean;
  isOnline?: boolean;
  lastSeenAt?: string;
}

export interface Friendship {
  id: string;
  requesterId: string;
  receiverId: string;
  status: "pending" | "accepted" | "rejected" | "blocked";
  createdAt: string;
  acceptedAt?: string;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  status: "sent" | "delivered" | "read";
  playedOnSodabot?: boolean;
}

export interface GroupChatMember {
  userId: string;
  botName: string;
  nickname: string;
  avatarUrl?: string;
  isOnline: boolean;
  role?: "creator" | "member";
}

export interface GroupChatRoom {
  id: string;
  name: string;
  creatorId: string;
  memberIds: string[];
  members?: GroupChatMember[];
  createdAt: string;
  unreadCount?: number;
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    createdAt: string;
  };
}

export interface GroupChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  createdAt: string;
  readBy: string[];
  playedOnSodabot?: boolean;
}

export interface FriendSummaryCard {
  userId: string;
  botName: string;
  nickname: string;
  description: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastSeenAt?: string;
  friendshipId?: string;
  friendshipStatus?: "none" | "pending_sent" | "pending_received" | "accepted" | "blocked";
  unreadCount?: number;
  lastMessage?: DirectMessage;
}

// ----------------------------------------------------
// 10~11주차 프로젝트: SODABOT AI 스킬 (AI Skills)
// ----------------------------------------------------
export type AiSkillType = 'english' | 'coding' | 'study' | 'daily' | 'presentation' | 'custom';

export interface EnglishSkillOptions {
  level: 'beginner' | 'intermediate' | 'advanced'; // 초급 / 중급 / 고급
  ratio: number; // 20, 50, 80, 100
  koreanHint: boolean;
  grammarCorrection: boolean;
  length: 'short' | 'medium' | 'detailed';
  wordQuiz: boolean;
  roleplay: boolean;
  roleplayScenario?: string;
}

export interface CodingSkillOptions {
  level: 'elementary' | 'middle' | 'advanced'; // 초등/입문, 중등/기초, 실전 심화
  codeGenMode: 'hint' | 'direct' | 'step_by_step'; // 힌트 위주, 코드 직접 생성, 단계별
  explainError: boolean;
  suggestFix: boolean;
  addComments: boolean;
  useHardwareInfo: boolean; // SODABOT 하드웨어 핀/부품 정보 사용 여부
}

export interface StudySkillOptions {
  subject: 'math' | 'science' | 'social' | 'korean' | 'general';
  method: 'socratic' | 'analogy' | 'summary'; // 질문 유도, 쉬운 비유, 핵심 요약
  quizMode: boolean;
  cheerLevel: 'high' | 'normal';
  provideSummaryNotes: boolean;
}

export interface DailySkillOptions {
  checkGreeting: boolean; // 안부 대화
  checkSchedule: boolean; // 일정 확인
  memoryAssist: boolean; // 기억 보조
  familyMessageMode: boolean; // 가족 메시지 읽기 스타일
  shortReply: boolean; // 짧은 답변
  easyExpression: boolean; // 쉬운 표현
  safetyStrict: boolean; // 의료/위험 조언 금지 안전 규칙
}

export interface PresentationSkillOptions {
  topic: string;
  targetAudience: string;
  focusAreas: string[]; // 구조, 자신감, 표현 다듬기, 질문 예측
  mockQa: boolean; // 모의 질의응답
  timeManagementTips: boolean; // 발표 시간 조절 팁
}

export interface CustomSkillInputs {
  skillName: string; // 스킬 이름
  forWhom: string; // 누구를 위한 것인가
  targetProblem: string; // 어떤 문제를 돕는가
  mustDo: string; // 반드시 해야 하는 행동
  mustNotDo: string; // 하지 말아야 하는 행동
  memoriesToUse: string; // 사용할 기억
  responseStyle: string; // 답변 방식
}

export interface AiSkillConfig {
  id: string;
  type: AiSkillType;
  name: string;
  description: string;
  icon: string;
  version: number;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;

  // 공통 옵션
  responseLength?: 'short' | 'medium' | 'long';
  speechTone?: 'friendly' | 'polite' | 'expert' | 'cute';

  // 타입별 상세 옵션
  englishOptions?: EnglishSkillOptions;
  codingOptions?: CodingSkillOptions;
  studyOptions?: StudySkillOptions;
  dailyOptions?: DailySkillOptions;
  presentationOptions?: PresentationSkillOptions;
  customInputs?: CustomSkillInputs;

  compiledPrompt?: string;
}

export interface AiSkillTestLog {
  id: string;
  skillId: string;
  skillName: string;
  version: number;
  situation: string; // 사용 상황
  userQuestion: string;
  aiResponse: string;
  timestamp: string;
  goodPoints?: string; // 잘된 점
  badPoints?: string; // 아쉬운 점
  modifications?: string; // 수정한 내용
  source?: 'web' | 'sodabot';
}

export interface AiSkillVersionSnapshot {
  id: string;
  skillId: string;
  version: number;
  config: AiSkillConfig;
  notes?: string;
  sampleQuestion?: string;
  sampleResponse?: string;
  createdAt: string;
}

export interface AiSkillProjectReport {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  // 10대 보고서 항목
  sodabotIntro: string; // 1. 내 소다봇 소개
  targetProblem: string; // 2. 해결하고 싶은 문제
  selectedSkill: string; // 3. 선택한 AI 스킬
  usageScenario: string; // 4. 사용 시나리오
  actualLogs: AiSkillTestLog[]; // 5. 실제 사용 기록
  goodPoints: string; // 6. 잘된 점
  painPoints: string; // 7. 문제점
  modifications: string; // 8. 수정한 내용
  comparisonV1V2: {
    v1Summary: string;
    v1Response: string;
    v2Summary: string;
    v2Response: string;
    improvements: string;
  }; // 9. 개선 전 / 개선 후
  futureFeatures: string; // 10. 앞으로 추가하고 싶은 기능
  attachedImages?: string[]; // 첨부 사진/스크린샷
  completed: boolean;
}

export interface UserAiSkillState {
  activeSkillId: string;
  skills: AiSkillConfig[];
  testLogs: AiSkillTestLog[];
  versionSnapshots: AiSkillVersionSnapshot[];
  report?: AiSkillProjectReport;
}



