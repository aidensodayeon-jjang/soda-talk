import { useEffect, useState, type FormEvent } from "react";
import { createPortal, flushSync } from "react-dom";
import { Key, Printer } from "lucide-react";

interface KitKey {
  code: string;
  createdAt: number;
  startsOn: string | null;
  endsOn: string | null;
  issuedAt: number | null;
  usedAt: number | null;
  usedBy: string | null;
}

const apiPath = "/api/admin/kit-keys";
const maxSelection = 500;
const button = "rounded-lg border border-[#EAE6DF] bg-white px-3 py-2 text-xs font-semibold hover:bg-indigo-50 disabled:opacity-50";
const primaryButton = "rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50";
const inputClass = "mt-1 block w-full rounded-lg border border-[#EAE6DF] bg-white px-3 py-2 text-sm";
const timestamp = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short",
});

function DateFields({ startsOn, endsOn }: Pick<KitKey, "startsOn" | "endsOn">) {
  return (
    <>
      <label className="text-xs font-semibold">
        등록 시작일
        <input type="date" name="startsOn" defaultValue={startsOn ?? ""} className={inputClass} />
      </label>
      <label className="text-xs font-semibold">
        등록 종료일
        <input type="date" name="endsOn" defaultValue={endsOn ?? ""} className={inputClass} />
      </label>
    </>
  );
}

function readSchedule(fields: FormData) {
  return { startsOn: fields.get("startsOn"), endsOn: fields.get("endsOn") };
}

async function request<T>(token: string | null, suffix = "", options: RequestInit = {}): Promise<T> {
  const response = await fetch(apiPath + suffix, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "키트 인증 키를 처리할 수 없습니다.");
  return data;
}

