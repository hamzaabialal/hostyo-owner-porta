"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import MobileTabs from "@/components/MobileTabs";
import FilterDropdown from "@/components/FilterDropdown";
import DateRangePicker from "@/components/DateRangePicker";
import ExportModal from "@/components/ExportModal";
import { useData } from "@/lib/DataContext";

const FINANCE_TABS = [
  { label: "Overview", href: "/finances", exact: true },
  { label: "Earnings", href: "/finances/earnings" },
  { label: "Expenses", href: "/finances/expenses" },
];

/* ================================================================
   Types
   ================================================================ */
interface Expense {
  id: string;
  expenseId: string;
  date: string;
  property: string;
  reservation: string;
  category: string;
  vendor: string;
  amount: number;
  status: string;
  proof: string[];
  deducted: boolean;
  causedHold: boolean;
}

/* ================================================================
   Helpers
   ================================================================ */
function exportExpensesCSV(rows: Expense[], filename: string) {
  const headers = ["Expense ID", "Date", "Property", "Reservation", "Category", "Vendor", "Amount", "Status"];
  const csvRows = [headers.join(",")];
  for (const r of rows) {
    csvRows.push([
      r.expenseId, r.date, `"${r.property}"`, r.reservation, r.category, `"${r.vendor}"`,
      r.amount.toFixed(2), r.status,
    ].join(","));
  }
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const fmtDate = (d: string) => {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const fmtMoney = (n: number) =>
  "€" + n.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pillClass = (s: string) => {
  const key = s.toLowerCase().replace(/\s+/g, "-");
  return "pill pill-" + key;
};

const groupTabs = ["All Expenses", "By Property", "By Category", "By Vendor", "By Status"] as const;


/* ================================================================
   SVG Icons (inline)
   ================================================================ */
const CameraIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
  </svg>
);

const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
);

// CheckCircleIcon removed — no longer used after Deducted column was removed

const DashIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className ?? "w-[18px] h-[18px]"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[18px] h-[18px]">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);

/* ================================================================
   Component
   ================================================================ */
function ShareableExpenseLink({ reservation }: { reservation: string }) {
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Build the link from the reservation ref — we need to find the reservation's Notion ID
  const generateLink = async () => {
    setLoading(true);
    try {
      // Fetch reservations to find the matching one
      const res = await fetch("/api/reservations");
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const match = (data.data || []).find((r: any) => r.ref && reservation.includes(r.ref.slice(0, 10)));
      if (match?.notionId) {
        const genRes = await fetch("/api/submit/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservationId: match.notionId }),
        });
        const genData = await genRes.json();
        if (genData.ok) setLink(genData.url);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (link) {
    return (
      <div className="flex items-center gap-2 p-2.5 bg-[#f8f8f8] border border-[#e2e2e2] rounded-lg">
        <input type="text" value={link} readOnly className="flex-1 text-[10px] text-[#555] bg-transparent outline-none font-mono truncate" />
        <button onClick={copyLink} className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${copied ? "bg-[#EAF3EF] text-[#2F6B57]" : "bg-[#80020E] text-white hover:bg-[#6b010c]"}`}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    );
  }

  return (
    <button onClick={generateLink} disabled={loading}
      className="flex items-center gap-1.5 px-3 py-2 border border-[#80020E] text-[#80020E] bg-transparent rounded-lg text-[11px] font-semibold hover:bg-[#80020E]/5 transition-colors disabled:opacity-50">
      {loading ? <div className="w-3 h-3 border-2 border-[#80020E] border-t-transparent rounded-full animate-spin" /> : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
      )}
      {loading ? "Generating..." : "Get Vendor Link"}
    </button>
  );
}

function PropertyExpenseLink({ property }: { property: string }) {
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateLink = async () => {
    if (!property) return;
    setLoading(true);
    try {
      // Find the property's Notion ID to generate a submission link
      const res = await fetch("/api/properties");
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const match = (data.data || []).find((p: any) => p.name?.trim() === property?.trim());
      if (match?.id) {
        // Use the property's first reservation or create a generic link
        const resRes = await fetch("/api/reservations");
        const resData = await resRes.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const propRes = (resData.data || []).find((r: any) => r.property?.trim() === property?.trim());
        if (propRes?.notionId) {
          const genRes = await fetch("/api/submit/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reservationId: propRes.notionId }),
          });
          const genData = await genRes.json();
          if (genData.ok) setLink(genData.url);
        }
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (link) {
    return (
      <div className="flex items-center gap-2 p-2.5 bg-[#f8f8f8] border border-[#e2e2e2] rounded-lg">
        <input type="text" value={link} readOnly className="flex-1 text-[10px] text-[#555] bg-transparent outline-none font-mono truncate" />
        <button onClick={copyLink} className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${copied ? "bg-[#EAF3EF] text-[#2F6B57]" : "bg-[#80020E] text-white hover:bg-[#6b010c]"}`}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    );
  }

  return (
    <button onClick={generateLink} disabled={loading || !property}
      className="flex items-center gap-1.5 px-3 py-2 border border-[#80020E] text-[#80020E] bg-transparent rounded-lg text-[11px] font-semibold hover:bg-[#80020E]/5 transition-colors disabled:opacity-50">
      {loading ? <div className="w-3 h-3 border-2 border-[#80020E] border-t-transparent rounded-full animate-spin" /> : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
      )}
      {loading ? "Generating..." : "Get Vendor Link"}
    </button>
  );
}

