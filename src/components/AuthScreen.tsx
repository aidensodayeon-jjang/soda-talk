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
      localStorage.setItem("savedSecret", trimmedSecret);

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

        {/* Unified Login Form (구분 없이 단일 폼) */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#555B60] mb-1.5">
              아이디 또는 이름
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#A0A5A3]">
                <User className="w-4 h-4" />
              </span>
              <input
                id="identifier-input"
                type="text"
                required
                placeholder="아이디 또는 학생 이름 입력"
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
              학생은 이름과 전화번호 뒷 4자리를, 관리자는 아이디와 비밀번호를 입력하세요.
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
