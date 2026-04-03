"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/AppShell";
import FilterDropdown from "@/components/FilterDropdown";

/* ================================================================
   Types
   ================================================================ */
interface Expense {
  id: string;
  date: string;
  property: string;
  reservation: string | null;
  category: string;
  vendor: string;
  amount: number;
  status: "Approved" | "Pending" | "Submitted" | "Rejected";
  description: string;
  proofType: "photo" | "file";
  proofName: string;
  proofSize: string;
  proofType2: "photo" | "file" | null;
  proofName2: string | null;
  proofSize2: string | null;
  vendorNotes: string | null;
  payoutCycle: string;
  deducted: boolean;
  createdBalance: boolean;
  causedHold: boolean;
}

/* ================================================================
   Data (20 rows)
   ================================================================ */
const expenses: Expense[] = [
  {
    id: "EXP-2601", date: "2026-03-24", property: "The Kensington Residence", reservation: "RES-8841",
    category: "Cleaning", vendor: "CleanCo", amount: 185.00, status: "Approved",
    description: "Post-checkout deep clean including carpet steam treatment",
    proofType: "photo", proofName: "clean_receipt_mar24.jpg", proofSize: "1.2 MB",
    proofType2: null, proofName2: null, proofSize2: null,
    vendorNotes: "Extra time needed due to pet hair \u2014 charged premium rate.",
    payoutCycle: "Mar 16-31, 2026", deducted: true, createdBalance: false, causedHold: false,
  },
  {
    id: "EXP-2602", date: "2026-03-22", property: "Villa Serena", reservation: "RES-8839",
    category: "Maintenance", vendor: "FixIt Plumbing", amount: 340.00, status: "Approved",
    description: "Kitchen sink P-trap replacement and drain cleaning",
    proofType: "file", proofName: "invoice_fixit_0322.pdf", proofSize: "84 KB",
    proofType2: "photo", proofName2: "plumbing_before.jpg", proofSize2: "2.1 MB",
    vendorNotes: "Parts included in invoice. 90-day warranty on labor.",
    payoutCycle: "Mar 16-31, 2026", deducted: true, createdBalance: false, causedHold: false,
  },
  {
    id: "EXP-2603", date: "2026-03-20", property: "Mayfair Studio", reservation: null,
    category: "Supplies", vendor: "LuxeSupply", amount: 92.50, status: "Pending",
    description: "Restocking toiletries, linens, and kitchen essentials",
    proofType: "file", proofName: "luxesupply_order_8812.pdf", proofSize: "56 KB",
    proofType2: null, proofName2: null, proofSize2: null,
    vendorNotes: null,
    payoutCycle: "Not yet assigned", deducted: false, createdBalance: false, causedHold: false,
  },
  {
    id: "EXP-2604", date: "2026-03-18", property: "The Kensington Residence", reservation: null,
    category: "Photography", vendor: "ProPhoto Studio", amount: 475.00, status: "Approved",
    description: "Professional listing photos (24 shots) + virtual tour",
    proofType: "photo", proofName: "pps_invoice_mar.jpg", proofSize: "340 KB",
    proofType2: null, proofName2: null, proofSize2: null,
    vendorNotes: "Final edited gallery delivered via shared drive link.",
    payoutCycle: "Mar 16-31, 2026", deducted: true, createdBalance: false, causedHold: false,
  },
  {
    id: "EXP-2605", date: "2026-03-17", property: "Villa Serena", reservation: "RES-8830",
    category: "Repairs", vendor: "FixIt Plumbing", amount: 1250.00, status: "Submitted",
    description: "Emergency water heater replacement \u2014 unit failed overnight",
    proofType: "file", proofName: "fixit_emergency_inv.pdf", proofSize: "112 KB",
    proofType2: "photo", proofName2: "heater_damage.jpg", proofSize2: "3.4 MB",
    vendorNotes: "Emergency call-out surcharge applied. New unit: Rinnai RU199iN.",
    payoutCycle: "Not yet assigned", deducted: false, createdBalance: true, causedHold: true,
  },
  {
    id: "EXP-2606", date: "2026-03-15", property: "Mayfair Studio", reservation: "RES-8825",
    category: "Cleaning", vendor: "CleanCo", amount: 120.00, status: "Approved",
    description: "Standard turnover cleaning between guests",
    proofType: "photo", proofName: "clean_receipt_mar15.jpg", proofSize: "980 KB",
    proofType2: null, proofName2: null, proofSize2: null,
    vendorNotes: null,
    payoutCycle: "Mar 1-15, 2026", deducted: true, createdBalance: false, causedHold: false,
  },
  {
    id: "EXP-2607", date: "2026-03-14", property: "The Kensington Residence", reservation: null,
    category: "Utilities", vendor: "SparkElectric", amount: 218.40, status: "Approved",
    description: "March electricity bill \u2014 higher usage due to heating",
    proofType: "file", proofName: "spark_bill_mar2026.pdf", proofSize: "64 KB",
    proofType2: null, proofName2: null, proofSize2: null,
    vendorNotes: "Estimated meter read. Actual read next cycle.",
    payoutCycle: "Mar 1-15, 2026", deducted: true, createdBalance: false, causedHold: false,
  },
  {
    id: "EXP-2608", date: "2026-03-12", property: "Villa Serena", reservation: null,
    category: "Insurance", vendor: "SafeGuard Insurance", amount: 385.00, status: "Approved",
    description: "Quarterly short-term rental liability insurance premium",
    proofType: "file", proofName: "safeguard_q1_2026.pdf", proofSize: "128 KB",
    proofType2: null, proofName2: null, proofSize2: null,
    vendorNotes: "Policy #SG-44821. Coverage: $2M liability + $500K property.",
    payoutCycle: "Mar 1-15, 2026", deducted: true, createdBalance: false, causedHold: false,
  },
  {
    id: "EXP-2609", date: "2026-03-10", property: "Mayfair Studio", reservation: "RES-8818",
    category: "Repairs", vendor: "SparkElectric", amount: 165.00, status: "Rejected",
    description: "GFCI outlet replacement in bathroom \u2014 deemed cosmetic",
    proofType: "photo", proofName: "outlet_photo.jpg", proofSize: "1.8 MB",
    proofType2: null, proofName2: null, proofSize2: null,
    vendorNotes: "Outlet was functional but discolored. Replacement optional.",
    payoutCycle: "Mar 1-15, 2026", deducted: false, createdBalance: false, causedHold: false,
  },
  {
    id: "EXP-2610", date: "2026-03-08", property: "The Kensington Residence", reservation: "RES-8810",
    category: "Cleaning", vendor: "CleanCo", amount: 210.00, status: "Approved",
    description: "Deep clean + mattress sanitization after extended stay",
    proofType: "photo", proofName: "clean_kensington_mar8.jpg", proofSize: "1.4 MB",
    proofType2: "file", proofName2: "cleanco_inv_2610.pdf", proofSize2: "72 KB",
    vendorNotes: "Mattress treatment adds $45 to standard deep clean rate.",
    payoutCycle: "Mar 1-15, 2026", deducted: true, createdBalance: false, causedHold: false,
  },
  {
    id: "EXP-2611", date: "2026-03-06", property: "Villa Serena", reservation: null,
    category: "Supplies", vendor: "LuxeSupply", amount: 147.25, status: "Pending",
    description: "Premium coffee pods, welcome basket items, scented candles",
    proofType: "file", proofName: "luxe_order_confirmation.pdf", proofSize: "48 KB",
    proofType2: null, proofName2: null, proofSize2: null,
    vendorNotes: "Delivery expected Mar 9. Tracking #LX-998271.",
    payoutCycle: "Not yet assigned", deducted: false, createdBalance: false, causedHold: false,
  },
  {
    id: "EXP-2612", date: "2026-03-05", property: "Mayfair Studio", reservation: null,
    category: "Maintenance", vendor: "FixIt Plumbing", amount: 95.00, status: "Approved",
    description: "Annual boiler inspection and safety certification",
    proofType: "file", proofName: "boiler_cert_2026.pdf", proofSize: "220 KB",
    proofType2: null, proofName2: null, proofSize2: null,
    vendorNotes: "All checks passed. Certificate valid until Mar 2027.",
    payoutCycle: "Mar 1-15, 2026", deducted: true, createdBalance: false, causedHold: false,
  },
  {
    id: "EXP-2613", date: "2026-03-03", property: "The Kensington Residence", reservation: "RES-8802",
    category: "Repairs", vendor: "SparkElectric", amount: 520.00, status: "Submitted",
    description: "Smart thermostat installation (Nest) + wiring update",
    proofType: "photo", proofName: "thermostat_install.jpg", proofSize: "2.6 MB",
    proofType2: "file", proofName2: "spark_quote_therm.pdf", proofSize2: "96 KB",
    vendorNotes: "Nest Learning Thermostat 4th Gen. Old mercury unit removed and disposed.",
    payoutCycle: "Not yet assigned", deducted: false, createdBalance: true, causedHold: true,
  },
  {
    id: "EXP-2614", date: "2026-03-01", property: "Villa Serena", reservation: "RES-8798",
    category: "Cleaning", vendor: "CleanCo", amount: 155.00, status: "Approved",
    description: "Standard turnover clean + balcony power wash",
    proofType: "photo", proofName: "villa_clean_mar1.jpg", proofSize: "1.1 MB",
    proofType2: null, proofName2: null, proofSize2: null,
    vendorNotes: null,
    payoutCycle: "Mar 1-15, 2026", deducted: true, createdBalance: false, causedHold: false,
  },
  {
    id: "EXP-2615", date: "2026-02-27", property: "Mayfair Studio", reservation: null,
    category: "Utilities", vendor: "SparkElectric", amount: 189.60, status: "Approved",
    description: "February electricity and gas combined bill",
    proofType: "file", proofName: "spark_feb_combined.pdf", proofSize: "58 KB",
    proofType2: null, proofName2: null, proofSize2: null,
    vendorNotes: null,
    payoutCycle: "Mar 1-15, 2026", deducted: true, createdBalance: false, causedHold: false,
  },
  {
    id: "EXP-2616", date: "2026-02-25", property: "The Kensington Residence", reservation: null,
    category: "Insurance", vendor: "SafeGuard Insurance", amount: 410.00, status: "Approved",
    description: "Quarterly property insurance \u2014 increased coverage tier",
    proofType: "file", proofName: "safeguard_kens_q1.pdf", proofSize: "134 KB",
    proofType2: null, proofName2: null, proofSize2: null,
    vendorNotes: "Policy #SG-44822. Upgraded to premium tier per owner request.",
    payoutCycle: "Mar 1-15, 2026", deducted: true, createdBalance: false, causedHold: false,
  },
  {
    id: "EXP-2617", date: "2026-02-22", property: "Villa Serena", reservation: "RES-8785",
    category: "Maintenance", vendor: "FixIt Plumbing", amount: 275.00, status: "Pending",
    description: "Dishwasher drain hose replacement and recalibration",
    proofType: "photo", proofName: "dishwasher_repair.jpg", proofSize: "1.9 MB",
    proofType2: null, proofName2: null, proofSize2: null,
    vendorNotes: "Original hose kinked causing backup. Recommend annual check.",
    payoutCycle: "Not yet assigned", deducted: false, createdBalance: false, causedHold: false,
  },
  {
    id: "EXP-2618", date: "2026-02-20", property: "Mayfair Studio", reservation: "RES-8780",
    category: "Cleaning", vendor: "CleanCo", amount: 120.00, status: "Approved",
    description: "Standard turnover cleaning between guests",
    proofType: "photo", proofName: "clean_mayfair_feb20.jpg", proofSize: "890 KB",
    proofType2: null, proofName2: null, proofSize2: null,
    vendorNotes: null,
    payoutCycle: "Feb 16-28, 2026", deducted: true, createdBalance: false, causedHold: false,
  },
  {
    id: "EXP-2619", date: "2026-02-18", property: "The Kensington Residence", reservation: null,
    category: "Supplies", vendor: "LuxeSupply", amount: 203.75, status: "Rejected",
    description: "Luxury bath products upgrade \u2014 not in approved budget",
    proofType: "file", proofName: "luxe_bath_order.pdf", proofSize: "42 KB",
    proofType2: null, proofName2: null, proofSize2: null,
    vendorNotes: "Owner declined luxury tier. Standard restocking approved separately.",
    payoutCycle: "Feb 16-28, 2026", deducted: false, createdBalance: false, causedHold: false,
  },
  {
    id: "EXP-2620", date: "2026-02-15", property: "Villa Serena", reservation: "RES-8772",
    category: "Repairs", vendor: "FixIt Plumbing", amount: 890.00, status: "Submitted",
    description: "Guest bathroom shower valve replacement and tile regrouting",
    proofType: "photo", proofName: "shower_valve_before.jpg", proofSize: "2.8 MB",
    proofType2: "file", proofName2: "fixit_quote_shower.pdf", proofSize2: "108 KB",
    vendorNotes: "Tile damage from old valve leak. Full regrouting needed within 48 hrs.",
    payoutCycle: "Not yet assigned", deducted: false, createdBalance: true, causedHold: true,
  },
];

