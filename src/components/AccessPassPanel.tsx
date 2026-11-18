import React, { useState } from "react";
import { CreditCard, Ticket, CheckCircle2, X } from "lucide-react";

// 서버 ACCESS_PLANS와 같은 id/기간 (가격 표시는 목업)
const PLANS = [
  { id: "month", label: "1개월 이용권", days: 30, price: 5900 },
  { id: "year", label: "12개월 이용권", days: 365, price: 50000 }
];

interface Props {
  token: string | null;
  accessUntil?: string;
  onUpdated: () => void;
}

export default function AccessPassPanel({ token, accessUntil, onUpdated }: Props) {
  const [code, setCode] = useState("");
  const [payPlan, setPayPlan] = useState<(typeof PLANS)[number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const until = accessUntil ? new Date(accessUntil) : null;
  const daysLeft = until ? Math.ceil((until.getTime() - Date.now()) / 86400000) : 0;
  const active = daysLeft > 0;

  const post = async (url: string, body: any) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "요청에 실패했습니다.");
      setMsg({ ok: true, text: `${data.days}일 이용권이 적용되었습니다. (만료: ${new Date(data.accessUntil).toLocaleDateString()})` });
      onUpdated();
      return true;
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 text-left">
      <div className={`p-3 rounded-2xl border text-xs ${active ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
        {active ? (
          <>이용권 사용 중 · <b>{daysLeft}일 남음</b> (만료 {until!.toLocaleDateString()})</>
        ) : (
          <>이용권이 없습니다. 결제하거나 키트에 동봉된 쿠폰 코드를 입력하면 소다봇 API 연동과 전체 메뉴를 이용할 수 있어요.</>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-bold text-[#1D1D1F] flex items-center gap-1.5"><Ticket className="w-4 h-4 text-indigo-500" /> 쿠폰 코드 입력</div>
        <form
          className="flex gap-2"
          onSubmit={async e => {
            e.preventDefault();
            if (await post("/api/access/redeem", { code })) setCode("");
          }}
        >
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="10자리 코드 (예: AB3CD5EF7G)"
            maxLength={14}
            className="flex-1 px-3 py-2 border border-[#EAE6DF] rounded-xl text-sm font-mono tracking-widest focus:outline-none focus:border-indigo-400"
          />
          <button disabled={busy || !code.trim()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer">
            등록
          </button>
        </form>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-bold text-[#1D1D1F] flex items-center gap-1.5"><CreditCard className="w-4 h-4 text-indigo-500" /> 이용권 결제</div>
        <div className="grid grid-cols-2 gap-2">
          {PLANS.map(p => (
            <button
              key={p.id}
              onClick={() => setPayPlan(p)}
              className="p-3 border border-[#EAE6DF] hover:border-indigo-400 rounded-2xl text-left cursor-pointer transition-colors"
            >
              <div className="text-xs font-bold text-[#1D1D1F]">{p.label}</div>
              <div className="text-sm font-extrabold text-indigo-600">{p.price.toLocaleString()}원</div>
            </button>
          ))}
        </div>
      </div>

      {msg && <p className={`text-xs font-semibold ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}

      {payPlan && (
        <div className="fixed inset-0 z-[60] bg-[#1D1D1F]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl"
            onSubmit={async e => {
              e.preventDefault();
              if (await post("/api/access/mock-pay", { plan: payPlan.id })) setPayPlan(null);
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">결제하기 <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">테스트 결제</span></h3>
              <button type="button" onClick={() => setPayPlan(null)} className="cursor-pointer text-[#86868B]"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-3 bg-[#FAF9F6] rounded-2xl text-xs flex justify-between">
              <span>{payPlan.label} ({payPlan.days}일)</span>
              <b>{payPlan.price.toLocaleString()}원</b>
            </div>
            {/* 목업: 입력값은 서버로 보내지 않음 */}
            <input placeholder="카드번호 (테스트: 아무 값이나)" className="w-full px-3 py-2 border border-[#EAE6DF] rounded-xl text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="MM/YY" className="px-3 py-2 border border-[#EAE6DF] rounded-xl text-sm" />
              <input placeholder="CVC" className="px-3 py-2 border border-[#EAE6DF] rounded-xl text-sm" />
            </div>
            <p className="text-[10px] text-[#86868B]">실제 결제는 이루어지지 않는 목업 화면입니다.</p>
            <button disabled={busy} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer">
              <CheckCircle2 className="w-4 h-4" /> {payPlan.price.toLocaleString()}원 결제
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
