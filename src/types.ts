export interface User {
  id: string;
  username: string;
  displayName: string;
}

export interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
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
