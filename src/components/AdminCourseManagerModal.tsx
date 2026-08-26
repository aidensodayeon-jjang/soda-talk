import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  X,
  Check,
  Code,
  FileCode,
  FolderCode,
  Cpu,
  Layers,
  Save,
  AlertCircle,
  Eye
} from "lucide-react";
import { CourseContent } from "../types";

interface Props {
  token: string | null;
  onClose: () => void;
  onContentsUpdated?: () => void;
}

export default function AdminCourseManagerModal({ token, onClose, onContentsUpdated }: Props) {
  const [contents, setContents] = useState<CourseContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Editing / Creating State
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Form Fields
  const [week, setWeek] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [filename, setFilename] = useState("");
  const [language, setLanguage] = useState<"arduino" | "python" | "cpp" | "json">("arduino");
  const [tags, setTags] = useState("");
  const [pinMap, setPinMap] = useState("");
  const [code, setCode] = useState("");

  // Preview Mode
  const [previewContent, setPreviewContent] = useState<CourseContent | null>(null);

  useEffect(() => {
    fetchContents();
  }, []);

  const fetchContents = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/course-contents");
      const data = await res.json();
      if (res.ok && data.contents) {
        setContents(data.contents);
      } else {
        setError(data.error || "컨텐츠를 불러오지 못했습니다.");
      }
    } catch (err) {
      setError("서버 통신 실패");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setSelectedId(null);
    setWeek(contents.length > 0 ? Math.max(...contents.map(c => c.week)) + 1 : 1);
    setTitle("");
    setDescription("");
    setFilename(`sodabot_week${contents.length + 1}_code.ino`);
    setLanguage("arduino");
    setTags("ESP32, Arduino, 실습");
    setPinMap("");
    setCode(`// 주차별 소다봇 실습 코드
#include <Arduino.h>

void setup() {
  Serial.begin(115200);
  Serial.println("소다봇 준비 완료!");
}

void loop() {
  delay(1000);
}
`);
    setIsEditing(true);
    setPreviewContent(null);
  };

  const handleOpenEdit = (item: CourseContent) => {
    setSelectedId(item.id);
    setWeek(item.week);
    setTitle(item.title);
    setDescription(item.description);
    setFilename(item.filename);
    setLanguage(item.language);
    setTags(Array.isArray(item.tags) ? item.tags.join(", ") : "");
    setPinMap(item.pinMap || "");
    setCode(item.code);
    setIsEditing(true);
    setPreviewContent(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!title.trim() || !code.trim()) {
      setError("제목과 소스코드는 필수 항목입니다.");
      return;
    }

    const payload = {
      week: Number(week),
      title: title.trim(),
      description: description.trim(),
      filename: filename.trim() || `sodabot_week${week}_code.ino`,
      language,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      pinMap: pinMap.trim() || undefined,
      code
    };

    try {
      const url = selectedId ? `/api/admin/course-contents/${selectedId}` : "/api/admin/course-contents";
      const method = selectedId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(selectedId ? "컨텐츠가 수정되었습니다!" : "신규 컨텐츠가 등록되었습니다!");
        setIsEditing(false);
        fetchContents();
        if (onContentsUpdated) onContentsUpdated();
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        setError(data.error || "저장에 실패했습니다.");
      }
    } catch (err) {
      setError("네트워크 오류 발생");
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`정말 "${title}" 컨텐츠를 삭제하시겠습니까?`)) return;
    setError("");
    try {
      const res = await fetch(`/api/admin/course-contents/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSuccessMsg("컨텐츠가 삭제되었습니다.");
        fetchContents();
        if (onContentsUpdated) onContentsUpdated();
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        setError("삭제 실패");
      }
    } catch (err) {
      setError("네트워크 오류 발생");
    }
  };

  const handleResetDefault = async () => {
    if (!window.confirm("모든 컨텐츠를 기본 1~6주차 실습 코드로 초기화하시겠습니까? (기존 수정본은 덮어쓰여집니다)")) return;
    try {
      const res = await fetch("/api/admin/course-contents/reset-default", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSuccessMsg("기본 컨텐츠로 복원되었습니다.");
        fetchContents();
        if (onContentsUpdated) onContentsUpdated();
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      setError("복원 실패");
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1D1D1F]/50 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in p-4 select-none">
      <div className="bg-white border border-[#EAE6DF] rounded-3xl w-full max-w-5xl shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#FAF9F6] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
              <FolderCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1D1D1F] flex items-center gap-2">
                주차별 수업 & 실습 코드 컨텐츠 관리
                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded-full font-mono">
                  Admin LMS
                </span>
              </h3>
              <p className="text-xs text-[#86868B]">
                학생용 자료실에 노출되는 주차별 실습 코드, 배선 핀맵 및 다운로드 파일을 직접 등록/수정/삭제합니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                <button
                  onClick={handleOpenCreate}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  신규 실습 코드 등록
                </button>
                <button
                  onClick={handleResetDefault}
                  className="px-3 py-1.5 bg-[#FAF9F6] hover:bg-gray-100 border border-[#EAE6DF] text-[#5C5B57] rounded-xl text-xs font-medium transition-all flex items-center gap-1 cursor-pointer"
                  title="기본 1~6주차 코드로 복원"
                >
                  <RotateCcw className="w-3 h-3" />
                  기본값 복원
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="text-xs text-[#86868B] hover:text-[#1D1D1F] bg-[#FAF9F6] hover:bg-[#EAE6DF]/60 px-3 py-1.5 rounded-full font-semibold transition-colors cursor-pointer"
            >
              닫기 ✕
            </button>
          </div>
        </div>

        {/* Alert Notifications */}
        {error && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2 shrink-0">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 scrollbar-thin">
          {isEditing ? (
            /* Editing / Creating Form */
            <form onSubmit={handleSave} className="space-y-4 bg-[#FAF9F6] p-5 rounded-2xl border border-[#EAE6DF]">
              <div className="flex items-center justify-between pb-2 border-b border-[#EAE6DF]">
                <h4 className="text-xs font-bold text-[#1D1D1F] flex items-center gap-1.5">
                  <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                  {selectedId ? "실습 컨텐츠 수정" : "신규 실습 컨텐츠 작성"}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-[#86868B] hover:text-[#1D1D1F] font-medium"
                >
                  작성 취소
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#5C5B57]">수업 주차 (Week)</label>
                  <select
                    value={week}
                    onChange={e => setWeek(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#EAE6DF] rounded-xl focus:outline-none focus:border-indigo-400 font-bold"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(w => (
                      <option key={w} value={w}>{w}주차 실습</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-[11px] font-semibold text-[#5C5B57]">실습 제목</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="예: 1주차 소다봇 하드웨어 기본 및 LED 제어"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#EAE6DF] rounded-xl focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#5C5B57]">파일명 (다운로드용)</label>
                  <input
                    type="text"
                    required
                    value={filename}
                    onChange={e => setFilename(e.target.value)}
                    placeholder="sodabot_week1_basic.ino"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#EAE6DF] rounded-xl focus:outline-none focus:border-indigo-400 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#5C5B57]">개발 언어</label>
                  <select
                    value={language}
                    onChange={e => setLanguage(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#EAE6DF] rounded-xl focus:outline-none focus:border-indigo-400 font-medium"
                  >
                    <option value="arduino">Arduino (.ino)</option>
                    <option value="python">Python (.py)</option>
                    <option value="cpp">C++ (.cpp)</option>
                    <option value="json">JSON / 설정</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#5C5B57]">태그 (쉼표로 구분)</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    placeholder="ESP32, BLE, 서보모터"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#EAE6DF] rounded-xl focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#5C5B57]">실습 설명 요약</label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="ESP32 보드에서 RGB LED와 서보모터를 제어하는 실습 펌웨어입니다."
                    className="w-full px-3 py-2 text-xs bg-white border border-[#EAE6DF] rounded-xl focus:outline-none focus:border-indigo-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#5C5B57]">하드웨어 핀맵 배선 정보 (선택)</label>
                  <input
                    type="text"
                    value={pinMap}
                    onChange={e => setPinMap(e.target.value)}
                    placeholder="RGB LED: D4, 서보모터: D18, 부저: D19"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#EAE6DF] rounded-xl focus:outline-none focus:border-indigo-400 font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Code Editor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-[#5C5B57] flex items-center gap-1">
                    <Code className="w-3.5 h-3.5 text-indigo-600" />
                    소스코드 본문 (학생들에게 배포될 코드)
                  </label>
                  <span className="text-[10px] text-[#86868B] font-mono">
                    {code.split("\n").length} 줄
                  </span>
                </div>

                <div className="border border-[#313244] rounded-2xl overflow-hidden shadow-inner bg-[#1E1E2E]">
                  <div className="bg-[#181825] px-4 py-2 border-b border-[#313244] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-400/80"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80"></div>
                      <span className="ml-2 font-mono text-[10px] text-[#a6adc8]">{filename}</span>
                    </div>
                  </div>
                  <textarea
                    required
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    rows={12}
                    className="w-full p-4 bg-[#1E1E2E] text-[#cdd6f4] font-mono text-xs leading-relaxed focus:outline-none resize-y selection:bg-[#585b70]"
                    placeholder="// 여기에 아두이노 또는 파이썬 코드를 작성하세요..."
                  />
                </div>
              </div>

              {/* Form Footer */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EAE6DF]">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-white hover:bg-gray-100 border border-[#EAE6DF] text-[#5C5B57] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  {selectedId ? "수정사항 저장하기" : "실습 코드 등록하기"}
                </button>
              </div>
            </form>
          ) : (
            /* Table of Course Contents */
            <div className="space-y-4">
              <div className="border border-[#EAE6DF] rounded-2xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF9F6] text-[#86868B] border-b border-[#EAE6DF]">
                    <tr>
                      <th className="p-3 font-semibold text-center w-20">주차</th>
                      <th className="p-3 font-semibold">실습 제목 & 파일명</th>
                      <th className="p-3 font-semibold">언어 & 태그</th>
                      <th className="p-3 font-semibold">핀맵 / 하드웨어 배선</th>
                      <th className="p-3 font-semibold text-right">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE6DF]">
                    {contents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-xs text-[#86868B]">
                          등록된 실습 코드가 없습니다. 상단의 '신규 실습 코드 등록'을 눌러 추가하세요.
                        </td>
                      </tr>
                    ) : (
                      contents.map(item => (
                        <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors align-top">
                          <td className="p-3 text-center">
                            <span className="px-2 py-1 bg-indigo-100 text-indigo-800 font-extrabold text-[11px] rounded-lg">
                              {item.week}주차
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-[#1D1D1F] text-xs">{item.title}</div>
                            <div className="text-[11px] text-[#86868B] line-clamp-1 mt-0.5">{item.description}</div>
                            <div className="font-mono text-[10px] text-indigo-600 mt-1 font-semibold flex items-center gap-1">
                              <FileCode className="w-3 h-3" />
                              {item.filename}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-mono font-bold rounded">
                              {item.language.toUpperCase()}
                            </span>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {item.tags?.map((t, idx) => (
                                <span key={idx} className="text-[9px] bg-[#FAF9F6] border border-[#EAE6DF] px-1.5 py-0.5 rounded text-[#5C5B57]">
                                  {t}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-[#5C5B57]">
                            {item.pinMap ? (
                              <div className="flex items-start gap-1">
                                <Cpu className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />
                                <span>{item.pinMap}</span>
                              </div>
                            ) : (
                              <span className="text-[#B0ACA5]">-</span>
                            )}
                          </td>
                          <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => setPreviewContent(item)}
                              className="px-2.5 py-1.5 bg-white border border-[#EAE6DF] hover:border-indigo-300 hover:text-indigo-600 rounded-lg text-[10px] font-medium transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" /> 코드 보기
                            </button>
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" /> 수정
                            </button>
                            <button
                              onClick={() => handleDelete(item.id, item.title)}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" /> 삭제
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Code Preview Drawer if selected */}
              {previewContent && (
                <div className="p-4 bg-[#1E1E2E] rounded-2xl border border-[#313244] space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between text-xs text-[#cdd6f4] pb-2 border-b border-[#313244]">
                    <span className="font-bold flex items-center gap-2 font-mono">
                      <FileCode className="w-4 h-4 text-indigo-400" />
                      [{previewContent.week}주차] {previewContent.filename}
                    </span>
                    <button
                      onClick={() => setPreviewContent(null)}
                      className="text-xs text-[#86868B] hover:text-[#cdd6f4]"
                    >
                      미리보기 닫기 ✕
                    </button>
                  </div>
                  <pre className="text-xs font-mono text-[#cdd6f4] max-h-60 overflow-y-auto p-2 scrollbar-thin">
                    <code>{previewContent.code}</code>
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
