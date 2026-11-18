import React, { useEffect, useState } from "react";
import { Ticket, Trash2, Copy } from "lucide-react";

interface Coupon {
  code: string;
  days: number;
  memo?: string;
  createdAt: string;
  usedBy?: string;
  usedByName?: string;
  usedAt?: string;
}

export default function AdminCouponModal({ token, onClose }: { token: string | null; onClose: () => void }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [count, setCount] = useState(10);
  const [days, setDays] = useState(365);
  const [memo, setMemo] = useState("");
  const [filter, setFilter] = useState<"all" | "unused" | "used">("all");
  const [error, setError] = useState("");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = async () => {
    const res = await fetch("/api/admin/coupons", { headers });
    const data = await res.json();
    if (res.ok) setCoupons(data.coupons);
    else setError(data.error);
  };
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/coupons", { method: "POST", headers, body: JSON.stringify({ count, days, memo }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    await navigator.clipboard?.writeText(data.coupons.map((c: Coupon) => c.code).join("\n")).catch(() => {});
    load();
  };

  const remove = async (code: string) => {
    if (!confirm(`${code} 쿠폰을 삭제할까요?`)) return;
    const res = await fetch(`/api/admin/coupons/${code}`, { method: "DELETE", headers });
    if (!res.ok) setError((await res.json()).error);
    load();
  };

  const shown = coupons.filter(c => filter === "all" || (filter === "used") === Boolean(c.usedBy));
  const unusedCodes = coupons.filter(c => !c.usedBy).map(c => c.code);

  return (
    <div className="fixed inset-0 bg-[#1D1D1F]/40 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white border border-[#EAE6DF] rounded-3xl w-full max-w-4xl shadow-2xl p-6 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-4 border-b border-[#FAF9F6]">
          <div>
            <h3 className="text-base font-bold text-[#1D1D1F] flex items-center gap-2"><Ticket className="w-5 h-5 text-indigo-600" /> 쿠폰(키트 접속코드) 관리</h3>
            <p className="text-xs text-[#86868B]">쿠폰 1개 = 1회 사용. 사용일수는 사용자가 등록한 날부터 계산됩니다.</p>
          </div>
          <button onClick={onClose} className="text-xs text-[#86868B] hover:text-[#1D1D1F] bg-[#FAF9F6] px-3 py-1.5 rounded-full cursor-pointer">닫기 ✕</button>
        </div>

        <form onSubmit={create} className="flex flex-wrap items-end gap-2 py-4 text-xs">
          <label className="flex flex-col gap-1">발급 수량
            <input type="number" min={1} max={500} value={count} onChange={e => setCount(+e.target.value)} className="w-24 px-2 py-1.5 border border-[#EAE6DF] rounded-lg" />
          </label>
          <label className="flex flex-col gap-1">사용일수
            <input type="number" min={1} max={3650} value={days} onChange={e => setDays(+e.target.value)} className="w-24 px-2 py-1.5 border border-[#EAE6DF] rounded-lg" />
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-40">메모 (예: 2026-11 키트 1차)
            <input value={memo} onChange={e => setMemo(e.target.value)} className="px-2 py-1.5 border border-[#EAE6DF] rounded-lg" />
          </label>
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer">발급 (클립보드 복사)</button>
        </form>
        {error && <p className="text-xs text-rose-600 pb-2">{error}</p>}

        <div className="flex items-center gap-2 pb-2 text-xs">
          {(["all", "unused", "used"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-full cursor-pointer ${filter === f ? "bg-indigo-600 text-white" : "bg-[#FAF9F6] text-[#5C5B57]"}`}>
              {{ all: `전체 ${coupons.length}`, unused: `미사용 ${unusedCodes.length}`, used: `사용됨 ${coupons.length - unusedCodes.length}` }[f]}
            </button>
          ))}
          <button onClick={() => navigator.clipboard?.writeText(unusedCodes.join("\n"))} className="ml-auto px-3 py-1 rounded-full bg-[#FAF9F6] text-[#5C5B57] flex items-center gap-1 cursor-pointer">
            <Copy className="w-3 h-3" /> 미사용 코드 복사
          </button>
        </div>

        <div className="flex-1 overflow-y-auto border border-[#EAE6DF] rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9F6] text-[#86868B] sticky top-0">
              <tr>
                <th className="p-3">코드</th><th className="p-3">사용일수</th><th className="p-3">메모</th>
                <th className="p-3">발급일</th><th className="p-3">사용자 / 등록일</th><th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE6DF]">
              {shown.map(c => (
                <tr key={c.code}>
                  <td className="p-3 font-mono font-bold tracking-widest">{c.code}</td>
                  <td className="p-3">{c.days}일</td>
                  <td className="p-3 text-[#5C5B57]">{c.memo || "-"}</td>
                  <td className="p-3 text-[#86868B]">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="p-3">
                    {c.usedBy ? (
                      <span className="text-emerald-700">{c.usedByName} · {new Date(c.usedAt!).toLocaleDateString()}</span>
                    ) : <span className="text-[#86868B]">미사용</span>}
                  </td>
                  <td className="p-3 text-right">
                    {!c.usedBy && (
                      <button onClick={() => remove(c.code)} className="text-rose-500 hover:text-rose-700 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-[#86868B]">쿠폰이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
