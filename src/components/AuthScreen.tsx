import React, { useState } from "react";
import { Sparkles, ArrowRight, User as UserIcon, Lock, ShieldAlert, FileText, Info } from "lucide-react";

interface AuthScreenProps {
  onLoginSuccess: (token: string, user: { id: string; username: string; displayName: string }) => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const url = isLogin ? "/api/auth/login" : "/api/auth/signup";
    const body = isLogin
      ? { username, password }
      : { username, displayName, password };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "인증에 실패했습니다.");
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

      {/* Decorative Brand Accent (MUJI Brick Red Accent) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-[3px] bg-[#9C282C]" />

      <div className="w-full max-w-md bg-white border border-[#EAE6DF] rounded-2xl shadow-[0_4px_24px_rgba(42,41,39,0.04)] px-8 py-10 relative z-10">
        {/* Notion / Apple style header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#FAF9F6] border border-[#EAE6DF] rounded-2xl mb-4 text-[#9C282C] shadow-sm">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">MUJI AI Studio Chat</h1>
          <p className="text-sm text-[#86868B] mt-1.5 font-mono">대화형 프롬프트 워크스페이스</p>
        </div>

        {/* Demo Account Callout */}
        <div className="mb-6 p-4 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-xs text-[#5C5B57] leading-relaxed space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-[#1D1D1F] mb-1">
            <Info className="w-3.5 h-3.5 text-[#9C282C]" />
            <span>즉시 로그인 가능한 간편 계정</span>
          </div>
          <p>• 아이디: <code className="bg-[#EAE6DF] px-1 rounded text-[#9C282C] font-mono font-medium">admin</code> &nbsp;/&nbsp; 비밀번호: <code className="bg-[#EAE6DF] px-1 rounded text-[#9C282C] font-mono font-medium">admin123</code></p>
          <p>• 아이디: <code className="bg-[#EAE6DF] px-1 rounded text-[#9C282C] font-mono font-medium">muji</code> &nbsp;/&nbsp; 비밀번호: <code className="bg-[#EAE6DF] px-1 rounded text-[#9C282C] font-mono font-medium">muji123</code></p>
          <p className="text-[10px] text-[#86868B] mt-1.5 pt-1.5 border-t border-[#EAE6DF]/60">새로운 계정으로 즉시 회원가입 후 로그인도 언제든 지원됩니다.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-[#FDF2F2] border border-[#FDE8E8] rounded-xl flex items-start gap-3 text-sm text-[#9C282C]">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-[#86868B] uppercase tracking-wider mb-1.5 font-mono">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#86868B]">
                <UserIcon className="w-4 h-4" />
              </span>
              <input
                id="username-input"
                type="text"
                required
                placeholder="아이디를 입력해 주세요 (예: admin)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-sm focus:outline-none focus:border-[#2A2927] focus:ring-1 focus:ring-[#2A2927] transition-all placeholder:text-[#B0ACA5]"
              />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-medium text-[#86868B] uppercase tracking-wider mb-1.5 font-mono">
                Display Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#86868B]">
                  <FileText className="w-4 h-4" />
                </span>
                <input
                  id="display-name-input"
                  type="text"
                  required
                  placeholder="대화방에서 불려질 별명"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-sm focus:outline-none focus:border-[#2A2927] focus:ring-1 focus:ring-[#2A2927] transition-all placeholder:text-[#B0ACA5]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#86868B] uppercase tracking-wider mb-1.5 font-mono">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#86868B]">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="password-input"
                type="password"
                required
                placeholder="비밀번호를 입력해 주세요 (예: admin123)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#FAF9F6] border border-[#EAE6DF] rounded-xl text-sm focus:outline-none focus:border-[#2A2927] focus:ring-1 focus:ring-[#2A2927] transition-all placeholder:text-[#B0ACA5]"
              />
            </div>
          </div>

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-[#2A2927] hover:bg-[#1D1D1F] disabled:bg-[#B0ACA5] text-white rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
          >
            {loading ? "인증 중..." : isLogin ? "채팅방 입장하기" : "가입 및 대화 시작하기"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Toggle between login and signup */}
        <div className="mt-8 text-center border-t border-[#FAF9F6] pt-6">
          <button
            id="toggle-auth-mode-btn"
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
            className="text-xs text-[#86868B] hover:text-[#9C282C] transition-colors underline underline-offset-4"
          >
            {isLogin
              ? "처음 방문하셨나요? 간편 회원가입"
              : "이미 계정이 있으신가요? 기존 로그인"}
          </button>
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-[#B0ACA5] font-mono max-w-xs leading-relaxed">
        무인양품의 비움의 미학, Notion의 정갈함, Apple의 유려함을 한데 빚어낸 챗GPT 스타일의 고품격 AI 대화 공간입니다.
      </div>
    </div>
  );
}