/* ================================================================
   Helpers
   ================================================================ */
const fmtDate = (d: string) => {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const fmtMoney = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pillClass = (s: string) => "pill pill-" + s.toLowerCase();

const groupTabs = ["All Expenses", "By Property", "By Category", "By Vendor", "By Status"] as const;

const properties = ["The Kensington Residence", "Villa Serena", "Mayfair Studio"];
const statuses = ["Submitted", "Approved", "Pending", "Rejected"];

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
  const [activeTab, setActiveTab] = useState<string>("All Expenses");
  const [filterProperty, setFilterProperty] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* Filtering */
  const filtered = expenses.filter((exp) => {
    if (filterProperty && exp.property !== filterProperty) return false;
    if (filterStatus && exp.status !== filterStatus) return false;
    if (search) {
      const haystack = [exp.id, exp.property, exp.reservation, exp.category, exp.vendor, exp.description, exp.amount.toString()]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search.toLowerCase().trim())) return false;
    }
    return true;
  });

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

  return (
    <AppShell title="Expenses">
      {/* ── Group Tabs ── */}
      <div className="flex gap-1.5 mb-5">
        {groupTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-[18px] py-2 rounded-lg border text-[13px] font-medium cursor-pointer transition-all ${
              activeTab === tab
                ? "bg-[#80020E] text-white border-[#80020E] font-semibold"
                : "bg-white text-[#555] border-[#ddd] hover:border-[#bbb] hover:text-[#111]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <FilterDropdown
          value={filterProperty}
          onChange={setFilterProperty}
          placeholder="All Properties"
          options={properties.map((p) => ({ value: p, label: p }))}
        />

        <FilterDropdown
          value={filterStatus}
          onChange={setFilterStatus}
          placeholder="All Statuses"
          options={statuses.map((s) => ({ value: s, label: s }))}
        />

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

      {/* ── Expenses Table ── */}
      <div className="bg-white border border-[#eaeaea] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[1100px]">
            <thead>
              <tr>
                {["Expense ID", "Date", "Property", "Reservation", "Category", "Vendor", "Amount", "Status", "Proof", "Deducted?", "Caused Hold?"].map(
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
                  <td colSpan={11} className="text-center py-10 text-[#999] text-sm">
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
                      <span className="font-semibold text-[#80020E] text-xs font-mono">{exp.id}</span>
                    </td>
                    <td className="px-3.5 py-3 text-[13px] text-[#555] whitespace-nowrap">{fmtDate(exp.date)}</td>
                    <td className="px-3.5 py-3 text-[13px] font-medium text-[#111] whitespace-nowrap">{exp.property}</td>
                    <td className="px-3.5 py-3 text-xs text-[#555] whitespace-nowrap">{exp.reservation ?? "\u2014"}</td>
                    <td className="px-3.5 py-3 text-[13px] whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#555] bg-[#f5f5f5] px-2.5 py-0.5 rounded-md">
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-[13px] font-medium text-[#111] whitespace-nowrap">{exp.vendor}</td>
                    <td className="px-3.5 py-3 text-[13px] font-semibold text-[#111] whitespace-nowrap tabular-nums">{fmtMoney(exp.amount)}</td>
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <span className={pillClass(exp.status)}>{exp.status}</span>
                    </td>
                    <td className="px-3.5 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); openDrawer(exp); }}
                        title="View proof"
                        className="w-[30px] h-[30px] rounded-md border border-[#eaeaea] bg-white inline-flex items-center justify-center cursor-pointer transition-colors text-[#555] hover:bg-[#f5f5f5] hover:border-[#ccc] hover:text-[#80020E]"
                      >
                        {exp.proofType === "photo" ? <CameraIcon /> : <FileIcon />}
                      </button>
                    </td>
                    <td className="px-3.5 py-3">
                      <span className={`flex items-center justify-center ${exp.deducted ? "text-[#2e7d32]" : "text-[#ccc]"}`}>
                        {exp.deducted ? <CheckCircleIcon /> : <DashIcon />}
                      </span>
                    </td>
                    <td className="px-3.5 py-3">
                      <span className={`flex items-center justify-center ${exp.causedHold ? "text-[#e65100]" : "text-[#ccc]"}`}>
                        {exp.causedHold ? <WarningIcon /> : <DashIcon />}
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
            <span className="font-semibold text-[#555]">{expenses.length}</span> expenses
          </div>
        </div>
      </div>

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
                  { label: "Expense ID", value: <span className="font-mono text-[#80020E] font-semibold">{selectedExpense.id}</span> },
                  { label: "Category", value: selectedExpense.category },
                  { label: "Description", value: selectedExpense.description },
                  { label: "Created", value: fmtDate(selectedExpense.date) },
                  { label: "Vendor", value: selectedExpense.vendor },
                  { label: "Property", value: selectedExpense.property },
                  { label: "Reservation", value: selectedExpense.reservation ?? "\u2014" },
                  { label: "Status", value: <span className={pillClass(selectedExpense.status)}>{selectedExpense.status}</span> },
                ].map((row) => (
                  <div key={row.label} className="flex items-start justify-between py-2.5 border-b border-[#f3f3f3] last:border-b-0">
                    <span className="text-[13px] font-medium text-[#555]">{row.label}</span>
                    <span className="text-[13px] font-medium text-[#111] text-right max-w-[60%]">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Attachments */}
              <div className="mb-7">
                <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wider mb-3.5">Attachments</div>
                <div className="flex flex-col gap-2.5">
                  <AttachmentItem type={selectedExpense.proofType} name={selectedExpense.proofName} size={selectedExpense.proofSize} />
                  {selectedExpense.proofType2 && selectedExpense.proofName2 && selectedExpense.proofSize2 && (
                    <AttachmentItem type={selectedExpense.proofType2} name={selectedExpense.proofName2} size={selectedExpense.proofSize2} />
                  )}
                </div>
                {selectedExpense.vendorNotes && (
                  <div className="mt-3.5 px-4 py-3 bg-[#fafafa] rounded-lg text-[13px] text-[#555] italic leading-relaxed border-l-[3px] border-[#eaeaea]">
                    {selectedExpense.vendorNotes}
                  </div>
                )}
              </div>

              {/* Financial Impact */}
              <div>
                <div className="text-[13px] font-semibold text-[#999] uppercase tracking-wider mb-3.5">Financial Impact</div>
                <div className="bg-[#fafafa] border border-[#eaeaea] rounded-xl p-[18px]">
                  {[
                    {
                      label: "Linked Payout Cycle",
                      value: <span className="text-[13px] font-semibold text-[#111]">{selectedExpense.payoutCycle}</span>,
                    },
                    { label: "Deducted this cycle?", value: <ImpactValue value={selectedExpense.deducted} type="deduct" /> },
                    { label: "Created owner balance?", value: <ImpactValue value={selectedExpense.createdBalance} type="balance" /> },
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
