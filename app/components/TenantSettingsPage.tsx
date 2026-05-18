"use client";

import { useState, useTransition } from "react";
import type { AppSettings } from "@/lib/settings";
import type { DepartmentInfo } from "@/lib/departments";
import {
  actionSaveSettings,
  actionAddDepartment,
  actionUpdateDepartment,
  actionDeleteDepartment,
  actionReorderDepartments,
} from "@/app/actions";
import MIcon from "./MIcon";
import { ConfirmModal } from "./ConfirmModal";

const ACCENT_COLORS: Record<string, string> = {
  blue: "#3B82F6", rust: "#C2654D", green: "#4F8A53",
  amber: "#F59E0B", navy: "#1e40af", orange: "#EA580C", red: "#dc2626",
};

const ACCENT_OPTIONS = [
  { value: "blue",   label: "Modrá" },
  { value: "rust",   label: "Rezavá" },
  { value: "green",  label: "Zelená" },
  { value: "amber",  label: "Jantarová" },
  { value: "navy",   label: "Námořnická" },
  { value: "orange", label: "Oranžová" },
  { value: "red",    label: "Červená" },
];

const DAY_ORDER = ["Po", "Út", "St", "Čt", "Pá"] as const;

interface Props {
  departments: DepartmentInfo[];
  settings: AppSettings;
  tenantSlug: string;
}

// Helper component for section headings
function SectionHeader({ icon, iconColor, iconBg, title, subtitle, action }: {
  icon: string; iconColor: string; iconBg: string;
  title: string; subtitle: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-white/55">
      <span className="inline-flex items-center justify-center rounded-xl shrink-0"
        style={{ width: 32, height: 32, background: iconBg }}>
        <MIcon name={icon as "mail"} size={17} fill style={{ color: iconColor }} />
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="font-display font-bold text-[14.5px] text-slate-900 leading-tight">{title}</h3>
        <div className="text-[11px] text-slate-500">{subtitle}</div>
      </div>
      {action}
    </div>
  );
}

