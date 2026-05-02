"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";

interface Option {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export default function FilterDropdown({
  options,
  value,
  onChange,
  placeholder = "All",
  placeholderIcon,
  searchable = false,
}: {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  placeholderIcon?: React.ReactNode;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Memoise so the array isn't a fresh reference on every render — that
  // would invalidate `filteredItems`'s memo too and trigger ESLint's
  // exhaustive-deps warning.
  const allItems = useMemo<Option[]>(
    () => [{ value: "", label: placeholder, icon: placeholderIcon }, ...options],
    [placeholder, placeholderIcon, options],
  );

  const filteredItems = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return allItems;
    const q = searchQuery.toLowerCase();
    return allItems.filter((o) => o.label.toLowerCase().includes(q));
  }, [allItems, searchable, searchQuery]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      const idx = filteredItems.findIndex((o) => o.value === value);
      setHighlightIndex(idx >= 0 ? idx : 0);
      if (searchable) {
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
    } else {
      setSearchQuery("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || highlightIndex < 0) return;
    const list = listRef.current;
    if (!list) return;
    const item = list.children[highlightIndex] as HTMLElement;
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightIndex >= 0 && highlightIndex < filteredItems.length) {
            onChange(filteredItems[highlightIndex].value);
            setOpen(false);
            setSearchQuery("");
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          setSearchQuery("");
          break;
      }
    },
    [open, highlightIndex, filteredItems, onChange]
  );

  const selectedOption = options.find((o) => o.value === value);
  const selectedLabel = selectedOption?.label || placeholder;
  const selectedIcon = selectedOption?.icon;

  return (
    <div ref={ref} className="relative" onKeyDown={handleKeyDown}>
      <button
        onClick={() => setOpen(!open)}
        className="dropdown-trigger min-w-[150px]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex items-center gap-[6px] truncate">
          {selectedIcon && <span className="flex-shrink-0 flex items-center">{selectedIcon}</span>}
          {selectedLabel}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`text-[#999] flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="dropdown-panel left-0 min-w-[260px] max-h-[360px] flex flex-col">
          {searchable && (
            <div className="px-2 pt-2 pb-1 flex-shrink-0">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setHighlightIndex(0); }}
                className="w-full h-[34px] px-3 border border-[#e2e2e2] rounded-lg text-[13px] text-[#333] placeholder:text-[#bbb] outline-none focus:border-[#80020E] transition-colors bg-white"
              />
            </div>
          )}
          <div
            ref={listRef}
            className="overflow-y-auto max-h-[280px]"
            role="listbox"
          >
            {filteredItems.map((o, i) => (
              <button
                key={o.value || "__placeholder__"}
                onClick={() => { onChange(o.value); setOpen(false); setSearchQuery(""); }}
                onMouseEnter={() => setHighlightIndex(i)}
                role="option"
                aria-selected={value === o.value}
                className={`dropdown-item ${
                  value === o.value ? "selected" : ""
                } ${highlightIndex === i && value !== o.value ? "bg-[#f5f5f5]" : ""}`}
              >
                {o.icon && <span className="flex-shrink-0 flex items-center">{o.icon}</span>}
                {o.label}
              </button>
            ))}
            {filteredItems.length === 0 && (
              <div className="px-4 py-3 text-[12px] text-[#999]">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
