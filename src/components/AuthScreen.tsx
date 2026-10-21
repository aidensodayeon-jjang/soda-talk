import React, { useState } from "react";
import { Lock, User, ArrowRight, AlertCircle, Bot, Mail, KeyRound, CheckCircle2, MapPin, ChevronDown } from "lucide-react";

const CAMPUSES = ["송도", "대구", "동탄", "잠실", "울산", "기타"];
const inputClass = "w-full h-[48px] pl-10 pr-4 bg-[#FAF9F6] border border-[#E9E7E2] rounded-[12px] text-sm text-[#20262B] placeholder:text-[#A0A5A3] transition-all duration-150 focus:outline-none focus:border-[#168571] focus:ring-2 focus:ring-[#168571]/15";

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
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  // 외부인 회원가입
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [signup, setSignup] = useState({ displayName: "", email: "", code: "", password: "", campus: "" });
  const [codeSent, setCodeSent] = useState(false);
  const setField = (k: keyof typeof signup) => (e: React.ChangeEvent<HTMLInputElement>) => setSignup({ ...signup, [k]: e.target.value });

  const postJson = async (url: string, body: object) => {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "요청에 실패했습니다.");
    return data;
  };

  const handleSendCode = async () => {
    setError(""); setNotice(""); setLoading(true);
    try {
      await postJson("/api/auth/signup/send-code", { email: signup.email.trim() });
      setCodeSent(true);
      setNotice("인증코드를 이메일로 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요.");
    } catch (err: any) {
      setError(err.message || "서버와 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setNotice("");
    if (!signup.campus) return setError("디랩 캠퍼스를 선택해 주세요.");
    setLoading(true);
    try {
      await postJson("/api/auth/signup", { ...signup, email: signup.email.trim() });
      setIdentifier(signup.email.trim());
      setSecret("");
      setMode("login");
      setNotice("회원가입이 완료되었습니다. 이메일과 비밀번호로 로그인해 주세요.");
    } catch (err: any) {
      setError(err.message || "서버와 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
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

        {notice && (
          <div className="mb-5 p-3.5 bg-[#F0FAF7] border border-[#BFE6DC] rounded-[12px] flex items-start gap-2.5 text-xs text-[#126E5D] font-medium animate-fade-in">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="leading-relaxed">{notice}</p>
          </div>
        )}

        {mode === "signup" ? (
          <form key="signup" onSubmit={handleSignup} className="space-y-4">
            <p className="text-[11px] text-[#858B8D] -mt-2 leading-relaxed text-center">
              디랩 재원생이 아닌 외부 회원 가입입니다. 재원생은 기존 로그인을 이용하세요.
            </p>
            <div>
              <label className="block text-xs font-semibold text-[#555B60] mb-1.5">이름</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#A0A5A3]"><User className="w-4 h-4" /></span>
                <input type="text" required placeholder="이름 입력" value={signup.displayName} onChange={setField("displayName")} className={inputClass} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#555B60] mb-1.5">이메일</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#A0A5A3]"><Mail className="w-4 h-4" /></span>
                  <input type="email" required placeholder="수신 가능한 이메일" value={signup.email} onChange={e => { setField("email")(e); setCodeSent(false); }} className={inputClass} />
                </div>
                <button type="button" onClick={handleSendCode} disabled={loading || !signup.email.trim()} className="shrink-0 h-[48px] px-3.5 bg-white border border-[#168571] text-[#168571] disabled:border-[#E9E7E2] disabled:text-[#A0A5A3] rounded-[12px] text-xs font-semibold cursor-pointer">
                  {codeSent ? "재전송" : "인증코드 받기"}
                </button>
              </div>
            </div>

            {codeSent && (
              <div>
                <label className="block text-xs font-semibold text-[#555B60] mb-1.5">인증코드</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#A0A5A3]"><KeyRound className="w-4 h-4" /></span>
                  <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required placeholder="이메일로 받은 6자리 숫자" value={signup.code} onChange={setField("code")} className={inputClass} />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#555B60] mb-1.5">비밀번호</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#A0A5A3]"><Lock className="w-4 h-4" /></span>
                <input type="password" required minLength={6} autoComplete="new-password" placeholder="6자 이상" value={signup.password} onChange={setField("password")} className={inputClass} />
              </div>
            </div>

            <div>
              <label htmlFor="campus-select" className="block text-xs font-semibold text-[#555B60] mb-1.5">디랩 캠퍼스</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#A0A5A3]"><MapPin className="w-4 h-4" /></span>
                <select id="campus-select" required value={signup.campus} onChange={e => setSignup({ ...signup, campus: e.target.value })} className={`${inputClass} appearance-none cursor-pointer ${signup.campus ? "" : "text-[#A0A5A3]"}`}>
                  <option value="" disabled>캠퍼스 선택</option>
                  {CAMPUSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <span className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#A0A5A3] pointer-events-none"><ChevronDown className="w-4 h-4" /></span>
              </div>
            </div>

            <button type="submit" disabled={loading || !codeSent} className="w-full h-[48px] mt-3 bg-[#168571] hover:bg-[#126E5D] disabled:bg-[#E9E7E2] disabled:text-[#A0A5A3] disabled:cursor-not-allowed text-white rounded-[12px] text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-[0.99]">
              {loading ? "처리 중..." : "회원가입"}
            </button>
          </form>
        ) : (
        <form key="login" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#555B60] mb-1.5">
              아이디·이름 또는 이메일
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#A0A5A3]">
                <User className="w-4 h-4" />
              </span>
              <input
                id="identifier-input"
                type="text"
                required
                placeholder="학생 이름, 아이디 또는 이메일"
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
              재원생은 이름과 전화번호 뒷 4자리를, 외부 회원은 이메일과 비밀번호를 입력하세요.
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

        <p className="mt-6 text-center text-xs text-[#858B8D]">
          {mode === "login" ? "디랩 재원생이 아니신가요? " : "이미 계정이 있으신가요? "}
          <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setNotice(""); }} className="font-semibold text-[#168571] hover:underline cursor-pointer">
            {mode === "login" ? "회원가입" : "로그인"}
          </button>
        </p>

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
