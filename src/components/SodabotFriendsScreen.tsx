import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Search,
  UserPlus,
  MessageSquare,
  Volume2,
  Check,
  CheckCheck,
  Globe,
  Lock,
  ArrowLeft,
  Send,
  Trash2,
  Shield,
  Clock,
  Sparkles,
  Bot,
  RefreshCw,
  X,
  AlertCircle,
  Smile,
  VolumeX
} from 'lucide-react';
import { User, SodabotPublicProfile, FriendSummaryCard, DirectMessage, Friendship } from '../types';
import { sodabotTransport } from '../utils/sodabotTransport';

interface SodabotFriendsScreenProps {
  currentUser: User;
  token: string | null;
  isSodabotConnected: boolean;
  onBackToChat?: () => void;
}

const AVATAR_OPTIONS = [
  { id: 'robot-blue', name: '스마트 블루 🤖', emoji: '🤖', bg: 'bg-blue-50 text-blue-600 border-blue-200' },
  { id: 'robot-purple', name: '매직 퍼플 🔮', emoji: '👾', bg: 'bg-purple-50 text-purple-600 border-purple-200' },
  { id: 'robot-emerald', name: '에코 그린 🍃', emoji: '🌱', bg: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  { id: 'robot-amber', name: '선샤인 옐로 ⚡', emoji: '⚡', bg: 'bg-amber-50 text-amber-600 border-amber-200' },
  { id: 'robot-rose', name: '러블리 핑크 💖', emoji: '🧸', bg: 'bg-rose-50 text-rose-600 border-rose-200' },
  { id: 'robot-indigo', name: '코스믹 인디고 🌌', emoji: '🚀', bg: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
];

function formatTimeAgo(isoString?: string): string {
  if (!isoString) return '오프라인';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return '방금 전 접속';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${diffDay}일 전`;
}

export const SodabotFriendsScreen: React.FC<SodabotFriendsScreenProps> = ({
  currentUser,
  token,
  isSodabotConnected,
  onBackToChat
}) => {
  const [activeTab, setActiveTab] = useState<'friends' | 'find' | 'requests'>('friends');
  
  // My Profile
  const [myProfile, setMyProfile] = useState<SodabotPublicProfile | null>(null);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editBotName, setEditBotName] = useState('');
  const [editNickname, setEditNickname] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('robot-blue');
  const [savingProfile, setSavingProfile] = useState(false);

  // Friend List & Search
  const [friends, setFriends] = useState<FriendSummaryCard[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendSummaryCard[]>([]);
  const [searching, setSearching] = useState(false);

  // Requests
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);

  // 1:1 Direct Message Chat View
  const [selectedFriend, setSelectedFriend] = useState<FriendSummaryCard | null>(null);
  const [chatMessages, setChatMessages] = useState<DirectMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sendingDm, setSendingDm] = useState(false);
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const [playStatusMessage, setPlayStatusMessage] = useState<string | null>(null);

  // Notifications
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Initial Load & Periodic Presence Ping
  useEffect(() => {
    if (!token) return;

    fetchMyProfile();
    fetchFriends();
    fetchRequests();
    fetchNotifications();

    // Heartbeat presence ping every 25 seconds
    const pingInterval = setInterval(() => {
      fetch('/api/presence/ping', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }, 25000);

    // Initial ping
    fetch('/api/presence/ping', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {});

    // Polling for real-time updates (friends, requests, presence) every 3 seconds
    const pollInterval = setInterval(() => {
      fetchFriends(false);
      fetchRequests(false);
      fetchNotifications();
    }, 3000);

    return () => {
      clearInterval(pingInterval);
      clearInterval(pollInterval);
    };
  }, [token]);

  // 2. Poll Messages if in Direct Chat
  useEffect(() => {
    if (!token || !selectedFriend) return;

    fetchMessages(selectedFriend.userId, true);

    const msgInterval = setInterval(() => {
      fetchMessages(selectedFriend.userId, false);
    }, 2000);

    return () => clearInterval(msgInterval);
  }, [token, selectedFriend?.userId]);

  // Scroll to bottom of message thread
  useEffect(() => {
    if (selectedFriend) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, selectedFriend]);

  // ----------------------------------------------------
  // API Fetchers
  // ----------------------------------------------------
  const fetchMyProfile = async () => {
    try {
      const res = await fetch('/api/friends/my-profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data: SodabotPublicProfile = await res.json();
        setMyProfile(data);
        setEditIsPublic(data.isPublic);
        setEditBotName(data.botName);
        setEditNickname(data.nickname);
        setEditDescription(data.description);
        setEditAvatarUrl(data.avatarUrl || 'robot-blue');
      }
    } catch (err) {
      console.error('Failed to fetch my profile', err);
    }
  };

  const fetchFriends = async (showLoading = true) => {
    try {
      const res = await fetch('/api/friends/list', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFriends(data);
      }
    } catch (err) {
      console.error('Failed to fetch friends', err);
    }
  };

  const fetchRequests = async (showLoading = true) => {
    try {
      const res = await fetch('/api/friends/requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIncomingRequests(data.incoming || []);
        setOutgoingRequests(data.outgoing || []);
      }
    } catch (err) {
      console.error('Failed to fetch requests', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/friends/notifications/count', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPendingTotal(data.pendingRequestsCount || 0);
        setUnreadTotal(data.unreadMessagesCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  const handleSearch = async (queryToSearch = searchQuery) => {
    setSearching(true);
    try {
      const res = await fetch(`/api/friends/search?q=${encodeURIComponent(queryToSearch)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setSearching(false);
    }
  };

  const fetchMessages = async (friendId: string, scrollToBottom = false) => {
    try {
      const res = await fetch(`/api/friends/messages/${friendId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data.messages || []);
        if (data.friend) {
          setSelectedFriend(prev => prev ? { ...prev, ...data.friend } : data.friend);
        }
      }
    } catch (err) {
      console.error('Failed to fetch messages', err);
    }
  };

  // ----------------------------------------------------
  // Actions
  // ----------------------------------------------------
  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch('/api/friends/my-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          isPublic: editIsPublic,
          botName: editBotName,
          nickname: editNickname,
          description: editDescription,
          avatarUrl: editAvatarUrl
        })
      });
      if (res.ok) {
        const data = await res.json();
        setMyProfile(data.profile);
        setShowEditProfileModal(false);
      }
    } catch (err) {
      console.error('Failed to save profile', err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleTogglePublic = async (nextValue: boolean) => {
    setEditIsPublic(nextValue);
    try {
      const res = await fetch('/api/friends/my-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isPublic: nextValue })
      });
      if (res.ok) {
        const data = await res.json();
        setMyProfile(data.profile);
      }
    } catch (err) {
      console.error('Failed to toggle public state', err);
    }
  };

  const handleSendFriendRequest = async (targetUserId: string) => {
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId })
      });
      const data = await res.json();
      if (res.ok) {
        // Refresh search results & requests
        handleSearch();
        fetchRequests();
        fetchFriends();
      } else {
        alert(data.error || '친구 요청에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to send friend request', err);
    }
  };

  const handleRespondRequest = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      const res = await fetch('/api/friends/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ requestId, action })
      });
      if (res.ok) {
        fetchRequests();
        fetchFriends();
        fetchNotifications();
      }
    } catch (err) {
      console.error('Failed to respond request', err);
    }
  };

  const handleDeleteFriend = async (friendUserId: string) => {
    if (!window.confirm('정말로 이 친구를 목록에서 삭제하시겠습니까?')) return;
    try {
      const res = await fetch('/api/friends/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ friendUserId })
      });
      if (res.ok) {
        if (selectedFriend?.userId === friendUserId) {
          setSelectedFriend(null);
        }
        fetchFriends();
      }
    } catch (err) {
      console.error('Failed to delete friend', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedFriend || sendingDm) return;

    const content = inputMessage.trim();
    setInputMessage('');
    setSendingDm(true);

    // Optimistic local add
    const tempDm: DirectMessage = {
      id: 'dm-temp-' + Date.now(),
      senderId: currentUser.id,
      receiverId: selectedFriend.userId,
      content,
      createdAt: new Date().toISOString(),
      status: 'sent'
    };
    setChatMessages(prev => [...prev, tempDm]);

    try {
      const res = await fetch(`/api/friends/messages/${selectedFriend.userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content })
      });
      if (res.ok) {
        fetchMessages(selectedFriend.userId, true);
        fetchFriends(false);
      }
    } catch (err) {
      console.error('Failed to send DM', err);
    } finally {
      setSendingDm(false);
    }
  };

  // ----------------------------------------------------
  // 실물 SODABOT TTS 발화 연동
  // ----------------------------------------------------
  const handlePlayOnSodabot = async (message: DirectMessage) => {
    setPlayingMsgId(message.id);
    setPlayStatusMessage('소다봇으로 메시지 전송 중...');

    try {
      // 1. Mark on Backend
      const res = await fetch(`/api/friends/messages/${message.id}/play-sodabot`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      const textToSpeak = data.speechText || `${selectedFriend?.botName || '친구'}의 메시지: ${message.content}`;

      // 2. Send command to physical SODABOT if connected
      if (isSodabotConnected) {
        try {
          await sodabotTransport.send('speak', textToSpeak);
          setPlayStatusMessage('🔊 실물 소다봇에서 음성을 재생했습니다!');
        } catch (transportErr) {
          console.warn('sodabotTransport speak error:', transportErr);
          setPlayStatusMessage('소다봇 전송 실패 (기기 연결 상태를 확인하세요)');
        }
      } else {
        setPlayStatusMessage('소다봇이 연결되어 있지 않습니다. [소다봇 연동] 탭에서 연결해 주세요.');
      }

      // 3. Refresh message list to update status
      if (selectedFriend) {
        fetchMessages(selectedFriend.userId, false);
      }
    } catch (err) {
      console.error('Failed to play on sodabot', err);
      setPlayStatusMessage('음성 출력 중 오류가 발생했습니다.');
    } finally {
      setTimeout(() => {
        setPlayingMsgId(null);
        setPlayStatusMessage(null);
      }, 3500);
    }
  };

  const getAvatarInfo = (avatarId?: string) => {
    return AVATAR_OPTIONS.find(a => a.id === avatarId) || AVATAR_OPTIONS[0];
  };

  return (
    <div className="flex-1 flex h-full bg-[#FAF9F6] overflow-hidden select-none">

      {/* ---------------------------------------------------------------- */}
      {/* 1. Direct Message Chat Modal / Full View (When friend selected)  */}
      {/* ---------------------------------------------------------------- */}
      {selectedFriend ? (
        <div className="flex-1 flex flex-col h-full bg-white relative">
          {/* Header */}
          <header className="h-16 px-6 border-b border-[#EAE6DF] bg-white flex items-center justify-between shrink-0 shadow-2xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedFriend(null)}
                className="p-2 hover:bg-[#FAF9F6] rounded-xl text-[#5C5B57] hover:text-[#1D1D1F] transition-colors cursor-pointer border border-transparent hover:border-[#EAE6DF]"
                title="친구 목록으로 돌아가기"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="relative">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold border ${getAvatarInfo(selectedFriend.avatarUrl).bg}`}>
                  {getAvatarInfo(selectedFriend.avatarUrl).emoji}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                  selectedFriend.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-300'
                }`} />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#1D1D1F]">{selectedFriend.botName}</h3>
                  <span className="text-xs text-[#86868B] font-mono">@{selectedFriend.nickname}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  {selectedFriend.isOnline ? (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      실시간 온라인
                    </span>
                  ) : (
                    <span className="text-[#86868B] font-mono">
                      {formatTimeAgo(selectedFriend.lastSeenAt)}
                    </span>
                  )}
                  {selectedFriend.description && (
                    <span className="text-[#B0ACA5] hidden sm:inline">· {selectedFriend.description}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDeleteFriend(selectedFriend.userId)}
                className="p-2 text-[#86868B] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                title="친구 삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Toast / Status for SODABOT Play */}
          {playStatusMessage && (
            <div className="bg-indigo-50 border-b border-indigo-100 py-2 px-6 text-xs text-indigo-700 flex items-center justify-center gap-2 animate-fade-in font-medium">
              <Volume2 className="w-4 h-4 animate-bounce" />
              <span>{playStatusMessage}</span>
            </div>
          )}

          {/* Chat Messages Timeline */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#FAF9F6]/60 relative">
            <div className="max-w-2xl mx-auto space-y-4">
              
              {/* Privacy / Safety Notice */}
              <div className="p-3 bg-white border border-[#EAE6DF] rounded-2xl text-center space-y-1 shadow-2xs max-w-md mx-auto my-2">
                <p className="text-xs font-bold text-[#1D1D1F] flex items-center justify-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  안전한 친구 1:1 메시지
                </p>
                <p className="text-[10px] text-[#86868B]">
                  친구 간의 대화는 AI 봇 대화와 별개로 안전하게 분리되어 전달됩니다.
                </p>
              </div>

              {chatMessages.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-[#EAE6DF] flex items-center justify-center text-indigo-600 mx-auto shadow-2xs">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-bold text-[#1D1D1F]">
                    {selectedFriend.botName}에게 첫 메시지를 보내보세요!
                  </h4>
                  <p className="text-[11px] text-[#86868B]">
                    코딩 이야기, 수업 내용, 또는 반가운 인사를 나눠보세요.
                  </p>
                </div>
              ) : (
                chatMessages.map(msg => {
                  const isMine = msg.senderId === currentUser.id;
                  const isPlaying = playingMsgId === msg.id;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} space-y-1`}
                    >
                      <div className="flex items-end gap-2 max-w-[80%]">
                        {!isMine && (
                          <div className={`w-7 h-7 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold border ${getAvatarInfo(selectedFriend.avatarUrl).bg}`}>
                            {getAvatarInfo(selectedFriend.avatarUrl).emoji}
                          </div>
                        )}

                        <div
                          className={`rounded-2xl px-4 py-2.5 text-xs shadow-2xs leading-relaxed ${
                            isMine
                              ? 'bg-indigo-600 text-white rounded-br-xs'
                              : 'bg-white text-[#1D1D1F] border border-[#EAE6DF] rounded-bl-xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                          {/* Action for Receiver: Play on Physical SODABOT */}
                          {!isMine && (
                            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => handlePlayOnSodabot(msg)}
                                disabled={isPlaying}
                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-2xs ${
                                  msg.playedOnSodabot
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                                }`}
                                title="이 메시지를 연결된 실제 소다봇 스피커로 출력합니다"
                              >
                                <Volume2 className={`w-3 h-3 ${isPlaying ? 'animate-spin' : ''}`} />
                                <span>{msg.playedOnSodabot ? '소다봇으로 다시 듣기 🔊' : '🔊 소다봇으로 듣기'}</span>
                              </button>

                              <span className="text-[9px] text-[#86868B] font-mono">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Message Meta for Sender */}
                      {isMine && (
                        <div className="flex items-center gap-1.5 text-[9px] text-[#86868B] font-mono px-1">
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {msg.status === 'read' ? (
                            <span className="text-indigo-600 flex items-center gap-0.5" title="읽음">
                              <CheckCheck className="w-3 h-3" />
                              <span>읽음</span>
                            </span>
                          ) : (
                            <span className="text-[#86868B] flex items-center gap-0.5" title="전송됨">
                              <Check className="w-3 h-3" />
                              <span>전송됨</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Bottom Input Area */}
          <footer className="p-4 bg-white border-t border-[#EAE6DF]">
            <form onSubmit={handleSendMessage} className="max-w-2xl mx-auto flex items-center gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                placeholder={`${selectedFriend.botName}에게 메시지를 입력하세요...`}
                maxLength={500}
                className="flex-1 bg-[#FAF9F6] border border-[#EAE6DF] focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-xs text-[#1D1D1F] outline-none transition-all placeholder:text-[#86868B]"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || sendingDm}
                className="p-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 text-white rounded-2xl shadow-sm transition-all cursor-pointer shrink-0"
                title="전송"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </footer>
        </div>
      ) : (

        /* ---------------------------------------------------------------- */
        /* 2. Main Friends Hub Screen (Tabs: Friends / Find / Requests)     */
        /* ---------------------------------------------------------------- */
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAF9F6]">
          
          {/* Header & My Profile Card */}
          <header className="p-6 bg-white border-b border-[#EAE6DF] shrink-0 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold text-[#1D1D1F] tracking-tight flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    소다봇 친구
                  </h1>
                  <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold rounded-full">
                    SODA AI LAB 8주차
                  </span>
                </div>
                <p className="text-xs text-[#86868B] mt-0.5">
                  내 소다봇을 공개하고 반 친구들과 1:1 메시지를 주고받아 보세요.
                </p>
              </div>

              {/* My Profile Mini Badge & Public Switch */}
              {myProfile && (
                <div className="flex items-center gap-3 bg-[#FAF9F6] border border-[#EAE6DF] p-2 rounded-2xl shadow-2xs">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base border ${getAvatarInfo(myProfile.avatarUrl).bg}`}>
                    {getAvatarInfo(myProfile.avatarUrl).emoji}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#1D1D1F]">{myProfile.botName}</span>
                      <span className="text-[10px] text-[#86868B] font-mono">@{myProfile.nickname}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <button
                        onClick={() => handleTogglePublic(!myProfile.isPublic)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                          myProfile.isPublic
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
                        }`}
                        title="클릭하여 공개 여부를 즉시 전환합니다"
                      >
                        {myProfile.isPublic ? <Globe className="w-3 h-3 text-emerald-600" /> : <Lock className="w-3 h-3 text-zinc-600" />}
                        <span>내 소다봇 공개: {myProfile.isPublic ? 'ON' : 'OFF'}</span>
                      </button>

                      <button
                        onClick={() => setShowEditProfileModal(true)}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
                      >
                        설정 변경
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Sub-Tabs */}
            <div className="flex items-center gap-2 border-b border-[#EAE6DF] pt-2">
              <button
                onClick={() => setActiveTab('friends')}
                className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer ${
                  activeTab === 'friends'
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-[#86868B] hover:text-[#1D1D1F]'
                }`}
              >
                내 친구 ({friends.length})
                {unreadTotal > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 bg-indigo-600 text-white text-[9px] font-bold rounded-full">
                    {unreadTotal}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveTab('find');
                  if (searchResults.length === 0) handleSearch('');
                }}
                className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer ${
                  activeTab === 'find'
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-[#86868B] hover:text-[#1D1D1F]'
                }`}
              >
                친구 찾기 🔍
              </button>

              <button
                onClick={() => setActiveTab('requests')}
                className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer ${
                  activeTab === 'requests'
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-[#86868B] hover:text-[#1D1D1F]'
                }`}
              >
                친구 요청
                {incomingRequests.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 bg-rose-500 text-white text-[9px] font-bold rounded-full animate-pulse">
                    {incomingRequests.length}
                  </span>
                )}
              </button>
            </div>
          </header>

          {/* Main Tab Content Arena */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">

              {/* ---------------------------------------------------- */}
              {/* TAB 1: FRIENDS LIST                                  */}
              {/* ---------------------------------------------------- */}
              {activeTab === 'friends' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[#1D1D1F] tracking-tight">
                      등록된 친구 목록 ({friends.length}명)
                    </h3>
                    <button
                      onClick={() => {
                        setActiveTab('find');
                        handleSearch('');
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      새 친구 찾기
                    </button>
                  </div>

                  {friends.length === 0 ? (
                    <div className="p-12 bg-white border border-[#EAE6DF] rounded-3xl text-center space-y-3 shadow-2xs">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mx-auto shadow-2xs">
                        <Users className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-[#1D1D1F]">아직 등록된 친구가 없어요</h4>
                      <p className="text-xs text-[#86868B] max-w-sm mx-auto">
                        [친구 찾기] 탭에서 공개된 반 친구들의 소다봇을 검색하고 친구 요청을 보내보세요!
                      </p>
                      <button
                        onClick={() => {
                          setActiveTab('find');
                          handleSearch('');
                        }}
                        className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm inline-flex items-center gap-1.5"
                      >
                        <Search className="w-3.5 h-3.5" />
                        친구 찾으러 가기
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {friends.map(friend => (
                        <div
                          key={friend.userId}
                          className="bg-white border border-[#EAE6DF] hover:border-indigo-300 rounded-2xl p-4 shadow-2xs hover:shadow-sm transition-all flex items-center justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl font-bold border ${getAvatarInfo(friend.avatarUrl).bg}`}>
                                {getAvatarInfo(friend.avatarUrl).emoji}
                              </div>
                              <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                                friend.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-300'
                              }`} />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-bold text-[#1D1D1F] truncate">{friend.botName}</h4>
                                <span className="text-[10px] text-[#86868B] font-mono truncate">@{friend.nickname}</span>
                              </div>
                              
                              <p className="text-[11px] text-[#5C5B57] truncate mt-0.5">
                                {friend.lastMessage ? (
                                  <span className="text-[#1D1D1F] font-medium">{friend.lastMessage.content}</span>
                                ) : (
                                  friend.description || '반가워! 소다봇 친구야'
                                )}
                              </p>

                              <div className="flex items-center gap-2 mt-1">
                                {friend.isOnline ? (
                                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    온라인
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-[#86868B] font-mono">
                                    {formatTimeAgo(friend.lastSeenAt)}
                                  </span>
                                )}

                                {friend.unreadCount && friend.unreadCount > 0 ? (
                                  <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[9px] font-bold rounded-full animate-bounce">
                                    새 메시지 {friend.unreadCount}개
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setSelectedFriend(friend)}
                              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>메시지</span>
                            </button>

                            <button
                              onClick={() => handleDeleteFriend(friend.userId)}
                              className="p-2 text-[#86868B] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="친구 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ---------------------------------------------------- */}
              {/* TAB 2: FIND FRIENDS (SEARCH PUBLIC BOT PROFILES)     */}
              {/* ---------------------------------------------------- */}
              {activeTab === 'find' && (
                <div className="space-y-4">
                  {/* Search Bar */}
                  <div className="bg-white border border-[#EAE6DF] rounded-2xl p-2 shadow-2xs flex items-center gap-2">
                    <Search className="w-4 h-4 text-[#86868B] ml-2 shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => {
                        setSearchQuery(e.target.value);
                        handleSearch(e.target.value);
                      }}
                      placeholder="소다봇 이름 또는 닉네임으로 검색..."
                      className="flex-1 bg-transparent text-xs text-[#1D1D1F] outline-none placeholder:text-[#86868B] py-1.5"
                    />
                    <button
                      onClick={() => handleSearch()}
                      className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
                    >
                      검색
                    </button>
                  </div>

                  {/* Search Results */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-[#86868B]">
                      <span>공개 설정된 소다봇 목록 ({searchResults.length}개)</span>
                      <span className="text-[10px] text-indigo-600 font-semibold">
                        🔒 실명과 학교 정보는 안전하게 보호됩니다
                      </span>
                    </div>

                    {searchResults.length === 0 ? (
                      <div className="p-12 bg-white border border-[#EAE6DF] rounded-3xl text-center space-y-2 shadow-2xs">
                        <Bot className="w-10 h-10 text-[#86868B] mx-auto opacity-50" />
                        <h4 className="text-xs font-bold text-[#1D1D1F]">검색 결과가 없습니다</h4>
                        <p className="text-[11px] text-[#86868B]">
                          친구가 [내 소다봇 공개: ON]으로 설정했는지 확인해 보세요.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {searchResults.map(card => {
                          const isAlreadyFriend = card.friendshipStatus === 'accepted';
                          const isPendingSent = card.friendshipStatus === 'pending_sent';
                          const isPendingReceived = card.friendshipStatus === 'pending_received';

                          return (
                            <div
                              key={card.userId}
                              className="bg-white border border-[#EAE6DF] hover:border-indigo-300 rounded-2xl p-4 shadow-2xs hover:shadow-sm transition-all flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="relative shrink-0">
                                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl font-bold border ${getAvatarInfo(card.avatarUrl).bg}`}>
                                    {getAvatarInfo(card.avatarUrl).emoji}
                                  </div>
                                  <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                                    card.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-300'
                                  }`} />
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <h4 className="text-xs font-bold text-[#1D1D1F] truncate">{card.botName}</h4>
                                    <span className="text-[10px] text-[#86868B] font-mono truncate">@{card.nickname}</span>
                                  </div>
                                  <p className="text-[11px] text-[#5C5B57] truncate mt-0.5">
                                    {card.description || '코딩 친구 해요 ✨'}
                                  </p>
                                  <div className="mt-1">
                                    {card.isOnline ? (
                                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        온라인
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-[#86868B] font-mono">
                                        {formatTimeAgo(card.lastSeenAt)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0">
                                {isAlreadyFriend ? (
                                  <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5" />
                                    친구 ✓
                                  </span>
                                ) : isPendingSent ? (
                                  <span className="px-3 py-1.5 bg-[#FAF9F6] border border-[#EAE6DF] text-[#86868B] text-xs font-medium rounded-xl flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    요청 보냄
                                  </span>
                                ) : isPendingReceived ? (
                                  <button
                                    onClick={() => handleRespondRequest(card.friendshipId!, 'accept')}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    요청 수락
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleSendFriendRequest(card.userId)}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                                  >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    친구 추가
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ---------------------------------------------------- */}
              {/* TAB 3: FRIEND REQUESTS (INCOMING & OUTGOING)         */}
              {/* ---------------------------------------------------- */}
              {activeTab === 'requests' && (
                <div className="space-y-6">
                  {/* Incoming Requests */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-[#1D1D1F] flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                      받은 친구 요청 ({incomingRequests.length}건)
                    </h3>

                    {incomingRequests.length === 0 ? (
                      <div className="p-8 bg-white border border-[#EAE6DF] rounded-2xl text-center text-xs text-[#86868B] shadow-2xs">
                        도착한 친구 요청이 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {incomingRequests.map(req => (
                          <div
                            key={req.id}
                            className="bg-white border border-[#EAE6DF] rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg border ${getAvatarInfo(req.profile.avatarUrl).bg}`}>
                                {getAvatarInfo(req.profile.avatarUrl).emoji}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-[#1D1D1F]">{req.profile.botName}</span>
                                  <span className="text-[10px] text-[#86868B] font-mono">@{req.profile.nickname}</span>
                                </div>
                                <p className="text-[11px] text-[#5C5B57] mt-0.5">
                                  "{req.profile.botName}"님이 친구 요청을 보냈습니다.
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleRespondRequest(req.id, 'accept')}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                              >
                                수락
                              </button>
                              <button
                                onClick={() => handleRespondRequest(req.id, 'reject')}
                                className="px-3 py-1.5 bg-[#FAF9F6] hover:bg-rose-50 border border-[#EAE6DF] hover:border-rose-200 text-[#5C5B57] hover:text-rose-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                              >
                                거절
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Outgoing Requests */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-[#1D1D1F] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#86868B]" />
                      내가 보낸 요청 ({outgoingRequests.length}건)
                    </h3>

                    {outgoingRequests.length === 0 ? (
                      <div className="p-6 bg-white border border-[#EAE6DF] rounded-2xl text-center text-xs text-[#86868B] shadow-2xs">
                        대기 중인 보낸 요청이 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {outgoingRequests.map(req => (
                          <div
                            key={req.id}
                            className="bg-white border border-[#EAE6DF] rounded-2xl p-3.5 shadow-2xs flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm border ${getAvatarInfo(req.profile.avatarUrl).bg}`}>
                                {getAvatarInfo(req.profile.avatarUrl).emoji}
                              </div>
                              <div>
                                <span className="text-xs font-bold text-[#1D1D1F]">{req.profile.botName}</span>
                                <span className="text-[10px] text-[#86868B] font-mono ml-1.5">@{req.profile.nickname}</span>
                              </div>
                            </div>
                            <span className="text-[11px] text-[#86868B] font-medium">상대방 수락 대기 중...</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Edit My Profile Modal                                           */}
          {/* ---------------------------------------------------------------- */}
          {showEditProfileModal && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white border border-[#EAE6DF] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
                <div className="flex items-center justify-between border-b border-[#EAE6DF] pb-3">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-bold text-[#1D1D1F]">내 소다봇 공개 프로필 설정</h3>
                  </div>
                  <button
                    onClick={() => setShowEditProfileModal(false)}
                    className="text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {/* Public Switch */}
                  <div className="p-3 bg-[#FAF9F6] border border-[#EAE6DF] rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#1D1D1F]">내 소다봇 공개</h4>
                      <p className="text-[10px] text-[#86868B]">
                        공개 ON 시 다른 친구들의 검색 결과에 표시됩니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditIsPublic(!editIsPublic)}
                      className={`w-12 h-6 rounded-full transition-colors p-1 cursor-pointer flex items-center ${
                        editIsPublic ? 'bg-indigo-600 justify-end' : 'bg-zinc-300 justify-start'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                    </button>
                  </div>

                  {/* Avatar Picker */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#1D1D1F]">소다봇 아바타 선택</label>
                    <div className="grid grid-cols-3 gap-2">
                      {AVATAR_OPTIONS.map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setEditAvatarUrl(opt.id)}
                          className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                            editAvatarUrl === opt.id
                              ? 'border-indigo-600 bg-indigo-50/50 shadow-2xs ring-2 ring-indigo-300'
                              : 'border-[#EAE6DF] hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="text-2xl mb-1">{opt.emoji}</div>
                          <div className="text-[10px] font-bold text-[#1D1D1F] truncate">{opt.name.split(' ')[0]}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bot Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1D1D1F]">소다봇 이름</label>
                    <input
                      type="text"
                      value={editBotName}
                      onChange={e => setEditBotName(e.target.value)}
                      maxLength={20}
                      placeholder="예: 루미, 보리, 코딩봇"
                      className="w-full bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Nickname */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1D1D1F]">닉네임</label>
                    <input
                      type="text"
                      value={editNickname}
                      onChange={e => setEditNickname(e.target.value)}
                      maxLength={20}
                      placeholder="예: minjun, 루미친구"
                      className="w-full bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1D1D1F]">한줄 소개</label>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={e => setEditDescription(e.target.value)}
                      maxLength={80}
                      placeholder="예: 코딩을 좋아하는 AI 친구야!"
                      className="w-full bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Privacy Notice */}
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[10px] text-blue-800 space-y-0.5">
                    <span className="font-bold">🔒 학생 정보 보호 안내:</span>
                    <p>실명, 학교명, 학년, 전화번호 등 상세 개인정보는 절대로 공개되지 않습니다.</p>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowEditProfileModal(false)}
                      className="px-4 py-2 bg-[#FAF9F6] hover:bg-gray-100 border border-[#EAE6DF] text-xs font-semibold text-[#5C5B57] rounded-xl transition-all cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      {savingProfile ? '저장 중...' : '저장하기'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
