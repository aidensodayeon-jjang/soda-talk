import React, { useState } from "react";
import { Lock, User, Phone, ArrowRight, ShieldAlert, Sparkles, Cpu, GraduationCap, ShieldCheck } from "lucide-react";

interface AuthScreenProps {
  onLoginSuccess: (token: string, user: { id: string; username: string; displayName: string; role?: string; canAccessChat?: boolean }) => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [authTab, setAuthTab] = useState<"student" | "admin">("student");

  // Student Form States
  const [studentName, setStudentName] = useState(localStorage.getItem("savedStudentName") || "");
  const [phoneLast4, setPhoneLast4] = useState(localStorage.getItem("savedPhoneLast4") || "");

  // Admin Form States
  const [adminUsername, setAdminUsername] = useState(localStorage.getItem("savedAdminUsername") || "admin");
  const [adminPassword, setAdminPassword] = useState(localStorage.getItem("savedAdminPassword") || "");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const body = authTab === "student"
      ? { loginType: "student", name: studentName.trim(), phone: phoneLast4.trim() }
      : { loginType: "admin", username: adminUsername.trim(), password: adminPassword.trim() };

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "로그인에 실패했습니다.");
      }

      if (authTab === "student") {
        localStorage.setItem("savedStudentName", studentName);
        localStorage.setItem("savedPhoneLast4", phoneLast4);
      } else {
        localStorage.setItem("savedAdminUsername", adminUsername);
        localStorage.setItem("savedAdminPassword", adminPassword);
      }

      onLoginSuccess(data.sessionId, data.user);
    } catch (err: any) {
      setError(err.message || "서버와 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#2A2927] font-sans flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Subtle MUJI-style Grid lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#EAE6DF_1px,transparent_1px),linear-gradient(to_bottom,#EAE6DF_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      {/* Decorative Brand Accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-[3px] bg-indigo-600" />

      <div className="w-full max-w-md bg-white border border-[#EAE6DF] rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] px-8 py-9 relative z-10 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl mb-3.5 text-indigo-600 shadow-xs">
            <Cpu className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#1D1D1F]">SODABOT STUDIO</h1>
          <p className="text-xs text-[#86868B] mt-1 font-medium">소다봇 제작 & AI 로봇 코딩 플랫폼</p>
        </div>

        {/* Tab Switcher (학생 로그인 vs 관리자 로그인) */}
        <div className="grid grid-cols-2 p-1 bg-[#FAF9F6] border border-[#EAE6DF] rounded-2xl mb-6 shadow-inner">
          <button
            type="button"
            onClick={() => { setAuthTab("student"); setError(""); }}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              authTab === "student"
                ? "bg-white text-indigo-700 shadow-xs ring-1 ring-black/5"
                : "text-[#5C5B57] hover:text-[#1D1D1F]"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>학생 로그인</span>
          </button>
          <button
            type="button"
            onClick={() => { setAuthTab("admin"); setError(""); }}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              authTab === "admin"
                ? "bg-white text-[#1D1D1F] shadow-xs ring-1 ring-black/5"
                : "text-[#5C5B57] hover:text-[#1D1D1F]"
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>선생님 / 관리자</span>
          </button>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 font-medium">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {/* Form Area */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {authTab === "student" ? (
            /* Student Mode Fields */
            <>
              <div>
                <label className="block text-xs font-bold text-[#5C5B57] uppercase tracking-wider mb-1.5 font-mono">
                  학생 이름
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#86868B]">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    id="student-name-input"
                    type="text"
                    required
                    placeholder="예: 홍길동"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all placeholder:text-[#B0ACA5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5C5B57] uppercase tracking-wider mb-1.5 font-mono">
                  전화번호 뒷 4자리
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#86868B]">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    id="phone-last4-input"
                    type="password"
                    maxLength={4}
                    required
                    placeholder="학부모/학생 전화번호 뒷자리 (4자리)"
                    value={phoneLast4}
                    onChange={(e) => setPhoneLast4(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-sm font-mono tracking-widest focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all placeholder:text-[#B0ACA5] placeholder:tracking-normal"
                  />
                </div>
                <p className="text-[11px] text-[#86868B] mt-1.5 font-medium pl-1">
                  💡 학원에 등록된 학생 이름과 전화번호 뒷자리 4자리를 입력하세요.
                </p>
              </div>
            </>
          ) : (
            /* Admin Mode Fields */
            <>
              <div>
                <label className="block text-xs font-bold text-[#5C5B57] uppercase tracking-wider mb-1.5 font-mono">
                  관리자 아이디
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#86868B]">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    id="admin-username-input"
                    type="text"
                    required
                    placeholder="admin"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all placeholder:text-[#B0ACA5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5C5B57] uppercase tracking-wider mb-1.5 font-mono">
                  관리자 비밀번호
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#86868B]">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="admin-password-input"
                    type="password"
                    required
                    placeholder="비밀번호를 입력하세요"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all placeholder:text-[#B0ACA5]"
                  />
                </div>
              </div>
            </>
          )}

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-[#B0ACA5] text-white rounded-xl text-sm font-black transition-all duration-200 flex items-center justify-center gap-2 shadow-md shadow-indigo-200 cursor-pointer active:scale-[0.99]"
          >
            {loading ? (
              <span>접속 확인 중...</span>
            ) : (
              <>
                <span>{authTab === "student" ? "소다봇 스튜디오 입장" : "관리자 모드로 입장"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer info note */}
        <div className="mt-6 text-center border-t border-[#FAF9F6] pt-4">
          <p className="text-[11px] text-[#86868B]">
            디랩 소다봇 스튜디오 © 2026 D-LAB Education
          </p>
        </div>
      </div>
    </div>
  );
}
