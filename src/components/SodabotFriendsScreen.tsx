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
  VolumeX,
  Plus,
  UserCheck,
  LogOut,
  Settings,
  Layers,
  MessageCircle
} from 'lucide-react';
import {
  User,
  SodabotPublicProfile,
  FriendSummaryCard,
  DirectMessage,
  Friendship,
  GroupChatRoom,
  GroupChatMessage,
  GroupChatMember
} from '../types';
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
  const [activeTab, setActiveTab] = useState<'friends' | 'groups' | 'find' | 'requests'>('friends');
  
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

  // Group Chat Rooms
  const [groupRooms, setGroupRooms] = useState<GroupChatRoom[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupChatRoom | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupChatMessage[]>([]);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showInviteGroupModal, setShowInviteGroupModal] = useState(false);
  const [showGroupMembersModal, setShowGroupMembersModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedFriendsForGroup, setSelectedFriendsForGroup] = useState<string[]>([]);
  const [selectedFriendsForInvite, setSelectedFriendsForInvite] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [invitingMembers, setInvitingMembers] = useState(false);

  // Notifications
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [unreadDmTotal, setUnreadDmTotal] = useState(0);
  const [unreadGroupTotal, setUnreadGroupTotal] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Initial Load & Periodic Presence Ping
  useEffect(() => {
    if (!token) return;

    fetchMyProfile();
    fetchFriends();
    fetchGroupRooms();
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

    // Polling for real-time updates (friends, groups, requests, presence) every 3 seconds
    const pollInterval = setInterval(() => {
      fetchFriends(false);
      fetchGroupRooms(false);
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

  // 3. Poll Messages if in Group Chat
  useEffect(() => {
    if (!token || !selectedGroup) return;

    fetchGroupMessages(selectedGroup.id, true);

    const groupMsgInterval = setInterval(() => {
      fetchGroupMessages(selectedGroup.id, false);
    }, 2000);

    return () => clearInterval(groupMsgInterval);
  }, [token, selectedGroup?.id]);

  // Scroll to bottom of message thread
  useEffect(() => {
    if (selectedFriend || selectedGroup) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, groupMessages, selectedFriend, selectedGroup]);

  // ----------------------------------------------------
  // API Fetchers
  // ----------------------------------------------------
  const fetchMyProfile = async () => {
    try {
      const res = await fetch('/api/friends/my-profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const profileData = data.profile || data;
        setMyProfile(profileData);
        setEditIsPublic(Boolean(profileData.isPublic));
        setEditBotName(profileData.botName || '');
        setEditNickname(profileData.nickname || '');
        setEditDescription(profileData.description || '');
        setEditAvatarUrl(profileData.avatarUrl || 'robot-blue');
      }
    } catch (err) {
      console.error('Failed to fetch profile', err);
    }
  };

  const fetchFriends = async (showLoading = true) => {
    try {
      const res = await fetch('/api/friends/list', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list: FriendSummaryCard[] = Array.isArray(data) ? data : (data.friends || []);
        setFriends(list);
        if (selectedFriend) {
          const updated = list.find((f: FriendSummaryCard) => f.userId === selectedFriend.userId);
          if (updated) setSelectedFriend(updated);
        }
      }
    } catch (err) {
      console.error('Failed to fetch friends', err);
    }
  };

  const fetchGroupRooms = async (showLoading = true) => {
    try {
      const res = await fetch('/api/friends/groups', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list: GroupChatRoom[] = Array.isArray(data) ? data : (data.groups || []);
        setGroupRooms(list);
        if (selectedGroup) {
          const updated = list.find((g: GroupChatRoom) => g.id === selectedGroup.id);
          if (updated) setSelectedGroup(updated);
        }
      }
    } catch (err) {
      console.error('Failed to fetch group rooms', err);
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
        setUnreadDmTotal(data.unreadDmCount || 0);
        setUnreadGroupTotal(data.unreadGroupCount || 0);
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
        if (scrollToBottom) {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      }
    } catch (err) {
      console.error('Failed to fetch messages', err);
    }
  };

  const fetchGroupMessages = async (roomId: string, scrollToBottom = false) => {
    try {
      const res = await fetch(`/api/friends/groups/${roomId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGroupMessages(data.messages || []);
        if (data.room) {
          setSelectedGroup(prev => prev ? { ...prev, ...data.room, members: data.members } : data.room);
        }
        if (scrollToBottom) {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      }
    } catch (err) {
      console.error('Failed to fetch group messages', err);
    }
  };

  // ----------------------------------------------------
  // Actions: Profile & Friends
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
        setMyProfile(data.profile || data);
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
        setMyProfile(data.profile || data);
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
    if (!confirm('이 친구를 친구 목록에서 삭제하시겠습니까?')) return;
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
        setSelectedFriend(null);
        fetchFriends();
      }
    } catch (err) {
      console.error('Failed to delete friend', err);
    }
  };

  // ----------------------------------------------------
  // Actions: 1:1 Messages
  // ----------------------------------------------------
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedFriend || sendingDm) return;

    const content = inputMessage.trim();
    setInputMessage('');
    setSendingDm(true);

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
        await fetchMessages(selectedFriend.userId, true);
        fetchFriends(false);
      }
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setSendingDm(false);
    }
  };

  const handlePlayOnSodabot = async (message: DirectMessage) => {
    setPlayingMsgId(message.id);
    setPlayStatusMessage('소다봇으로 메시지 전송 중...');

    try {
      const res = await fetch(`/api/friends/messages/${message.id}/play-sodabot`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const textToSpeak = data.speechText || `${selectedFriend?.botName || '친구'}의 메시지: ${message.content}`;

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

  // ----------------------------------------------------
  // Actions: Group Chat Rooms
  // ----------------------------------------------------
  const handleCreateGroupRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || creatingGroup) return;

    setCreatingGroup(true);
    try {
      const res = await fetch('/api/friends/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newGroupName.trim(),
          memberIds: selectedFriendsForGroup
        })
      });
      if (res.ok) {
        const data = await res.json();
        setNewGroupName('');
        setSelectedFriendsForGroup([]);
        setShowCreateGroupModal(false);
        await fetchGroupRooms();
        if (data.room) {
          setSelectedGroup(data.room);
          setSelectedFriend(null);
        }
      }
    } catch (err) {
      console.error('Failed to create group room', err);
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleSendGroupMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedGroup || sendingDm) return;

    const content = inputMessage.trim();
    setInputMessage('');
    setSendingDm(true);

    try {
      const res = await fetch(`/api/friends/groups/${selectedGroup.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content })
      });
      if (res.ok) {
        await fetchGroupMessages(selectedGroup.id, true);
        fetchGroupRooms(false);
      }
    } catch (err) {
      console.error('Failed to send group message', err);
    } finally {
      setSendingDm(false);
    }
  };

  const handleInviteToGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || selectedFriendsForInvite.length === 0 || invitingMembers) return;

    setInvitingMembers(true);
    try {
      const res = await fetch(`/api/friends/groups/${selectedGroup.id}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          memberIds: selectedFriendsForInvite
        })
      });
      if (res.ok) {
        setSelectedFriendsForInvite([]);
        setShowInviteGroupModal(false);
        fetchGroupMessages(selectedGroup.id, true);
        fetchGroupRooms();
      }
    } catch (err) {
      console.error('Failed to invite members', err);
    } finally {
      setInvitingMembers(false);
    }
  };

  const handleLeaveGroup = async (roomId: string) => {
    if (!confirm('이 그룹 대화방을 나가시겠습니까?')) return;
    try {
      const res = await fetch(`/api/friends/groups/${roomId}/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedGroup(null);
        fetchGroupRooms();
        fetchNotifications();
      }
    } catch (err) {
      console.error('Failed to leave group', err);
    }
  };

  const handlePlayGroupOnSodabot = async (message: GroupChatMessage) => {
    setPlayingMsgId(message.id);
    setPlayStatusMessage('소다봇으로 그룹 메시지 전송 중...');

    try {
      const res = await fetch(`/api/friends/groups/messages/${message.id}/play-sodabot`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const textToSpeak = data.speechText || `${message.senderName}의 그룹 메시지: ${message.content}`;

      if (isSodabotConnected) {
        try {
          await sodabotTransport.send('speak', textToSpeak);
          setPlayStatusMessage('🔊 실물 소다봇에서 음성을 재생했습니다!');
        } catch (transportErr) {
          console.warn('sodabotTransport speak error:', transportErr);
          setPlayStatusMessage('소다봇 전송 실패 (기기 연결 상태를 확인하세요)');
        }
      } else {
        setPlayStatusMessage('소다봇이 연결되어 있지 않습니다.');
      }
    } catch (err) {
      console.error('Failed to play group message on sodabot', err);
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
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#FAF9F6]">
      
      {/* ================================================================ */}
      {/* 1. Direct Message Chat View (1:1 with a Friend)                 */}
      {/* ================================================================ */}
      {selectedFriend ? (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
          
          {/* Chat Header */}
          <header className="p-4 sm:p-5 bg-white border-b border-[#EAE6DF] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedFriend(null)}
                className="p-2 hover:bg-[#FAF9F6] rounded-xl text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
                title="친구 목록으로 돌아가기"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="relative">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg border ${getAvatarInfo(selectedFriend.avatarUrl).bg}`}>
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
      ) : selectedGroup ? (

        /* ================================================================ */
        /* 2. Group Chat Room View (다자간 그룹 대화방)                     */
        /* ================================================================ */
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
          
          {/* Group Header */}
          <header className="p-4 sm:p-5 bg-white border-b border-[#EAE6DF] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedGroup(null)}
                className="p-2 hover:bg-[#FAF9F6] rounded-xl text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
                title="그룹 목록으로 돌아가기"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 font-bold">
                <Users className="w-5 h-5" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#1D1D1F]">{selectedGroup.name}</h3>
                  <button
                    onClick={() => setShowGroupMembersModal(true)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FAF9F6] hover:bg-gray-100 border border-[#EAE6DF] text-xs font-bold text-[#5C5B57] rounded-full transition-colors cursor-pointer"
                  >
                    <span>👥 {selectedGroup.memberIds.length}명</span>
                  </button>
                </div>
                <p className="text-[11px] text-[#86868B]">
                  멤버들과 함께 소다봇 이야기를 나눠보세요!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedFriendsForInvite([]);
                  setShowInviteGroupModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-indigo-200 shadow-2xs"
                title="친구 초대하기"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">친구 초대</span>
              </button>

              <button
                onClick={() => handleLeaveGroup(selectedGroup.id)}
                className="p-2 text-[#86868B] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                title="그룹 대화방 나가기"
              >
                <LogOut className="w-4 h-4" />
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

          {/* Group Messages Timeline */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#FAF9F6]/60 relative">
            <div className="max-w-2xl mx-auto space-y-4">
              
              {/* Privacy / Safety Notice */}
              <div className="p-3 bg-white border border-[#EAE6DF] rounded-2xl text-center space-y-1 shadow-2xs max-w-md mx-auto my-2">
                <p className="text-xs font-bold text-[#1D1D1F] flex items-center justify-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  안전한 소다봇 그룹 대화방
                </p>
                <p className="text-[10px] text-[#86868B]">
                  참여한 친구들끼리 실시간으로 대화하며 소다봇으로 음성을 재생할 수 있습니다.
                </p>
              </div>

              {groupMessages.map(msg => {
                if (msg.senderId === 'system') {
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <span className="px-3 py-1 bg-white border border-[#EAE6DF] text-[#86868B] text-[10px] rounded-full shadow-2xs">
                        📢 {msg.content}
                      </span>
                    </div>
                  );
                }

                const isMine = msg.senderId === currentUser.id;
                const isPlaying = playingMsgId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} space-y-1`}
                  >
                    {!isMine && (
                      <span className="text-[10px] font-bold text-[#5C5B57] px-1">
                        {msg.senderName}
                      </span>
                    )}

                    <div className="flex items-end gap-2 max-w-[80%]">
                      {!isMine && (
                        <div className={`w-7 h-7 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold border ${getAvatarInfo(msg.senderAvatar).bg}`}>
                          {getAvatarInfo(msg.senderAvatar).emoji}
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

                        {!isMine && (
                          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => handlePlayGroupOnSodabot(msg)}
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

                    {isMine && (
                      <div className="flex items-center gap-1.5 text-[9px] text-[#86868B] font-mono px-1">
                        <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Bottom Group Input Area */}
          <footer className="p-4 bg-white border-t border-[#EAE6DF]">
            <form onSubmit={handleSendGroupMessage} className="max-w-2xl mx-auto flex items-center gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                placeholder={`${selectedGroup.name}에 메시지 전송...`}
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

        /* ================================================================ */
        /* 3. Main Friends Hub Screen (Tabs: Friends / Groups / Find / Req) */
        /* ================================================================ */
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAF9F6]">
          
          {/* Header & My Profile Card */}
          <header className="px-6 py-4 bg-white border-b border-[#EAE6DF] shrink-0 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <h1 className="text-lg font-bold text-[#1D1D1F] tracking-tight">
                  소다봇 친구 & 메시지
                </h1>
              </div>

              {/* My Profile Mini Card with Sleek Toggle Switch */}
              {myProfile && (
                <div className="flex items-center gap-3 bg-[#FAF9F6] border border-[#EAE6DF] hover:border-indigo-200 px-3 py-2 rounded-2xl shadow-2xs transition-all">
                  {/* Clickable Avatar to Open Profile Modal */}
                  <button
                    onClick={() => setShowEditProfileModal(true)}
                    className="relative cursor-pointer group"
                    title="프로필 및 아바타 수정"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base border transition-transform group-hover:scale-105 shadow-2xs ${getAvatarInfo(myProfile.avatarUrl).bg}`}>
                      {getAvatarInfo(myProfile.avatarUrl).emoji}
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full shadow-2xs">
                      <Settings className="w-2.5 h-2.5 text-indigo-600" />
                    </div>
                  </button>

                  {/* Profile Info */}
                  <div className="text-left pr-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#1D1D1F]">{myProfile.botName}</span>
                      <span className="text-[10px] text-[#86868B] font-mono">@{myProfile.nickname}</span>
                    </div>

                    {/* Sleek Toggle Switch */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-semibold text-[#5C5B57] flex items-center gap-1">
                        {myProfile.isPublic ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            공개
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">비공개</span>
                        )}
                      </span>

                      {/* iOS-Style Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => handleTogglePublic(!myProfile.isPublic)}
                        className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                          myProfile.isPublic
                            ? 'bg-emerald-500 shadow-2xs'
                            : 'bg-slate-300'
                        }`}
                        title={myProfile.isPublic ? "클릭 시 비공개로 전환" : "클릭 시 친구 검색에 공개"}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform duration-200 ${
                            myProfile.isPublic ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Sub-Tabs */}
            <div className="flex items-center gap-2 border-b border-[#EAE6DF] pt-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab('friends')}
                className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer shrink-0 ${
                  activeTab === 'friends'
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-[#86868B] hover:text-[#1D1D1F]'
                }`}
              >
                1:1 친구 ({friends.length})
                {unreadDmTotal > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 bg-rose-500 text-white text-[9px] font-bold rounded-full animate-pulse">
                    {unreadDmTotal}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('groups')}
                className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer shrink-0 ${
                  activeTab === 'groups'
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-[#86868B] hover:text-[#1D1D1F]'
                }`}
              >
                그룹 대화방 ({groupRooms.length})
                {unreadGroupTotal > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 bg-rose-500 text-white text-[9px] font-bold rounded-full animate-pulse">
                    {unreadGroupTotal}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveTab('find');
                  if (searchResults.length === 0) handleSearch('');
                }}
                className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer shrink-0 ${
                  activeTab === 'find'
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-[#86868B] hover:text-[#1D1D1F]'
                }`}
              >
                친구 찾기 🔍
              </button>

              <button
                onClick={() => setActiveTab('requests')}
                className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer shrink-0 ${
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
              {/* TAB 1: 1:1 FRIENDS LIST                              */}
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

                          <button
                            onClick={() => {
                              setSelectedFriend(friend);
                              setSelectedGroup(null);
                            }}
                            className="p-2.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-xl transition-all cursor-pointer shadow-2xs group-hover:scale-105 shrink-0"
                            title="1:1 메시지 보내기"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ---------------------------------------------------- */}
              {/* TAB 2: GROUP CHAT ROOMS                              */}
              {/* ---------------------------------------------------- */}
              {activeTab === 'groups' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-[#1D1D1F] tracking-tight">
                        그룹 대화방 ({groupRooms.length}개)
                      </h3>
                      <p className="text-[11px] text-[#86868B]">
                        친구들을 모아 함께 이야기하고 소다봇으로 공유해 보세요.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedFriendsForGroup([]);
                        setNewGroupName('');
                        setShowCreateGroupModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      새 그룹방 만들기
                    </button>
                  </div>

                  {groupRooms.length === 0 ? (
                    <div className="p-12 bg-white border border-[#EAE6DF] rounded-3xl text-center space-y-3 shadow-2xs">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mx-auto shadow-2xs">
                        <Users className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-[#1D1D1F]">참여 중인 그룹 대화방이 없어요</h4>
                      <p className="text-xs text-[#86868B] max-w-sm mx-auto">
                        여러 친구들을 초대하여 함께 이야기할 수 있는 그룹 대화방을 만들어 보세요!
                      </p>
                      <button
                        onClick={() => {
                          setSelectedFriendsForGroup([]);
                          setNewGroupName('');
                          setShowCreateGroupModal(true);
                        }}
                        className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        그룹 대화방 만들기
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {groupRooms.map(room => (
                        <div
                          key={room.id}
                          className="bg-white border border-[#EAE6DF] hover:border-indigo-300 rounded-2xl p-4 shadow-2xs hover:shadow-sm transition-all flex items-center justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                              <Users className="w-5 h-5" />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-bold text-[#1D1D1F] truncate">{room.name}</h4>
                                <span className="px-1.5 py-0.2 bg-gray-100 text-[#5C5B57] text-[9px] font-bold rounded-full font-mono">
                                  {room.memberIds.length}명
                                </span>
                              </div>
                              
                              <p className="text-[11px] text-[#5C5B57] truncate mt-0.5">
                                {room.lastMessage ? (
                                  <span>{room.lastMessage.senderName}: {room.lastMessage.content}</span>
                                ) : (
                                  '새 대화방이 생성되었습니다.'
                                )}
                              </p>

                              <div className="flex items-center gap-2 mt-1">
                                {room.unreadCount && room.unreadCount > 0 ? (
                                  <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[9px] font-bold rounded-full animate-bounce">
                                    새 메시지 {room.unreadCount}개
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-[#86868B] font-mono">
                                    {formatTimeAgo(room.createdAt)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedGroup(room);
                              setSelectedFriend(null);
                            }}
                            className="p-2.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-xl transition-all cursor-pointer shadow-2xs group-hover:scale-105 shrink-0"
                            title="그룹방 입장"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ---------------------------------------------------- */}
              {/* TAB 3: FIND NEW FRIENDS                              */}
              {/* ---------------------------------------------------- */}
              {activeTab === 'find' && (
                <div className="space-y-4">
                  {/* Search Bar */}
                  <div className="flex items-center gap-2 bg-white border border-[#EAE6DF] focus-within:border-indigo-500 rounded-2xl p-2 shadow-2xs">
                    <Search className="w-4 h-4 text-[#86868B] ml-2 shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => {
                        setSearchQuery(e.target.value);
                        handleSearch(e.target.value);
                      }}
                      placeholder="소다봇 이름 또는 닉네임으로 검색..."
                      className="flex-1 bg-transparent text-xs text-[#1D1D1F] outline-none placeholder:text-[#86868B]"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          handleSearch('');
                        }}
                        className="p-1 text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Search Results */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-[#1D1D1F] tracking-tight">
                      공개된 소다봇 탐색 ({searchResults.length}개)
                    </h4>

                    {searching ? (
                      <div className="p-8 text-center text-xs text-[#86868B]">
                        검색 중...
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-8 bg-white border border-[#EAE6DF] rounded-2xl text-center text-xs text-[#86868B] space-y-2">
                        <Bot className="w-8 h-8 text-[#86868B] mx-auto opacity-50" />
                        <p>검색 조건에 맞는 공개 소다봇이 없습니다.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {searchResults.map(bot => (
                          <div
                            key={bot.userId}
                            className="bg-white border border-[#EAE6DF] rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative shrink-0">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg border ${getAvatarInfo(bot.avatarUrl).bg}`}>
                                  {getAvatarInfo(bot.avatarUrl).emoji}
                                </div>
                                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                                  bot.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-300'
                                }`} />
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-xs font-bold text-[#1D1D1F] truncate">{bot.botName}</h4>
                                  <span className="text-[10px] text-[#86868B] font-mono truncate">@{bot.nickname}</span>
                                </div>
                                <p className="text-[11px] text-[#86868B] truncate mt-0.5">
                                  {bot.description || '소다봇 친구'}
                                </p>
                              </div>
                            </div>

                            {/* Request Button Status */}
                            <div>
                              {bot.friendshipStatus === 'accepted' ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl">
                                  <Check className="w-3.5 h-3.5" />
                                  친구
                                </span>
                              ) : bot.friendshipStatus === 'pending_sent' ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-xl">
                                  <Clock className="w-3.5 h-3.5" />
                                  요청 중
                                </span>
                              ) : bot.friendshipStatus === 'pending_received' ? (
                                <button
                                  onClick={() => setActiveTab('requests')}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer"
                                >
                                  요청 확인
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSendFriendRequest(bot.userId)}
                                  className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  친구 신청
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ---------------------------------------------------- */}
              {/* TAB 4: FRIEND REQUESTS                               */}
              {/* ---------------------------------------------------- */}
              {activeTab === 'requests' && (
                <div className="space-y-6">
                  {/* Incoming Requests */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-[#1D1D1F] tracking-tight flex items-center gap-1.5">
                      <span>받은 친구 요청</span>
                      {incomingRequests.length > 0 && (
                        <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[9px] font-bold rounded-full">
                          {incomingRequests.length}
                        </span>
                      )}
                    </h3>

                    {incomingRequests.length === 0 ? (
                      <div className="p-6 bg-white border border-[#EAE6DF] rounded-2xl text-center text-xs text-[#86868B]">
                        받은 친구 요청이 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {incomingRequests.map(req => (
                          <div
                            key={req.id}
                            className="bg-white border border-[#EAE6DF] rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg border ${getAvatarInfo(req.profile?.avatarUrl).bg}`}>
                                {getAvatarInfo(req.profile?.avatarUrl).emoji}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-xs font-bold text-[#1D1D1F] truncate">{req.profile?.botName || req.senderName}</h4>
                                  <span className="text-[10px] text-[#86868B] font-mono truncate">@{req.profile?.nickname}</span>
                                </div>
                                <p className="text-[11px] text-[#86868B] truncate mt-0.5">
                                  {req.profile?.description || '친구 요청이 도착했습니다.'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleRespondRequest(req.id, 'reject')}
                                className="px-3 py-1.5 bg-[#FAF9F6] hover:bg-gray-100 text-[#5C5B57] text-xs font-bold rounded-xl border border-[#EAE6DF] transition-colors cursor-pointer"
                              >
                                거절
                              </button>
                              <button
                                onClick={() => handleRespondRequest(req.id, 'accept')}
                                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer active:scale-95"
                              >
                                수락
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Outgoing Requests */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-[#1D1D1F] tracking-tight">
                      보낸 친구 요청 ({outgoingRequests.length})
                    </h3>

                    {outgoingRequests.length === 0 ? (
                      <div className="p-6 bg-white border border-[#EAE6DF] rounded-2xl text-center text-xs text-[#86868B]">
                        보낸 친구 요청이 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {outgoingRequests.map(req => (
                          <div
                            key={req.id}
                            className="bg-white border border-[#EAE6DF] rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg border ${getAvatarInfo(req.profile?.avatarUrl).bg}`}>
                                {getAvatarInfo(req.profile?.avatarUrl).emoji}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-xs font-bold text-[#1D1D1F] truncate">{req.profile?.botName || req.receiverName}</h4>
                                  <span className="text-[10px] text-[#86868B] font-mono truncate">@{req.profile?.nickname}</span>
                                </div>
                                <span className="text-[10px] text-amber-600 font-medium">수락 대기 중...</span>
                              </div>
                            </div>

                            <span className="text-xs text-[#86868B] font-mono">
                              {new Date(req.createdAt).toLocaleDateString()}
                            </span>
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
          {/* Modal: Create New Group Room                                     */}
          {/* ---------------------------------------------------------------- */}
          {showCreateGroupModal && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white border border-[#EAE6DF] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-fade-in max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-[#EAE6DF] pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-bold text-[#1D1D1F]">새 그룹 대화방 만들기</h3>
                  </div>
                  <button
                    onClick={() => setShowCreateGroupModal(false)}
                    className="p-1.5 text-[#86868B] hover:text-[#1D1D1F] rounded-xl cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateGroupRoom} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1D1D1F]">대화방 이름</label>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      maxLength={30}
                      placeholder="예: 로봇 코딩 스터디반, 3분임 모임"
                      required
                      className="w-full bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#1D1D1F]">함께할 친구 초대 ({selectedFriendsForGroup.length}명 선택)</label>
                    
                    {friends.length === 0 ? (
                      <p className="text-xs text-[#86868B] py-3 text-center bg-[#FAF9F6] rounded-xl">
                        초대할 수 있는 등록된 친구가 없습니다. 먼저 친구를 추가해 주세요.
                      </p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-1.5 border border-[#EAE6DF] rounded-xl p-2 bg-[#FAF9F6]">
                        {friends.map(f => {
                          const isSelected = selectedFriendsForGroup.includes(f.userId);
                          return (
                            <label
                              key={f.userId}
                              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                                isSelected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-white'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs border ${getAvatarInfo(f.avatarUrl).bg}`}>
                                  {getAvatarInfo(f.avatarUrl).emoji}
                                </div>
                                <span className="text-xs font-bold text-[#1D1D1F]">{f.botName}</span>
                                <span className="text-[10px] text-[#86868B]">@{f.nickname}</span>
                              </div>

                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedFriendsForGroup(prev => [...prev, f.userId]);
                                  } else {
                                    setSelectedFriendsForGroup(prev => prev.filter(id => id !== f.userId));
                                  }
                                }}
                                className="w-4 h-4 text-indigo-600 rounded"
                              />
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateGroupModal(false)}
                      className="px-4 py-2 bg-[#FAF9F6] hover:bg-gray-100 border border-[#EAE6DF] text-xs font-semibold text-[#5C5B57] rounded-xl cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={!newGroupName.trim() || creatingGroup}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {creatingGroup ? '생성 중...' : '그룹방 만들기'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Modal: Invite Members to Existing Group                          */}
          {/* ---------------------------------------------------------------- */}
          {showInviteGroupModal && selectedGroup && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white border border-[#EAE6DF] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-fade-in max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-[#EAE6DF] pb-3">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-bold text-[#1D1D1F]">친구 초대하기</h3>
                  </div>
                  <button
                    onClick={() => setShowInviteGroupModal(false)}
                    className="p-1.5 text-[#86868B] hover:text-[#1D1D1F] rounded-xl cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleInviteToGroup} className="space-y-4">
                  <p className="text-xs text-[#86868B]">
                    '{selectedGroup.name}' 대화방에 초대할 친구를 선택하세요.
                  </p>

                  {friends.filter(f => !selectedGroup.memberIds.includes(f.userId)).length === 0 ? (
                    <p className="text-xs text-[#86868B] py-4 text-center bg-[#FAF9F6] rounded-xl">
                      이미 모든 친구가 이 대화방에 참여 중이거나 초대 가능한 친구가 없습니다.
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 border border-[#EAE6DF] rounded-xl p-2 bg-[#FAF9F6]">
                      {friends.filter(f => !selectedGroup.memberIds.includes(f.userId)).map(f => {
                        const isSelected = selectedFriendsForInvite.includes(f.userId);
                        return (
                          <label
                            key={f.userId}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                              isSelected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs border ${getAvatarInfo(f.avatarUrl).bg}`}>
                                {getAvatarInfo(f.avatarUrl).emoji}
                              </div>
                              <span className="text-xs font-bold text-[#1D1D1F]">{f.botName}</span>
                              <span className="text-[10px] text-[#86868B]">@{f.nickname}</span>
                            </div>

                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedFriendsForInvite(prev => [...prev, f.userId]);
                                } else {
                                  setSelectedFriendsForInvite(prev => prev.filter(id => id !== f.userId));
                                }
                              }}
                              className="w-4 h-4 text-indigo-600 rounded"
                            />
                          </label>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowInviteGroupModal(false)}
                      className="px-4 py-2 bg-[#FAF9F6] hover:bg-gray-100 border border-[#EAE6DF] text-xs font-semibold text-[#5C5B57] rounded-xl cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={selectedFriendsForInvite.length === 0 || invitingMembers}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {invitingMembers ? '초대 중...' : '초대 완료'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Modal: View Group Members                                        */}
          {/* ---------------------------------------------------------------- */}
          {showGroupMembersModal && selectedGroup && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white border border-[#EAE6DF] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-fade-in max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-[#EAE6DF] pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-bold text-[#1D1D1F]">대화방 멤버 ({selectedGroup.members?.length || selectedGroup.memberIds.length}명)</h3>
                  </div>
                  <button
                    onClick={() => setShowGroupMembersModal(false)}
                    className="p-1.5 text-[#86868B] hover:text-[#1D1D1F] rounded-xl cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  {(selectedGroup.members || []).map(m => (
                    <div
                      key={m.userId}
                      className="flex items-center justify-between p-2.5 bg-[#FAF9F6] border border-[#EAE6DF] rounded-2xl"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm border ${getAvatarInfo(m.avatarUrl).bg}`}>
                            {getAvatarInfo(m.avatarUrl).emoji}
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                            m.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-300'
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-[#1D1D1F]">{m.botName}</span>
                            <span className="text-[10px] text-[#86868B]">@{m.nickname}</span>
                          </div>
                          {m.userId === currentUser.id && (
                            <span className="text-[9px] text-indigo-600 font-bold">나 (본인)</span>
                          )}
                        </div>
                      </div>

                      {m.role === 'creator' && (
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full">
                          방장 👑
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShowGroupMembersModal(false)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Modal: Edit My Profile                                           */}
          {/* ---------------------------------------------------------------- */}
          {showEditProfileModal && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white border border-[#EAE6DF] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-fade-in max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-[#EAE6DF] pb-3">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-bold text-[#1D1D1F]">내 소다봇 공개 프로필 설정</h3>
                  </div>
                  <button
                    onClick={() => setShowEditProfileModal(false)}
                    className="p-1.5 text-[#86868B] hover:text-[#1D1D1F] rounded-xl cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {/* Public Switch */}
                  <div className="flex items-center justify-between p-3 bg-[#FAF9F6] border border-[#EAE6DF] rounded-2xl">
                    <div>
                      <span className="text-xs font-bold text-[#1D1D1F] flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-indigo-600" />
                        소다봇 공개 설정
                      </span>
                      <p className="text-[10px] text-[#86868B]">다른 친구들이 내 소다봇을 검색하고 친구 신청할 수 있습니다.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditIsPublic(!editIsPublic)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                        editIsPublic ? 'bg-indigo-600 justify-end' : 'bg-gray-300 justify-start'
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