function ExpensesPageInner() {
  const { fetchData } = useData();
  const searchParams = useSearchParams();
  const [apiExpenses, setApiExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("All Expenses");
  const [filterProperty, setFilterProperty] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    fetchData("expenses", "/api/expenses")
      .then((res: unknown) => {
        const d = res as { data?: Expense[] };
        if (d.data) {
          setApiExpenses(d.data);
          // Auto-open drawer if ?open= param is present
          const openId = searchParams.get("open");
          if (openId) {
            const match = d.data.find((e) => e.id === openId);
            if (match) {
              setSelectedExpense(match);
              setDrawerOpen(true);
            }
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allExpenses = apiExpenses;

  const propertyList = useMemo(() =>
    Array.from(new Set(allExpenses.map((e) => e.property))).filter(Boolean).sort(),
  [allExpenses]);

  const statusList = useMemo(() =>
    Array.from(new Set(allExpenses.map((e) => e.status))).filter(Boolean).sort(),
  [allExpenses]);

  /* Filtering */
  const filtered = useMemo(() => allExpenses.filter((exp) => {
    if (filterProperty && exp.property !== filterProperty) return false;
    if (filterStatus && exp.status !== filterStatus) return false;
    if (dateFrom && exp.date < dateFrom) return false;
    if (dateTo && exp.date > dateTo) return false;
    if (search) {
      const haystack = [exp.expenseId, exp.property, exp.reservation, exp.category, exp.vendor, exp.amount.toString()]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search.toLowerCase().trim())) return false;
    }
    return true;
  }), [allExpenses, filterProperty, filterStatus, dateFrom, dateTo, search]);

  /* Grouping for tabs */
  const grouped = useMemo(() => {
    if (activeTab === "All Expenses") return null;
    const keyFn = (exp: Expense): string => {
      switch (activeTab) {
        case "By Property": return exp.property || "No Property";
        case "By Category": return exp.category || "No Category";
        case "By Vendor": return exp.vendor || "No Vendor";
        case "By Status": return exp.status || "No Status";
        default: return "";
      }
    };
    const groups: Record<string, { items: Expense[]; total: number }> = {};
    for (const exp of filtered) {
      const key = keyFn(exp);
      if (!groups[key]) groups[key] = { items: [], total: 0 };
      groups[key].items.push(exp);
      groups[key].total += exp.amount || 0;
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, activeTab]);

  /* Drawer */
  const openDrawer = (exp: Expense) => {
    setSelectedExpense(exp);
    setDrawerOpen(true);
  };

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedExpense(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeDrawer]);

  /* Lock body scroll when drawer is open */
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  /* Attachment row helper */
  const AttachmentItem = ({ type, name, size }: { type: "photo" | "file"; name: string; size: string }) => (
    <div className="flex items-center gap-3 p-3 border border-[#eaeaea] rounded-lg cursor-pointer transition-colors hover:bg-[#fafafa]">
      <div className="w-12 h-12 rounded-md bg-[#f5f5f5] flex items-center justify-content shrink-0 overflow-hidden">
        {type === "photo" ? (
          <div className="w-full h-full bg-gradient-to-br from-[#e8e8e8] to-[#d0d0d0] flex items-center justify-center text-[#999]">
            <CameraIcon />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#999]">
            <FileIcon />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[#111] truncate">{name}</div>
        <div className="text-xs text-[#999]">{type === "photo" ? "JPEG Image" : "PDF Document"} &middot; {size}</div>
      </div>
    </div>
  );

  /* Impact indicator helper */

  if (loading) {
    return (
      <AppShell title="Expenses">
        <div className="flex items-center justify-center h-64 text-text-tertiary text-sm">Loading expenses...</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Expenses">
      <MobileTabs tabs={FINANCE_TABS} />
      <div className="text-[13px] text-[#888] mb-5 -mt-1 hidden md:block">
        Expenses and deductions linked to your properties.
      </div>
      {/* ── Group Tabs — ghost style ── */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 hide-scrollbar">
        {groupTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 md:px-4 py-1.5 rounded-lg border text-[11px] md:text-[12px] font-medium cursor-pointer transition-all whitespace-nowrap flex-shrink-0 ${
              activeTab === tab
                ? "text-[#80020E] border-[#80020E] bg-[#80020E]/5"
                : "text-[#888] border-transparent hover:text-[#555] hover:bg-[#f5f5f5]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Mobile Filters ── */}
      <div className="flex items-center gap-2 mb-4 md:hidden flex-wrap">
        <FilterDropdown value={filterProperty} onChange={setFilterProperty} placeholder="Properties" options={propertyList.map((p) => ({ value: p, label: p }))} searchable />
        <FilterDropdown value={filterStatus} onChange={setFilterStatus} placeholder="Status" options={statusList.map((s) => ({ value: s, label: s }))} />
        <button onClick={() => setExportOpen(true)}
          className="ml-auto p-2 rounded-lg border border-[#e2e2e2] text-[#555] hover:border-[#80020E] hover:text-[#80020E] hover:bg-[#80020E]/5 transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
      </div>
      {/* ── Desktop Filter Bar ── */}
      <div className="hidden md:flex items-center gap-3 mb-5">
        <FilterDropdown value={filterProperty} onChange={setFilterProperty} placeholder="All Properties" options={propertyList.map((p) => ({ value: p, label: p }))} searchable />
        <FilterDropdown value={filterStatus} onChange={setFilterStatus} placeholder="All Statuses" options={statusList.map((s) => ({ value: s, label: s }))} />
        <DateRangePicker from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search expenses..."
              className="h-[38px] pl-9 pr-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] bg-white min-w-[180px] outline-none transition-colors focus:border-[#80020E] placeholder:text-[#999]" />
          </div>
          <button onClick={() => setExportOpen(true)}
            className="flex items-center gap-1.5 h-[38px] px-3.5 rounded-lg border border-[#e2e2e2] text-[12px] font-medium text-[#555] hover:border-[#80020E] hover:text-[#80020E] hover:bg-[#80020E]/5 transition-all flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
        </div>
      </div>

      {/* ── Grouped View ── */}
      {grouped ? (
        <div className="space-y-4">
          {grouped.length === 0 ? (
            <div className="bg-white border border-[#eaeaea] rounded-xl py-10 text-center text-[#999] text-sm">No expenses match your filters.</div>
          ) : grouped.map(([groupName, { items, total }]) => (
            <div key={groupName} className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 md:px-4 py-2.5 md:py-3 bg-[#fafafa] border-b border-[#eaeaea]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[12px] md:text-[13px] font-semibold text-[#111] truncate">{groupName}</span>
                  <span className="text-[10px] text-[#999] bg-[#f0f0f0] px-1.5 py-0.5 rounded-full flex-shrink-0">{items.length}</span>
                </div>
                <span className="text-[12px] md:text-[13px] font-semibold text-[#111] tabular-nums flex-shrink-0 ml-2">{fmtMoney(total)}</span>
              </div>
              <div className="divide-y divide-[#f3f3f3]">
                {items.map((exp) => (
                  <div key={exp.id} onClick={() => openDrawer(exp)} className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-3 cursor-pointer hover:bg-[#fafafa] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-mono text-[#80020E] font-semibold">{exp.expenseId}</span>
                        {exp.category && <span className="text-[10px] text-[#555] bg-[#f5f5f5] px-1.5 py-0.5 rounded">{exp.category}</span>}
                      </div>
                      <div className="text-[11px] text-[#999] mt-0.5 truncate">
                        {exp.property}{exp.vendor ? ` · ${exp.vendor}` : ""}{exp.date ? ` · ${fmtDate(exp.date)}` : ""}
                      </div>
                    </div>
                    <div className="text-[12px] md:text-[13px] font-semibold text-[#111] tabular-nums flex-shrink-0">{exp.amount ? fmtMoney(exp.amount) : "—"}</div>
                    <span className={`flex-shrink-0 hidden md:inline-flex ${pillClass(exp.status)}`}>{exp.status}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="text-[13px] text-[#999] px-1">
            Showing <span className="font-semibold text-[#555]">{filtered.length}</span> of{" "}
            <span className="font-semibold text-[#555]">{allExpenses.length}</span> expenses in{" "}
            <span className="font-semibold text-[#555]">{grouped.length}</span> groups
          </div>
        </div>
      ) : (
        <>
        {/* ── Mobile Card View ── */}
        <div className="md:hidden space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-[#999] text-sm">No expenses match your filters.</div>
          ) : filtered.map((exp) => (
            <div key={exp.id} onClick={() => openDrawer(exp)} className="bg-white border border-[#eaeaea] rounded-xl p-3.5 cursor-pointer hover:shadow-sm transition-all overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="font-mono text-[10px] font-semibold text-[#80020E] truncate">{exp.expenseId}</span>
                <span className={`flex-shrink-0 ${pillClass(exp.status)}`}>{exp.status}</span>
              </div>
              <div className="text-[13px] font-semibold text-[#111] mb-0.5 truncate">{exp.property || "—"}</div>
              {exp.category && <span className="text-[10px] text-[#555] bg-[#f5f5f5] px-1.5 py-0.5 rounded inline-block mb-1">{exp.category}</span>}
              <div className="text-[11px] text-[#888] mb-2 truncate">{exp.vendor ? `${exp.vendor} · ` : ""}{fmtDate(exp.date)}</div>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[#111] tabular-nums">{exp.amount ? fmtMoney(exp.amount) : "—"}</span>
                {exp.proof && exp.proof.length > 0 && (
                  <span className="text-[9px] text-[#999] bg-[#f5f5f5] px-1.5 py-0.5 rounded">{exp.proof.length} file{exp.proof.length !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Desktop Table View ── */}
        <div className="hidden md:block bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr>
                  {["Status", "Created", "Property", "Reservation", "Vendor", "Category", "Proof", "Amount"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left text-[11px] font-semibold text-[#999] uppercase tracking-wider px-3.5 py-3.5 border-b border-[#eaeaea] whitespace-nowrap bg-white sticky top-0"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-[#999] text-sm">
                      No expenses match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((exp) => (
                    <tr
                      key={exp.id}
                      onClick={() => openDrawer(exp)}
                      className="cursor-pointer transition-colors hover:bg-[#fafafa] border-b border-[#f3f3f3] last:border-b-0"
                    >
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className={pillClass(exp.status)}>{exp.status}</span>
                      </td>
                      <td className="px-3.5 py-3 text-[13px] text-[#555] whitespace-nowrap">{fmtDate(exp.date)}</td>
                      <td className="px-3.5 py-3 text-[13px] font-medium text-[#111] whitespace-nowrap">{exp.property}</td>
                      <td className="px-3.5 py-3 text-xs text-[#555] whitespace-nowrap">{exp.reservation || "\u2014"}</td>
                      <td className="px-3.5 py-3 text-[13px] font-medium text-[#111] whitespace-nowrap">{exp.vendor || "\u2014"}</td>
                      <td className="px-3.5 py-3 text-[13px] whitespace-nowrap">
                        {exp.category ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#555] bg-[#f5f5f5] px-2.5 py-0.5 rounded-md">
                            {exp.category}
                          </span>
                        ) : "\u2014"}
                      </td>
                      <td className="px-3.5 py-3">
                        {exp.proof && exp.proof.length > 0 ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); openDrawer(exp); }}
                            title="View proof"
                            className="w-[30px] h-[30px] rounded-md border border-[#eaeaea] bg-white inline-flex items-center justify-center cursor-pointer transition-colors text-[#555] hover:bg-[#f5f5f5] hover:border-[#ccc] hover:text-[#80020E]"
                          >
                            <FileIcon />
                          </button>
                        ) : (
                          <span className="text-[#ccc]"><DashIcon /></span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 text-[13px] font-semibold text-[#111] whitespace-nowrap tabular-nums">{exp.amount ? fmtMoney(exp.amount) : "\u2014"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-[18px] py-3.5 border-t border-[#eaeaea]">
            <div className="text-[13px] text-[#999]">
              Showing <span className="font-semibold text-[#555]">{filtered.length}</span> of{" "}
              <span className="font-semibold text-[#555]">{allExpenses.length}</span> expenses
            </div>
          </div>
        </div>
        </>
      )}

      {/* ── Drawer Overlay ── */}
      <div
        className={`drawer-overlay ${drawerOpen ? "open" : ""}`}
        onClick={closeDrawer}
      />

      {/* ── Slide-over Drawer ── */}
      <div className={`drawer-panel ${drawerOpen ? "open" : ""}`}>
        {selectedExpense && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#eaeaea] shrink-0">
              <h2 className="text-base font-bold text-[#111]">Expense Details</h2>
              <button
                onClick={closeDrawer}
                className="w-8 h-8 rounded-md border border-[#eaeaea] bg-white flex items-center justify-center cursor-pointer transition-colors text-[#555] hover:bg-[#f5f5f5] hover:text-[#111]"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Amount */}
              <div className="text-[32px] font-bold text-[#111] tracking-tight mb-5">
                {fmtMoney(selectedExpense.amount)}
              </div>

              {/* Expense Info */}
              <div className="mb-7">
                <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wider mb-3.5">Expense Info</div>
                {[
                  { label: "Expense ID", value: <span className="font-mono text-[#80020E] font-semibold">{selectedExpense.expenseId}</span> },
                  { label: "Category", value: selectedExpense.category || "\u2014" },
                  { label: "Created", value: fmtDate(selectedExpense.date) },
                  { label: "Vendor", value: selectedExpense.vendor || "\u2014" },
                  { label: "Property", value: selectedExpense.property || "\u2014" },
                  { label: "Reservation", value: selectedExpense.reservation || "\u2014" },
                  { label: "Status", value: <span className={pillClass(selectedExpense.status)}>{selectedExpense.status}</span> },
                ].map((row) => (
                  <div key={row.label} className="flex items-start justify-between py-2.5 border-b border-[#f3f3f3] last:border-b-0">
                    <span className="text-[13px] font-medium text-[#555]">{row.label}</span>
                    <span className="text-[13px] font-medium text-[#111] text-right max-w-[60%]">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Notes & Description */}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(((selectedExpense as any).notes) || ((selectedExpense as any).description)) && (
                <div className="mb-7">
                  <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wider mb-3.5">Notes & Description</div>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(selectedExpense as any).description && (
                    <div className="mb-2">
                      <div className="text-[11px] font-medium text-[#888] mb-1">Description</div>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <div className="text-[13px] text-[#333] bg-[#fafafa] rounded-lg p-3 border border-[#f0f0f0]">{(selectedExpense as any).description}</div>
                    </div>
                  )}
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(selectedExpense as any).notes && (selectedExpense as any).notes !== (selectedExpense as any).description && (
                    <div>
                      <div className="text-[11px] font-medium text-[#888] mb-1">Notes</div>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <div className="text-[13px] text-[#333] bg-[#fafafa] rounded-lg p-3 border border-[#f0f0f0] whitespace-pre-wrap">{(selectedExpense as any).notes}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Attachments / Proof */}
              {selectedExpense.proof && selectedExpense.proof.length > 0 && (
                <div className="mb-7">
                  <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wider mb-3.5">Proof / Attachments ({selectedExpense.proof.length})</div>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedExpense.proof.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-[#e2e2e2] hover:border-[#80020E] transition-colors">
                        {url.startsWith("data:image") || url.match(/\.(jpg|jpeg|png|webp|gif)/i) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt={`Proof ${i + 1}`} className="w-full h-[80px] object-cover" />
                        ) : (
                          <div className="h-[80px] flex items-center justify-center bg-[#f5f5f5]">
                            <AttachmentItem type="file" name={`File ${i + 1}`} size="" />
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Actions */}
              <div className="mb-7">
                <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wider mb-3.5">Admin Actions</div>

                {/* Change Status — dropdown */}
                <div className="mb-4">
                  <label className="block text-[12px] font-medium text-[#888] mb-1.5">Update Status</label>
                  <select
                    value={selectedExpense.status}
                    onChange={async (e) => {
                      const newStatus = e.target.value;
                      try {
                        await fetch(`/api/expenses/${selectedExpense.id}`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: newStatus }),
                        });
                        setSelectedExpense({ ...selectedExpense, status: newStatus });
                      } catch { /* ignore */ }
                    }}
                    className="w-full h-[38px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] bg-white outline-none focus:border-[#80020E] transition-colors appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
                  >
                    {["Scheduled", "In Review", "Approved", "Revision Requested", "Paid"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Change Category — dropdown */}
                <div className="mb-4">
                  <label className="block text-[12px] font-medium text-[#888] mb-1.5">Update Category</label>
                  <select
                    value={selectedExpense.category || ""}
                    onChange={async (e) => {
                      const newCat = e.target.value;
                      try {
                        const res = await fetch(`/api/expenses/${selectedExpense.id}`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ category: newCat }),
                        });
                        const data = await res.json();
                        if (data.ok) {
                          setSelectedExpense({ ...selectedExpense, category: newCat });
                        } else {
                          console.error("Category update failed:", data.error);
                          alert("Category update failed: " + data.error);
                        }
                      } catch (err) { console.error("Category update error:", err); }
                    }}
                    className="w-full h-[38px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] bg-white outline-none focus:border-[#80020E] transition-colors appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
                  >
                    <option value="">Select category</option>
                    {["Maintenance", "Plumbing", "Electrical", "Cleaning", "Laundry", "Supplies", "Repair", "Other"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Update Price */}
                <div className="mb-4">
                  <label className="block text-[12px] font-medium text-[#888] mb-1.5">Update Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[#999]">€</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      defaultValue={selectedExpense.amount || 0}
                      onBlur={async (e) => {
                        const val = parseFloat(e.target.value) || 0;
                        if (val === selectedExpense.amount) return;
                        try {
                          const res = await fetch(`/api/expenses/${selectedExpense.id}`, {
                            method: "PATCH", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ amount: val }),
                          });
                          const data = await res.json();
                          if (data.ok) {
                            setSelectedExpense({ ...selectedExpense, amount: val });
                            e.target.style.borderColor = "#2F6B57";
                            setTimeout(() => { e.target.style.borderColor = ""; }, 1500);
                          } else {
                            e.target.style.borderColor = "#FF5A5F";
                            console.error("Price update failed:", data.error);
                          }
                        } catch (err) { console.error("Price update error:", err); }
                      }}
                      className="w-full h-[38px] pl-7 pr-3 border border-[#e2e2e2] rounded-lg text-[13px] font-semibold text-[#111] bg-white outline-none focus:border-[#80020E] transition-colors"
                    />
                  </div>
                  <p className="text-[10px] text-[#bbb] mt-1">Auto-saves when you click outside the field.</p>
                </div>

                {/* Update Vendor Name */}
                <div className="mb-4">
                  <label className="block text-[12px] font-medium text-[#888] mb-1.5">Update Vendor</label>
                  <input
                    type="text"
                    defaultValue={selectedExpense.vendor || ""}
                    placeholder="Vendor name"
                    onBlur={async (e) => {
                      const val = e.target.value.trim();
                      if (val === (selectedExpense.vendor || "")) return;
                      try {
                        const res = await fetch(`/api/expenses/${selectedExpense.id}`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ vendor: val }),
                        });
                        const data = await res.json();
                        if (data.ok) {
                          setSelectedExpense({ ...selectedExpense, vendor: val });
                          e.target.style.borderColor = "#2F6B57";
                          setTimeout(() => { e.target.style.borderColor = ""; }, 1500);
                        } else {
                          e.target.style.borderColor = "#FF5A5F";
                          console.error("Vendor update failed:", data.error);
                        }
                      } catch (err) { console.error("Vendor update error:", err); }
                    }}
                    className="w-full h-[38px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] bg-white outline-none focus:border-[#80020E] transition-colors"
                  />
                  <p className="text-[10px] text-[#bbb] mt-1">Auto-saves when you click outside the field.</p>
                </div>

                {/* Shareable Vendor Link */}
                <div className="mb-4">
                  <label className="block text-[12px] font-medium text-[#888] mb-1.5">Vendor Submission Link</label>
                  {selectedExpense.reservation ? (
                    <ShareableExpenseLink reservation={selectedExpense.reservation} />
                  ) : (
                    <PropertyExpenseLink property={selectedExpense.property} />
                  )}
                </div>

                {/* Delete */}
                <button onClick={async () => {
                  if (!confirm("Are you sure you want to delete this expense?")) return;
                  try {
                    await fetch(`/api/expenses/${selectedExpense.id}`, { method: "DELETE" });
                    closeDrawer();
                    window.location.reload();
                  } catch { /* ignore */ }
                }} className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-[#7A5252] hover:bg-[#F6EDED] rounded-lg transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  Delete expense
                </button>
              </div>

              {/* Internal Notes (admin only) */}
              <div>
                <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wider mb-3.5">Internal Notes</div>
                <textarea
                  defaultValue={(selectedExpense as unknown as Record<string, string>).notes || ""}
                  placeholder="Add internal notes (not visible to vendor)..."
                  rows={3}
                  onBlur={async (e) => {
                    const val = e.target.value;
                    try {
                      await fetch(`/api/expenses/${selectedExpense.id}`, {
                        method: "PATCH", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ notes: val }),
                      });
                    } catch { /* ignore */ }
                  }}
                  className="w-full px-3.5 py-3 border border-[#e2e2e2] rounded-xl text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors resize-none bg-white"
                />
                <p className="text-[10px] text-[#bbb] mt-1">Auto-saves when you click outside the field.</p>
              </div>
            </div>
          </>
        )}
      </div>
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        recordCount={filtered.length}
        filters={[
          ...(filterProperty ? [{ label: filterProperty }] : [{ label: "All properties" }]),
          ...(filterStatus ? [{ label: filterStatus }] : [{ label: "All statuses" }]),
          ...(dateFrom && dateTo ? [{ label: `${dateFrom} – ${dateTo}` }] : []),
        ]}
        onExport={(format, options) => {
          if (format === "csv") {
            exportExpensesCSV(filtered, `expenses-${new Date().toISOString().slice(0, 10)}.csv`);
          } else {
            const fmt = (n: number) => options.currency ? `€${Math.abs(n).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : n.toFixed(2);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const expenseCards = filtered.map((r: any) => {
              const proofHtml = (r.proof && r.proof.length > 0)
                ? r.proof.map((url: string, i: number) => {
                    const isPdf = url.match(/\.pdf/i);
                    if (isPdf) {
                      const fname = url.split("/").pop() || `File ${i + 1}`;
                      return `<div style="border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin-bottom:8px;background:#fafafa;display:flex;align-items:center;gap:8px">
                        <span style="font-size:11px;font-weight:600;color:#80020E;background:#F6EDED;padding:3px 8px;border-radius:4px">PDF</span>
                        <span style="font-size:11px;color:#555;word-break:break-all">${fname}</span>
                      </div>`;
                    }
                    return `<img src="${url}" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px;border:1px solid #e5e5e5;margin-bottom:8px" />`;
                  }).join("")
                : '<div style="color:#bbb;font-size:11px;font-style:italic">No receipts attached</div>';

              const desc = r.description || "";
              const statusDot = r.status === "Approved" || r.status === "Paid" ? "#2F6B57" : r.status === "In Review" ? "#8A6A2E" : "#999";

              return `<div style="display:flex;gap:32px;padding:28px 0;border-bottom:1px solid #eee">
                <div style="flex:1;min-width:0">
                  <div style="font-size:14px;font-weight:700;color:#111;margin-bottom:2px">${r.category || "Expense"} ${desc ? "— " + desc : ""}</div>
                  <div style="font-size:11px;color:#999;margin-bottom:12px">${r.date || ""}</div>
                  <div style="font-size:28px;font-weight:700;color:#111;margin-bottom:4px">${fmt(r.amount)}</div>
                  <div style="font-size:10px;color:#aaa;margin-bottom:16px">incl. VAT</div>
                  <table style="width:100%;font-size:12px;border-collapse:collapse">
                    <tr><td style="color:#999;padding:4px 0;width:90px">CATEGORY</td><td style="color:#111;font-weight:500;padding:4px 0">${r.category || "—"}</td></tr>
                    <tr><td style="color:#999;padding:4px 0">VENDOR</td><td style="color:#111;font-weight:500;padding:4px 0">${r.vendor || "—"}</td></tr>
                    <tr><td style="color:#999;padding:4px 0">STATUS</td><td style="padding:4px 0"><span style="color:${statusDot};font-weight:600">● ${r.status || "—"}</span></td></tr>
                    <tr><td style="color:#999;padding:4px 0">PROPERTY</td><td style="color:#111;font-weight:500;padding:4px 0">${r.property || "—"}</td></tr>
                  </table>
                  ${desc ? `<div style="margin-top:12px;font-size:11px;color:#666;font-style:italic;line-height:1.5">${desc}</div>` : ""}
                </div>
                <div style="width:240px;flex-shrink:0">
                  <div style="font-size:10px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Receipt / Invoice</div>
                  ${proofHtml}
                </div>
              </div>`;
            }).join("");

            const html = `<!DOCTYPE html><html><head><title>Expense Report</title>
              <style>
                body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px 48px;color:#111;max-width:900px;margin:0 auto}
                @media print{body{padding:24px 32px}img{max-height:180px!important}}
              </style></head><body>
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #eee">
                <div>
                  <div style="font-size:13px;font-weight:600;color:#80020E;letter-spacing:0.5px">HOSTYO</div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:20px;font-weight:700;color:#111">Expense Report</div>
                  <div style="font-size:11px;color:#999;margin-top:4px">Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · ${filtered.length} expenses</div>
                </div>
              </div>
              ${expenseCards}
            </body></html>`;
            const w = window.open("", "_blank");
            if (w) { w.document.write(html); w.document.close(); w.print(); }
          }
        }}
      />
    </AppShell>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-sm text-[#999]">Loading...</div>}>
      <ExpensesPageInner />
    </Suspense>
  );
}
