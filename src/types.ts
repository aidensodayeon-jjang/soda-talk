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


