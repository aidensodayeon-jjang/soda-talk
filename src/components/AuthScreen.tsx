import React, { useState } from "react";
import { Lock, User, ArrowRight, AlertCircle, Bot } from "lucide-react";

interface AuthScreenProps {
  onLoginSuccess: (token: string, user: { id: string; username: string; displayName: string; role?: string; canAccessChat?: boolean }) => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  // 단일 통합 로그인 상태 (아이디 또는 학생 이름, 비밀번호 또는 전화번호 뒷자리)
  const [identifier, setIdentifier] = useState(
    localStorage.getItem("savedIdentifier") ||
    localStorage.getItem("savedStudentName") ||
    localStorage.getItem("savedAdminUsername") ||
    ""
  );
  const [secret, setSecret] = useState(
    localStorage.getItem("savedSecret") ||
    localStorage.getItem("savedPhoneLast4") ||
    localStorage.getItem("savedAdminPassword") ||
    ""
  );

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [signingUp, setSigningUp] = useState(window.location.hash === "#signup");
  const [notice, setNotice] = useState("");

  const changeMode = (signup: boolean) => {
    setError("");
    setNotice("");
    setSigningUp(signup);
    window.history.replaceState(null, "", signup ? "#signup" : window.location.pathname + window.location.search);
  };

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "가입 신청에 실패했습니다.");
      changeMode(false);
      setIdentifier(String(fields.email).trim().toLowerCase());
      setSecret("");
      setNotice(data.kitVerified
        ? "키트 인증과 가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다."
        : "가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "가입 신청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const trimmedIdentifier = identifier.trim();
    const trimmedSecret = secret.trim();

    if (!trimmedIdentifier || !trimmedSecret) {
      setError("아이디(또는 이름)와 비밀번호(또는 전화번호 뒷자리)를 입력해 주세요.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: trimmedIdentifier,
          password: trimmedSecret,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "로그인에 실패했습니다.");
      }

      localStorage.setItem("savedIdentifier", trimmedIdentifier);
      if (trimmedIdentifier.includes("@")) {
        localStorage.removeItem("savedSecret");
      } else {
        localStorage.setItem("savedSecret", trimmedSecret);
      }

      onLoginSuccess(data.sessionId, data.user);
    } catch (err: any) {
      setError(err.message || "서버와 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#20262B] font-sans flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden select-none">
      {/* Subtle Warm Grid lines (은은한 격자 배경) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#E9E7E2_1px,transparent_1px),linear-gradient(to_bottom,#E9E7E2_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-15 pointer-events-none" />

      {/* Main Login Card (420px 너비, 36px 내부 패딩, 24px 모서리 반경) */}
      <div className="w-full max-w-[420px] bg-white border border-[#E9E7E2] rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.03),0_1px_3px_rgba(0,0,0,0.02)] p-9 relative z-10 animate-fade-in">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-[52px] h-[52px] bg-[#168571] rounded-[16px] mb-3.5 text-white shadow-xs">
            <Bot className="w-7 h-7" />
          </div>
          <h1 className="text-[22px] font-bold tracking-tight text-[#20262B]">
            SODABOT STUDIO
          </h1>
          <p className="text-[12px] text-[#858B8D] mt-1 font-normal">
            나만의 AI 로봇을 만드는 공간
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 bg-[#FFF5F5] border border-[#FED7D7] rounded-[12px] flex items-start gap-2.5 text-xs text-[#C53030] font-medium animate-fade-in">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#E53E3E]" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {notice && <p role="status" className="mb-5 text-sm text-[#168571]">{notice}</p>}
        {signingUp ? (
          <form onSubmit={handleSignup} className="space-y-4">
            <h2 className="text-lg font-bold">회원가입</h2>
            {[
              { name: "email", label: "이메일", type: "email", autoComplete: "email", maxLength: 80 },
              { name: "name", label: "이름", type: "text", autoComplete: "name", maxLength: 20 },
              { name: "password", label: "비밀번호", type: "password", autoComplete: "new-password", minLength: 8, maxLength: 100 },
              { name: "signupCode", label: "가입 코드 (안내받은 경우)", type: "password", autoComplete: "off", maxLength: 128, required: false },
              { name: "kitKey", label: "키트 인증 키 (선택)", type: "text", autoComplete: "off", maxLength: 32, required: false, placeholder: "SODA-XXXX-XXXX-XXXX", spellCheck: false },
            ].map(({ label, ...field }) => (
              <label key={field.name} className="block text-xs font-semibold text-[#555B60]">
                {label}
                <input {...field} required={field.required ?? true} className="mt-1.5 w-full h-12 px-4 rounded-xl border border-[#E9E7E2] bg-[#FAF9F6] text-sm focus:outline-[#168571]" />
              </label>
            ))}
            <label className="block text-xs font-semibold text-[#555B60]">
              캠퍼스
              <select name="campus" defaultValue="" required className="mt-1.5 w-full h-12 px-4 rounded-xl border border-[#E9E7E2] bg-[#FAF9F6] text-sm focus:outline-[#168571]">
                <option value="" disabled>캠퍼스 선택</option>
                <option value="목동">목동</option>
                <option value="송도">송도</option>
                <option value="기타">기타</option>
              </select>
            </label>
            <button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-[#168571] text-white text-sm font-semibold disabled:opacity-50">
              {loading ? "신청 중..." : "가입 신청"}
            </button>
          </form>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#555B60] mb-1.5">
              이메일, 아이디 또는 이름
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#A0A5A3]">
                <User className="w-4 h-4" />
              </span>
              <input
                id="identifier-input"
                type="text"
                required
                placeholder="이메일, 아이디 또는 학생 이름"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full h-[48px] pl-10 pr-4 bg-[#FAF9F6] border border-[#E9E7E2] rounded-[12px] text-sm text-[#20262B] placeholder:text-[#A0A5A3] transition-all duration-150 focus:outline-none focus:border-[#168571] focus:ring-2 focus:ring-[#168571]/15"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#555B60] mb-1.5">
              비밀번호 또는 전화번호 뒷자리
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#A0A5A3]">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="secret-input"
                type="password"
                required
                placeholder="비밀번호 또는 전화번호 뒷 4자리"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="w-full h-[48px] pl-10 pr-4 bg-[#FAF9F6] border border-[#E9E7E2] rounded-[12px] text-sm text-[#20262B] placeholder:text-[#A0A5A3] transition-all duration-150 focus:outline-none focus:border-[#168571] focus:ring-2 focus:ring-[#168571]/15"
              />
            </div>
            <p className="text-[11px] text-[#858B8D] mt-1.5 leading-relaxed">
              가입 회원은 이메일과 비밀번호, 수강생은 이름과 전화번호 뒤 4자리로 로그인하세요.
            </p>
          </div>

          {/* Submit Button */}
          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full h-[48px] mt-3 bg-[#168571] hover:bg-[#126E5D] disabled:bg-[#E9E7E2] disabled:text-[#A0A5A3] disabled:cursor-not-allowed text-white rounded-[12px] text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-[0.99]"
          >
            {loading ? (
              <span>접속 확인 중...</span>
            ) : (
              <>
                <span>소다봇 스튜디오 입장</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        )}
        <div className="mt-4 text-center">
          <a href={signingUp ? window.location.pathname : "#signup"} onClick={event => {
            event.preventDefault();
            if (!loading) changeMode(!signingUp);
          }} className="text-sm font-semibold text-[#168571] hover:underline">
            {signingUp ? "로그인으로 돌아가기" : "회원가입"}
          </a>
        </div>

        {/* Footer info note */}
        <div className="mt-8 text-center pt-2">
          <p className="text-[11px] text-[#A0A5A3] tracking-normal">
            © 2026 D-LAB Education
          </p>
        </div>
      </div>
    </div>
  );
}
