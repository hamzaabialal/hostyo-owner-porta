"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import AppShell from "@/components/AppShell";
import MobileTabs from "@/components/MobileTabs";
import FilterDropdown from "@/components/FilterDropdown";
import DateRangePicker from "@/components/DateRangePicker";
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

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className ?? "w-[18px] h-[18px]"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const XCircleIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className ?? "w-4 h-4"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const WarningIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className ?? "w-[18px] h-[18px]"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
  </svg>
);

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
export default function ExpensesPage() {
  const { fetchData } = useData();
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

  useEffect(() => {
    fetchData("expenses", "/api/expenses")
      .then((res: unknown) => {
        const d = res as { data?: Expense[] };
        if (d.data) {
          setApiExpenses(d.data);
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
  const ImpactValue = ({ value, type }: { value: boolean; type: "deduct" | "balance" | "hold" }) => {
    if (type === "hold") {
      return value ? (
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#e65100]">
          <WarningIcon className="w-4 h-4" /> Yes
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#999]">
          <DashIcon className="w-4 h-4" /> No
        </span>
      );
    }
    return value ? (
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#2e7d32]">
        <CheckCircleIcon className="w-4 h-4" /> Yes
      </span>
    ) : (
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#999]">
        <XCircleIcon className="w-4 h-4" /> No
      </span>
    );
  };

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
      {/* ── Group Tabs ── */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 hide-scrollbar">
        {groupTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-[14px] md:px-[18px] py-2 rounded-lg border text-[12px] md:text-[13px] font-medium cursor-pointer transition-all whitespace-nowrap flex-shrink-0 ${
              activeTab === tab
                ? "bg-[#80020E] text-white border-[#80020E] font-semibold"
                : "bg-white text-[#555] border-[#ddd] hover:border-[#bbb] hover:text-[#111]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Mobile Filters ── */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto md:hidden pb-1">
        <FilterDropdown value={filterProperty} onChange={setFilterProperty} placeholder="Properties" options={propertyList.map((p) => ({ value: p, label: p }))} searchable />
        <FilterDropdown value={filterStatus} onChange={setFilterStatus} placeholder="Status" options={statusList.map((s) => ({ value: s, label: s }))} />
      </div>
      {/* ── Desktop Filter Bar ── */}
      <div className="hidden md:flex items-center gap-3 mb-5 flex-wrap">
        <FilterDropdown value={filterProperty} onChange={setFilterProperty} placeholder="All Properties" options={propertyList.map((p) => ({ value: p, label: p }))} searchable />
        <FilterDropdown value={filterStatus} onChange={setFilterStatus} placeholder="All Statuses" options={statusList.map((s) => ({ value: s, label: s }))} />
        <DateRangePicker from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />

        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999] pointer-events-none"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expenses..."
            className="h-9 pl-9 pr-3 border border-[#ddd] rounded-lg text-[13px] text-[#333] bg-white min-w-[240px] outline-none transition-colors focus:border-[#80020E] placeholder:text-[#999]"
          />
        </div>
      </div>

      {/* ── Grouped View ── */}
      {grouped ? (
        <div className="space-y-4">
          {grouped.length === 0 ? (
            <div className="bg-white border border-[#eaeaea] rounded-xl py-10 text-center text-[#999] text-sm">No expenses match your filters.</div>
          ) : grouped.map(([groupName, { items, total }]) => (
            <div key={groupName} className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-[#fafafa] border-b border-[#eaeaea]">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[#111]">{groupName}</span>
                  <span className="text-[11px] text-[#999] bg-[#f0f0f0] px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
                <span className="text-[13px] font-semibold text-[#111] tabular-nums">{fmtMoney(total)}</span>
              </div>
              <div className="divide-y divide-[#f3f3f3]">
                {items.map((exp) => (
                  <div key={exp.id} onClick={() => openDrawer(exp)} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#fafafa] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-mono text-[#80020E] font-semibold">{exp.expenseId}</span>
                        {exp.category && <span className="text-[11px] text-[#555] bg-[#f5f5f5] px-2 py-0.5 rounded-md">{exp.category}</span>}
                      </div>
                      <div className="text-[12px] text-[#999] mt-0.5">
                        {exp.property}{exp.vendor ? ` · ${exp.vendor}` : ""}{exp.date ? ` · ${fmtDate(exp.date)}` : ""}
                      </div>
                    </div>
                    <div className="text-[13px] font-semibold text-[#111] tabular-nums flex-shrink-0">{exp.amount ? fmtMoney(exp.amount) : "—"}</div>
                    <span className={`flex-shrink-0 ${pillClass(exp.status)}`}>{exp.status}</span>
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
            <div key={exp.id} onClick={() => openDrawer(exp)} className="bg-white border border-[#eaeaea] rounded-xl p-4 cursor-pointer hover:shadow-sm transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[11px] font-semibold text-[#80020E]">{exp.expenseId}</span>
                <span className={pillClass(exp.status)}>{exp.status}</span>
              </div>
              <div className="text-[14px] font-semibold text-[#111] mb-0.5">{exp.property || "—"}</div>
              {exp.category && <span className="text-[11px] text-[#555] bg-[#f5f5f5] px-2 py-0.5 rounded-md inline-block mb-1">{exp.category}</span>}
              <div className="text-[12px] text-[#888] mb-2">{exp.vendor ? `${exp.vendor} · ` : ""}{fmtDate(exp.date)}</div>
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold text-[#111] tabular-nums">{exp.amount ? fmtMoney(exp.amount) : "—"}</span>
                {exp.proof && exp.proof.length > 0 && (
                  <span className="text-[10px] text-[#999] bg-[#f5f5f5] px-2 py-0.5 rounded">{exp.proof.length} file{exp.proof.length !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Desktop Table View ── */}
        <div className="hidden md:block bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[1100px]">
              <thead>
                <tr>
                  {["Expense ID", "Date", "Property", "Reservation", "Category", "Vendor", "Amount", "Status", "Proof", "Deducted?"].map(
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
                    <td colSpan={10} className="text-center py-10 text-[#999] text-sm">
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
                      <td className="px-3.5 py-3 text-[13px]">
                        <span className="font-semibold text-[#80020E] text-xs font-mono">{exp.expenseId}</span>
                      </td>
                      <td className="px-3.5 py-3 text-[13px] text-[#555] whitespace-nowrap">{fmtDate(exp.date)}</td>
                      <td className="px-3.5 py-3 text-[13px] font-medium text-[#111] whitespace-nowrap">{exp.property}</td>
                      <td className="px-3.5 py-3 text-xs text-[#555] whitespace-nowrap">{exp.reservation || "\u2014"}</td>
                      <td className="px-3.5 py-3 text-[13px] whitespace-nowrap">
                        {exp.category && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#555] bg-[#f5f5f5] px-2.5 py-0.5 rounded-md">
                            {exp.category}
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 text-[13px] font-medium text-[#111] whitespace-nowrap">{exp.vendor || "\u2014"}</td>
                      <td className="px-3.5 py-3 text-[13px] font-semibold text-[#111] whitespace-nowrap tabular-nums">{exp.amount ? fmtMoney(exp.amount) : "\u2014"}</td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className={pillClass(exp.status)}>{exp.status}</span>
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
                      <td className="px-3.5 py-3">
                        <span className={`flex items-center justify-center ${exp.deducted ? "text-[#2e7d32]" : "text-[#ccc]"}`}>
                          {exp.deducted ? <CheckCircleIcon /> : <DashIcon />}
                        </span>
                      </td>
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
                  { label: "Date", value: fmtDate(selectedExpense.date) },
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

              {/* Attachments */}
              {selectedExpense.proof && selectedExpense.proof.length > 0 && (
                <div className="mb-7">
                  <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wider mb-3.5">Attachments</div>
                  <div className="flex flex-col gap-2.5">
                    {selectedExpense.proof.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                        <AttachmentItem type="file" name={`Attachment ${i + 1}`} size="" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Financial Impact */}
              <div>
                <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wider mb-3.5">Financial Impact</div>
                <div className="bg-[#fafafa] border border-[#eaeaea] rounded-xl p-[18px]">
                  {[
                    { label: "Deducted from payout?", value: <ImpactValue value={selectedExpense.deducted} type="deduct" /> },
                    { label: "Put payout on hold?", value: <ImpactValue value={selectedExpense.causedHold} type="hold" /> },
                  ].map((row, i, arr) => (
                    <div
                      key={row.label}
                      className={`flex items-center justify-between py-2.5 ${
                        i === 0 ? "pt-0" : ""
                      } ${i === arr.length - 1 ? "pb-0 border-b-0" : "border-b border-[#eee]"}`}
                    >
                      <span className="text-[13px] text-[#555] font-medium">{row.label}</span>
                      {row.value}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
