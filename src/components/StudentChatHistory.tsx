import { useEffect, useState } from "react";
import type { ChatRoom, Message } from "../types";

type HistoryMessage = Message & { role?: string; content?: string };
type HistoryChat = Omit<ChatRoom, "messages"> & { messages: HistoryMessage[] };

export default function StudentChatHistory({ studentId, name, token, onClose }: {
  studentId: string;
  name: string;
  token: string | null;
  onClose: () => void;
}) {
  const [chats, setChats] = useState<HistoryChat[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setChats(null);
    setError("");
    async function load() {
      try {
        const response = await fetch(`/api/admin/users/${encodeURIComponent(studentId)}/chats`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        });
        if (!response.ok) throw new Error("대화 기록을 불러올 수 없습니다.");
        const records = await response.json();
        if (!controller.signal.aborted) setChats(records);
      } catch {
        if (!controller.signal.aborted) setError("대화 기록을 불러올 수 없습니다.");
      }
    }
    void load();
    return () => controller.abort();
  }, [studentId, token]);

  return (
    <section className="rounded-2xl border border-[#EAE6DF] bg-white p-4" aria-label={`${name} 학생 대화 기록`}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">{name} 대화 기록</h2>
        <button type="button" onClick={onClose} className="rounded-md bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
          목록으로 돌아가기
        </button>
      </header>
      {error ? <p role="alert" className="text-sm text-rose-600">{error}</p>
        : !chats ? <p role="status" className="text-sm text-gray-500">대화 기록을 불러오는 중…</p>
        : chats.length === 0 ? <p className="text-sm text-gray-500">대화 기록이 없습니다.</p>
        : (
          <ul className="divide-y divide-[#EAE6DF] rounded-lg border border-[#EAE6DF]">
            {chats.map(chat => (
              <li key={chat.id}>
                <details name={`student-chats-${studentId}`}>
                  <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs hover:bg-indigo-50">
                    <span aria-hidden="true" className="shrink-0 text-indigo-700">›</span>
                    <span className="min-w-0 flex-1 truncate font-semibold" title={chat.title}>{chat.title || "제목 없는 대화"}</span>
                    <span className="shrink-0 whitespace-nowrap text-gray-600">{chat.messages.length}개</span>
                    <time className="shrink-0 whitespace-nowrap text-gray-600" dateTime={chat.createdAt}>
                      {new Date(chat.createdAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                    </time>
                  </summary>
                  <div className="max-h-80 space-y-2 overflow-y-auto border-t border-[#EAE6DF] bg-[#FAF9F6] p-3 text-sm">
                    {chat.messages.length === 0 && <p className="text-gray-500">메시지가 없습니다.</p>}
                    {chat.messages.map(message => (
                      <div key={message.id} className="rounded-lg bg-white px-3 py-2">
                        <p className="text-xs font-semibold text-indigo-700">{message.sender === "user" || message.role === "user" ? "학생" : "소다봇"}</p>
                        <p className="whitespace-pre-wrap break-words">{message.text || message.content}</p>
                      </div>
                    ))}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