export default function AdminKitKeysScreen({ token }: { token: string | null }) {
  const [keys, setKeys] = useState<KitKey[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [printBatch, setPrintBatch] = useState<string[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const query = search.trim().toUpperCase();
  const filtered = keys.filter(key =>
    (filter === "all" || (filter === "used" && key.usedAt) ||
      (filter === "unused" && !key.usedAt) || (filter === "unissued" && !key.issuedAt)) &&
    (key.code.includes(query) || key.usedBy?.toUpperCase().includes(query))
  );
  const selectable = filtered.filter(key => !key.usedAt);
  const singleSelection = selected.length === 1 ? keys.find(key => key.code === selected[0]) : null;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setKeys([]);
    setSelected([]);
    setPrintBatch([]);
    request<{ keys: KitKey[] }>(token, "", { signal: controller.signal })
      .then(data => setKeys(data.keys))
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token]);

  async function mutate<T>(suffix: string, method: string, body: object, onSuccess: (result: T) => void) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = await request<T>(token, suffix, { method, body: JSON.stringify(body) });
      onSuccess(result);
      const data = await request<{ keys: KitKey[] }>(token);
      setKeys(data.keys);
      const available = new Set(data.keys.filter(key => !key.usedAt).map(key => key.code));
      setSelected(previous => previous.filter(code => available.has(code)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "키트 인증 키를 처리할 수 없습니다.");
    } finally {
      setBusy(false);
    }
  }

  function createKeys(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    void mutate<{ codes: string[] }>("", "POST", { count: Number(fields.get("count")), ...readSchedule(fields) }, result => {
      setSelected(result.codes);
      setFilter("unissued");
      setSearch("");
      setEditingSchedule(false);
      setNotice(`새 키 ${result.codes.length}개를 발급했습니다. 선택된 키를 스티커로 인쇄할 수 있습니다.`);
    });
  }

  function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void mutate("/schedule", "PUT", { codes: selected, ...readSchedule(new FormData(event.currentTarget)) }, () => {
      setEditingSchedule(false);
      setNotice(`키 ${selected.length}개의 등록 가능 기간을 변경했습니다.`);
    });
  }

  function printSelected() {
    flushSync(() => setPrintBatch([...selected]));
    window.print();
  }

  function confirmIssue() {
    void mutate("/issue", "POST", { codes: printBatch }, () => {
      setNotice(`키 ${printBatch.length}개의 발행을 기록했습니다.`);
      setPrintBatch([]);
      setSelected([]);
      setEditingSchedule(false);
    });
  }

  return (
    <main className="min-w-0 flex-1 space-y-5 overflow-auto bg-white p-4 sm:p-6">
      <header className="border-b border-[#EAE6DF] pb-4">
        <h1 className="flex items-center gap-2 text-lg font-bold"><Key className="h-5 w-5 text-indigo-600" /> 키트 인증 키 관리</h1>
        <p className="mt-1 text-xs text-gray-600">키를 발급하고 스티커를 인쇄한 뒤 발행 완료를 기록하세요. 발행한 키는 가입 신청에서 한 번 사용할 수 있습니다.</p>
      </header>

      <section className="rounded-xl border border-[#EAE6DF] bg-[#FAF9F6] p-4">
        <h2 className="text-sm font-semibold">신규 키 발급</h2>
        <form onSubmit={createKeys} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="w-24 text-xs font-semibold">
            발급 수량
            <input type="number" name="count" min={1} max={100} defaultValue={10} required className={inputClass} />
          </label>
          <DateFields startsOn={null} endsOn={null} />
          <button type="submit" disabled={busy || loading || Boolean(printBatch.length)} className={primaryButton}>신규 발급</button>
        </form>
        <p className="mt-2 text-xs text-gray-600">한 번에 최대 100개를 만들 수 있습니다. 날짜는 한국 시간 기준이며, 비워 둔 날짜에는 제한이 없습니다.</p>
      </section>

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</p>}
      {printBatch.length > 0 && (
        <section aria-label="스티커 발행 확인" className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs">
          <p className="mr-auto">스티커 {printBatch.length}장이 인쇄됐다면 발행 완료를 눌러 주세요.</p>
          <button type="button" disabled={busy} className={button} onClick={() => setPrintBatch([])}>닫기</button>
          <button type="button" disabled={busy} className={primaryButton} onClick={confirmIssue}>인쇄 완료 · 발행 처리</button>
        </section>
      )}

      <section aria-label="키 목록" className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold">
            사용 상태
            <select value={filter} onChange={event => setFilter(event.target.value)} className={inputClass}>
              <option value="all">전체</option>
              <option value="unused">미사용</option>
              <option value="used">사용됨</option>
              <option value="unissued">발행 대기</option>
            </select>
          </label>
          <label className="min-w-0 text-xs font-semibold">
            키 검색
            <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="인증 키 또는 이메일" className={inputClass} />
          </label>
          <p className="py-2 text-xs text-gray-600">검색 결과 {filtered.length}개</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs text-gray-700">{selected.length}개 선택</span>
          <button type="button" className={button} disabled={busy || !selectable.length || Boolean(printBatch.length)}
            onClick={() => { setSelected(selectable.slice(0, maxSelection).map(key => key.code)); setEditingSchedule(false); }}>
            검색 결과 선택 (최대 {maxSelection}개)
          </button>
          <button type="button" className={button} disabled={busy || !selected.length || Boolean(printBatch.length)}
            onClick={() => { setSelected([]); setEditingSchedule(false); }}>선택 해제</button>
          <button type="button" className={button} disabled={busy || !selected.length || Boolean(printBatch.length)}
            aria-expanded={editingSchedule} onClick={() => setEditingSchedule(value => !value)}>기간 변경</button>
          <button type="button" className={`inline-flex items-center gap-1 ${primaryButton}`} disabled={busy || !selected.length || Boolean(printBatch.length)}
            onClick={printSelected}><Printer className="h-4 w-4" /> 스티커 인쇄</button>
          <span className="text-xs text-gray-600">A4 · 60 × 28 mm</span>
        </div>
        {editingSchedule && selected.length > 0 && (
          <form key={singleSelection?.code ?? "batch"} onSubmit={saveSchedule} className="flex flex-wrap items-end gap-3 rounded-xl border border-[#EAE6DF] p-3">
            <DateFields startsOn={singleSelection?.startsOn ?? null} endsOn={singleSelection?.endsOn ?? null} />
            <button type="submit" disabled={busy || Boolean(printBatch.length)} className={primaryButton}>선택한 {selected.length}개에 적용</button>
          </form>
        )}
        <div className="overflow-x-auto rounded-xl border border-[#EAE6DF]">
          <table className="w-full whitespace-nowrap text-left text-xs">
            <thead className="bg-[#FAF9F6] text-gray-600">
              <tr>
                {["선택", "인증 키", "사용 상태", "등록 가능 기간", "발행 상태", "사용 계정", "발급 일시"].map(label =>
                  <th key={label} scope="col" className="px-3 py-2.5 font-semibold">{label}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE6DF]">
              {!filtered.length && <tr><td colSpan={7} className="p-4 text-center text-gray-600">{loading ? "불러오는 중…" : "표시할 키가 없습니다."}</td></tr>}
              {filtered.map(key => {
                const checked = selected.includes(key.code);
                return (
                  <tr key={key.code} className={checked ? "bg-indigo-50/50" : "hover:bg-gray-50"}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={checked} aria-label={`${key.code} 선택`}
                        disabled={busy || Boolean(key.usedAt) || Boolean(printBatch.length) || (!checked && selected.length >= maxSelection)}
                        onChange={event => {
                          const select = event.target.checked;
                          setSelected(previous => select ? [...previous, key.code] : previous.filter(code => code !== key.code));
                          setEditingSchedule(false);
                        }} />
                    </td>
                    <th scope="row" className="select-all px-3 py-2 font-mono font-semibold">{key.code}</th>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-1 font-medium ${key.usedAt ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-gray-700"}`}>
                        {key.usedAt ? "사용됨" : "미사용"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {key.startsOn || key.endsOn ? `${key.startsOn ?? "즉시"} ~ ${key.endsOn ?? "제한 없음"}` : "제한 없음"}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{key.issuedAt ? timestamp.format(key.issuedAt) : "발행 대기"}</td>
                    <td className="px-3 py-2 text-gray-700" title={key.usedAt ? timestamp.format(key.usedAt) : undefined}>{key.usedBy ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-700">{timestamp.format(key.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {printBatch.length > 0 && createPortal(
        <div id="kit-sticker-sheet" className="hidden">
          <style>{`
            @media print {
              @page { size: A4; margin: 10mm; }
              html, body { background: white !important; }
              body > :not(#kit-sticker-sheet) { display: none !important; }
              #kit-sticker-sheet { display: block !important; color: #111; }
              .kit-sticker-row { display: flex; gap: 3mm; margin-bottom: 3mm; break-inside: avoid; }
              .kit-sticker {
                box-sizing: border-box; width: 60mm; height: 28mm; padding: 3mm;
                border: 1px dashed #888; display: flex; flex-direction: column;
                align-items: center; justify-content: center; gap: 1.5mm;
              }
              .kit-sticker strong { font-size: 10pt; }
              .kit-sticker code { font: bold 11pt monospace; white-space: nowrap; }
              .kit-sticker small { font-size: 7.5pt; }
            }
          `}</style>
          {Array.from({ length: Math.ceil(printBatch.length / 3) }, (_, row) => (
            <div className="kit-sticker-row" key={row}>
              {printBatch.slice(row * 3, row * 3 + 3).map(code => (
                <div className="kit-sticker" key={code}>
                  <strong>SODABOT KIT</strong>
                  <code>{code}</code>
                  <small>회원가입에서 키트 인증 키를 입력하세요.</small>
                </div>
              ))}
            </div>
          ))}
        </div>, document.body
      )}
    </main>
  );
}