export default function TenantSettingsPage({ departments: initialDepts, settings, tenantSlug }: Props) {
  const [departments, setDepartments] = useState(initialDepts);
  const [deptDeleteConfirm, setDeptDeleteConfirm] = useState<DepartmentInfo | null>(null);
  const [deptEditId, setDeptEditId] = useState<number | null>(null);
  const [deptEditLabel, setDeptEditLabel] = useState("");
  const [deptEditAccent, setDeptEditAccent] = useState("blue");
  const [showAddDept, setShowAddDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptLabel, setNewDeptLabel] = useState("");
  const [newDeptAccent, setNewDeptAccent] = useState("blue");
  const [deptError, setDeptError] = useState("");

  const [smtpStatus, setSmtpStatus] = useState<"idle" | "ok" | "error">("idle");
  const [smtpMsg, setSmtpMsg] = useState("");
  const [smtpSaved, setSmtpSaved] = useState(false);
  const [timesSaved, setTimesSaved] = useState(false);
  const [pricesSaved, setPricesSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  // SMTP state
  const [smtp, setSmtp] = useState({
    host: settings.smtpHost ?? "",
    port: settings.smtpPort ?? "587",
    user: settings.smtpUser ?? "",
    pass: settings.smtpPass ?? "",
    from: settings.smtpFrom ?? "",
    replyTo: settings.smtpReplyTo ?? "",
    secure: settings.smtpSecure ?? "false",
    orderEmailTo: settings.orderEmailTo ?? "",
  });

  // Časy state
  const [cutoffTime, setCutoffTime] = useState(settings.cutoffTime ?? "08:00");
  const [autoSendEnabled, setAutoSendEnabled] = useState(settings.autoSendEnabled === "true");
  const [autoSendTime, setAutoSendTime] = useState(settings.autoSendTime ?? "08:05");
  const [autoSendDays, setAutoSendDays] = useState<string[]>(
    (settings.autoSendDays ?? "Po,Út,St,Čt,Pá").split(",").map((d) => d.trim())
  );

  // Ceny state
  const [prices, setPrices] = useState({
    soup: settings.defaultSoupPrice ?? "30",
    meal: settings.defaultMealPrice ?? "110",
    roll: settings.priceRoll ?? "8",
    breadDumpling: settings.priceBreadDumpling ?? "12",
    potatoDumpling: settings.pricePotatoDumpling ?? "12",
    ketchup: settings.priceKetchup ?? "8",
    tatarka: settings.priceTatarka ?? "10",
    bbq: settings.priceBbq ?? "12",
  });

  // ── SMTP handlers ────────────────────────────────────────────────────────
  const handleSmtpTest = async () => {
    setSmtpStatus("idle");
    setSmtpMsg("Testuji připojení…");
    try {
      const res = await fetch(`/t/${tenantSlug}/api/smtp-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: smtp.host, port: smtp.port, user: smtp.user, pass: smtp.pass, secure: smtp.secure }),
      });
      const j = await res.json() as { ok: boolean; error?: string };
      setSmtpStatus(j.ok ? "ok" : "error");
      setSmtpMsg(j.ok ? "Připojení úspěšné ✓" : (j.error ?? "Neznámá chyba"));
    } catch {
      setSmtpStatus("error");
      setSmtpMsg("Chyba sítě");
    }
  };

  const handleSmtpSave = () => {
    startTransition(async () => {
      await actionSaveSettings({
        smtpHost: smtp.host,
        smtpPort: smtp.port,
        smtpUser: smtp.user,
        smtpPass: smtp.pass,
        smtpFrom: smtp.from,
        smtpReplyTo: smtp.replyTo,
        smtpSecure: smtp.secure,
        orderEmailTo: smtp.orderEmailTo,
      });
      setSmtpSaved(true);
      setTimeout(() => setSmtpSaved(false), 2000);
    });
  };

  const handleTimesSave = () => {
    startTransition(async () => {
      await actionSaveSettings({
        cutoffTime,
        autoSendEnabled: autoSendEnabled ? "true" : "false",
        autoSendTime,
        autoSendDays: autoSendDays.join(","),
      });
      setTimesSaved(true);
      setTimeout(() => setTimesSaved(false), 2000);
    });
  };

  const handlePricesSave = () => {
    startTransition(async () => {
      await actionSaveSettings({
        defaultSoupPrice: prices.soup,
        defaultMealPrice: prices.meal,
        priceRoll: prices.roll,
        priceBreadDumpling: prices.breadDumpling,
        pricePotatoDumpling: prices.potatoDumpling,
        priceKetchup: prices.ketchup,
        priceTatarka: prices.tatarka,
        priceBbq: prices.bbq,
      });
      setPricesSaved(true);
      setTimeout(() => setPricesSaved(false), 2000);
    });
  };

  const toggleDay = (day: string) => {
    setAutoSendDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // ── Department handlers ──────────────────────────────────────────────────
  const handleAddDept = async () => {
    if (!newDeptName.trim() || !newDeptLabel.trim()) return;
    setDeptError("");
    try {
      const added = await actionAddDepartment({ name: newDeptName.trim(), label: newDeptLabel.trim(), emailLabel: newDeptLabel.trim(), accent: newDeptAccent });
      setDepartments((d) => [...d, added]);
      setNewDeptName(""); setNewDeptLabel(""); setNewDeptAccent("blue");
      setShowAddDept(false);
    } catch (e) {
      setDeptError(e instanceof Error ? e.message : "Chyba");
    }
  };

  const handleStartEdit = (dept: DepartmentInfo) => {
    setDeptEditId(dept.id);
    setDeptEditLabel(dept.label);
    setDeptEditAccent(dept.accent);
  };

  const handleSaveEdit = async () => {
    if (!deptEditId) return;
    setDeptError("");
    try {
      await actionUpdateDepartment(deptEditId, { label: deptEditLabel, accent: deptEditAccent });
      setDepartments((d) => d.map((x) => x.id === deptEditId ? { ...x, label: deptEditLabel, accent: deptEditAccent } : x));
      setDeptEditId(null);
    } catch (e) {
      setDeptError(e instanceof Error ? e.message : "Chyba");
    }
  };

  const handleDeleteDept = async (dept: DepartmentInfo) => {
    setDeptDeleteConfirm(null);
    setDeptError("");
    try {
      await actionDeleteDepartment(dept.id);
      setDepartments((d) => d.filter((x) => x.id !== dept.id));
    } catch (e) {
      setDeptError(e instanceof Error ? e.message : "Chyba");
    }
  };

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    const reordered = [...departments];
    [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    setDepartments(reordered);
    startTransition(async () => { await actionReorderDepartments(reordered.map((d) => d.id)); });
  };

  const handleMoveDown = (idx: number) => {
    if (idx === departments.length - 1) return;
    const reordered = [...departments];
    [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
    setDepartments(reordered);
    startTransition(async () => { await actionReorderDepartments(reordered.map((d) => d.id)); });
  };

  return (
    <div className="k-shell">
      {/* Header */}
      <div
        className="px-5 py-3 border-b border-white/50 flex items-center gap-3 shrink-0"
        style={{ background: "rgba(255,255,255,0.28)" }}
      >
        <h2 className="font-display font-extrabold text-[18px] text-slate-900">Nastavení kantýny</h2>
        <span
          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: "rgba(16,185,129,0.12)", color: "#047857" }}
        >
          <MIcon name="lock_open" size={11} fill /> Admin
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scroll-area p-5">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 max-w-[1200px] pb-8">

          {/* ── SMTP ──────────────────────────────────────────────────── */}
          <div className="glass rounded-3xl p-5">
            <SectionHeader
              icon="mail" iconColor="#3B82F6" iconBg="rgba(59,130,246,0.14)"
              title="E-mail" subtitle="SMTP server pro odesílání objednávek"
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Příjemce (kuchyně)</span>
                <input className="k-field" value={smtp.orderEmailTo} onChange={(e) => setSmtp({ ...smtp, orderEmailTo: e.target.value })} placeholder="kuchyne@dodavatel.cz" />
              </label>
              <label>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">SMTP host</span>
                <input className="k-field" value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} placeholder="smtp.firma.cz" />
              </label>
              <label>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Port</span>
                <input className="k-field font-mono" value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: e.target.value })} placeholder="587" />
              </label>
              <label>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Uživatel</span>
                <input className="k-field" value={smtp.user} onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} autoComplete="off" />
              </label>
              <label>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Heslo</span>
                <input className="k-field font-mono" value={smtp.pass} onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })} type="password" autoComplete="new-password" />
              </label>
              <label className="col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Odesílatel (From)</span>
                <input className="k-field" value={smtp.from} onChange={(e) => setSmtp({ ...smtp, from: e.target.value })} placeholder="Kantýna &lt;office@firma.cz&gt;" />
              </label>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/55">
              <button
                type="button" onClick={handleSmtpTest} disabled={isPending}
                className="text-[11.5px] font-semibold text-amber-700 inline-flex items-center gap-1 hover:text-amber-900 transition"
              >
                <MIcon name="send" size={12} />
                {smtpMsg || "Poslat testovací e-mail"}
              </button>
              <button
                type="button" onClick={handleSmtpSave} disabled={isPending}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold font-display px-3.5 py-2 rounded-2xl text-white transition disabled:opacity-55"
                style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 6px 14px -6px rgba(234,88,12,0.4)" }}
              >
                <MIcon name="check" size={14} fill />
                {smtpSaved ? "Uloženo ✓" : "Uložit"}
              </button>
            </div>
            {smtpStatus !== "idle" && smtpMsg && (
              <p className={`mt-2 text-[11.5px] font-semibold ${smtpStatus === "ok" ? "text-emerald-700" : "text-rose-600"}`}>{smtpMsg}</p>
            )}
          </div>

          {/* ── Časy ──────────────────────────────────────────────────── */}
          <div className="glass rounded-3xl p-5">
            <SectionHeader
              icon="schedule" iconColor="#b45309" iconBg="rgba(245,158,11,0.14)"
              title="Časy" subtitle="Uzávěrka a automatické odesílání"
            />
            <div className="flex flex-col gap-3">
              <label>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Uzávěrka objednávek</span>
                <input className="k-field font-mono" value={cutoffTime} onChange={(e) => setCutoffTime(e.target.value)} placeholder="08:00" />
              </label>
              <div
                className="flex items-center justify-between p-3 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.65)" }}
              >
                <div>
                  <div className="text-[12.5px] font-semibold text-slate-900">Automaticky odeslat</div>
                  <div className="text-[11px] text-slate-500">Po uzávěrce odešle objednávku kuchyni</div>
                </div>
                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => setAutoSendEnabled((v) => !v)}
                  className="relative shrink-0"
                  aria-checked={autoSendEnabled}
                  role="switch"
                >
                  <div className={`w-10 h-[22px] rounded-full transition-colors ${autoSendEnabled ? "" : "bg-black/15"}`}
                    style={autoSendEnabled ? { background: "linear-gradient(135deg,#F59E0B,#EA580C)" } : {}} />
                  <div className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${autoSendEnabled ? "translate-x-[18px]" : ""}`} />
                </button>
              </div>
              {autoSendEnabled && (
                <>
                  <label>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Čas odeslání</span>
                    <input className="k-field font-mono" value={autoSendTime} onChange={(e) => setAutoSendTime(e.target.value)} placeholder="08:05" />
                  </label>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Dny v týdnu</span>
                    <div className="flex gap-1.5">
                      {DAY_ORDER.map((d) => {
                        const on = autoSendDays.includes(d);
                        return (
                          <button
                            key={d} type="button" onClick={() => toggleDay(d)}
                            className="flex-1 h-9 rounded-xl text-[12.5px] font-bold font-display transition"
                            style={on ? {
                              background: "linear-gradient(135deg,#F59E0B,#EA580C)",
                              color: "white",
                              boxShadow: "0 6px 14px -6px rgba(234,88,12,0.4)",
                            } : {
                              background: "rgba(255,255,255,0.55)",
                              border: "1px solid rgba(255,255,255,0.65)",
                              color: "#94a3b8",
                            }}
                          >{d}</button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end mt-4 pt-3 border-t border-white/55">
              <button
                type="button" onClick={handleTimesSave} disabled={isPending}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold font-display px-3.5 py-2 rounded-2xl text-white transition disabled:opacity-55"
                style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 6px 14px -6px rgba(234,88,12,0.4)" }}
              >
                <MIcon name="check" size={14} fill />
                {timesSaved ? "Uloženo ✓" : "Uložit"}
              </button>
            </div>
          </div>

          {/* ── Oddělení ──────────────────────────────────────────────── */}
          <div className="glass rounded-3xl p-5">
            <SectionHeader
              icon="business" iconColor="#4F8A53" iconBg="rgba(79,138,83,0.14)"
              title="Oddělení" subtitle={`${departments.filter((d) => d.active).length} aktivních oddělení`}
              action={
                <button
                  type="button" onClick={() => { setShowAddDept((v) => !v); setDeptError(""); }}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1.5 rounded-xl glass-btn text-slate-600"
                >
                  <MIcon name="add" size={13} fill /> Přidat
                </button>
              }
            />

            {deptError && (
              <div className="mb-3 text-[12px] text-rose-600 flex items-center gap-1.5">
                <MIcon name="error" size={13} style={{ color: "#dc2626" }} /> {deptError}
              </div>
            )}

            {/* Add dept form */}
            {showAddDept && (
              <div className="mb-3 p-3 rounded-2xl flex flex-col gap-2.5"
                style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.65)" }}>
                <div className="grid grid-cols-2 gap-2">
                  <label>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Klíč (bez mezer)</span>
                    <input className="k-field font-mono" value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} placeholder="kancelar" />
                  </label>
                  <label>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Název</span>
                    <input className="k-field" value={newDeptLabel} onChange={(e) => setNewDeptLabel(e.target.value)} placeholder="Kanceláře" />
                  </label>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Barva</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {Object.entries(ACCENT_COLORS).map(([key, color]) => (
                      <button key={key} type="button" onClick={() => setNewDeptAccent(key)}
                        className="w-7 h-7 rounded-full transition"
                        style={{
                          background: color,
                          boxShadow: newDeptAccent === key ? `0 0 0 2px white, 0 0 0 4px ${color}` : undefined,
                        }} />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={handleAddDept} disabled={!newDeptName.trim() || !newDeptLabel.trim() || isPending}
                    className="inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-xl text-white disabled:opacity-50 transition"
                    style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}>
                    <MIcon name="add" size={13} fill /> Přidat
                  </button>
                  <button type="button" onClick={() => setShowAddDept(false)}
                    className="text-[12px] font-semibold px-3 py-1.5 rounded-xl glass-btn text-slate-600">
                    Zrušit
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {departments.map((dept, idx) => (
                <div key={dept.id}>
                  {deptEditId === dept.id ? (
                    <div className="p-3 rounded-2xl flex flex-col gap-2.5"
                      style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.65)" }}>
                      <label>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Název</span>
                        <input className="k-field" value={deptEditLabel} onChange={(e) => setDeptEditLabel(e.target.value)} />
                      </label>
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Barva</span>
                        <div className="flex gap-1.5 flex-wrap">
                          {Object.entries(ACCENT_COLORS).map(([key, color]) => (
                            <button key={key} type="button" onClick={() => setDeptEditAccent(key)}
                              className="w-7 h-7 rounded-full transition"
                              style={{
                                background: color,
                                boxShadow: deptEditAccent === key ? `0 0 0 2px white, 0 0 0 4px ${color}` : undefined,
                              }} />
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={handleSaveEdit} disabled={isPending}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-xl text-white transition"
                          style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)" }}>
                          <MIcon name="check" size={13} fill /> Uložit
                        </button>
                        <button type="button" onClick={() => setDeptEditId(null)}
                          className="text-[12px] font-semibold px-3 py-1.5 rounded-xl glass-btn text-slate-600">
                          Zrušit
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-2xl"
                      style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.65)", opacity: dept.active ? 1 : 0.5 }}>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button type="button" onClick={() => handleMoveUp(idx)} disabled={idx === 0}
                          className="w-6 h-6 rounded-lg inline-flex items-center justify-center text-slate-300 hover:text-slate-600 disabled:opacity-20 transition">
                          <MIcon name="arrow_upward" size={13} />
                        </button>
                        <button type="button" onClick={() => handleMoveDown(idx)} disabled={idx === departments.length - 1}
                          className="w-6 h-6 rounded-lg inline-flex items-center justify-center text-slate-300 hover:text-slate-600 disabled:opacity-20 transition">
                          <MIcon name="arrow_downward" size={13} />
                        </button>
                      </div>
                      <span className="w-3 h-3 rounded-full shrink-0"
                        style={{ background: ACCENT_COLORS[dept.accent] ?? "#999" }} />
                      <span className="flex-1 font-display font-semibold text-[13px] text-slate-900">{dept.label}</span>
                      {!dept.active && <span className="text-[10px] text-slate-400 italic">neaktivní</span>}
                      <button type="button" onClick={() => handleStartEdit(dept)}
                        className="w-7 h-7 rounded-xl inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-white/70 transition">
                        <MIcon name="edit" size={14} />
                      </button>
                      <button type="button" onClick={() => setDeptDeleteConfirm(dept)}
                        className="w-7 h-7 rounded-xl inline-flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50/70 transition">
                        <MIcon name="delete" size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Ceny ──────────────────────────────────────────────────── */}
          <div className="glass rounded-3xl p-5">
            <SectionHeader
              icon="payments" iconColor="#EA580C" iconBg="rgba(234,88,12,0.14)"
              title="Ceny" subtitle="Výchozí ceny v Kč"
            />
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Výchozí polévka</span>
                <div className="relative">
                  <input className="k-field font-mono pr-12" value={prices.soup} onChange={(e) => setPrices({ ...prices, soup: e.target.value })} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400">Kč</span>
                </div>
              </label>
              <label>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Výchozí jídlo</span>
                <div className="relative">
                  <input className="k-field font-mono pr-12" value={prices.meal} onChange={(e) => setPrices({ ...prices, meal: e.target.value })} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400">Kč</span>
                </div>
              </label>
              <div className="col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Příplatky</span>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["Houska", "roll"],
                    ["Houskový knedlík", "breadDumpling"],
                    ["Bramborový knedlík", "potatoDumpling"],
                    ["Kečup", "ketchup"],
                    ["Tatarka", "tatarka"],
                    ["BBQ", "bbq"],
                  ] as const).map(([label, key]) => (
                    <div key={key} className="flex items-center gap-2 p-2 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.65)" }}>
                      <span className="flex-1 text-[12px] text-slate-700">{label}</span>
                      <input
                        className="w-12 bg-transparent text-right font-mono text-[12px] font-semibold text-slate-900 outline-none"
                        value={prices[key]}
                        onChange={(e) => setPrices({ ...prices, [key]: e.target.value })}
                      />
                      <span className="text-[10px] text-slate-400">Kč</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4 pt-3 border-t border-white/55">
              <button
                type="button" onClick={handlePricesSave} disabled={isPending}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold font-display px-3.5 py-2 rounded-2xl text-white transition disabled:opacity-55"
                style={{ background: "linear-gradient(135deg,#F59E0B,#EA580C)", boxShadow: "0 6px 14px -6px rgba(234,88,12,0.4)" }}
              >
                <MIcon name="check" size={14} fill />
                {pricesSaved ? "Uloženo ✓" : "Uložit"}
              </button>
            </div>
          </div>

        </div>
      </div>

      {deptDeleteConfirm && (
        <ConfirmModal
          title="Smazat oddělení"
          message={`Opravdu smazat oddělení „${deptDeleteConfirm.label}"? Tuto akci nelze vrátit.`}
          confirmLabel="Smazat"
          onConfirm={() => handleDeleteDept(deptDeleteConfirm)}
          onClose={() => setDeptDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
