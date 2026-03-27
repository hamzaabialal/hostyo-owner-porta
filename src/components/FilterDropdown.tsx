"use client";
import { useState, useRef, useEffect, useCallback } from "react";

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
}: {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  placeholderIcon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allItems: Option[] = [{ value: "", label: placeholder, icon: placeholderIcon }, ...options];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      const idx = allItems.findIndex((o) => o.value === value);
      setHighlightIndex(idx >= 0 ? idx : 0);
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
          setHighlightIndex((prev) => Math.min(prev + 1, allItems.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (highlightIndex >= 0 && highlightIndex < allItems.length) {
            onChange(allItems[highlightIndex].value);
            setOpen(false);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          break;
      }
    },
    [open, highlightIndex, allItems, onChange]
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
        <div
          ref={listRef}
          className="dropdown-panel left-0 min-w-[220px] max-h-[280px] overflow-y-auto"
          role="listbox"
        >
          {allItems.map((o, i) => (
            <button
              key={o.value || "__placeholder__"}
              onClick={() => { onChange(o.value); setOpen(false); }}
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
        </div>
      )}
    </div>
  );
}
