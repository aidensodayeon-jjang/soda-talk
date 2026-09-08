export interface User {
  id: string;
  username: string;
  displayName: string;
  role?: "admin" | "student" | "user";
  canAccessChat?: boolean;
}

export interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  modelUsed?: string;
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

