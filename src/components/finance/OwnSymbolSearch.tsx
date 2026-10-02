import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFinance } from "@/lib/finance/store";
import type { Holding } from "@/lib/finance/data";

/** Search box limited to assets the user owns or has traded. */
export function OwnSymbolSearch({ value, onChange, onSelect, placeholder = "Search your assets" }: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (h: Holding) => void;
  placeholder?: string;
}) {
  const holdings = useFinance((s) => s.holdings);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const q = value.trim().toLowerCase();
  const results = holdings.filter((h) => !q || h.symbol.toLowerCase().includes(q) || h.name.toLowerCase().includes(q)).slice(0, 30);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (h: Holding) => { onChange(h.symbol); onSelect(h); setOpen(false); };

  return (
    <div className="relative" ref={box}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        className="pl-8"
        autoComplete="off"
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value.toUpperCase()); setOpen(true); setActive(0); }}
        onKeyDown={(e) => {
          if (!open || results.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % results.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + results.length) % results.length); }
          else if (e.key === "Enter") { e.preventDefault(); pick(results[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-64 max-h-64 overflow-auto rounded-md border border-border bg-popover shadow-lg">
          {results.map((h, i) => (
            <button key={h.id} type="button" onMouseEnter={() => setActive(i)} onClick={() => pick(h)}
              className={"w-full text-left px-3 py-2 flex items-center gap-3 " + (i === active ? "bg-accent" : "")}>
              <span className="font-semibold text-sm shrink-0">{h.symbol}</span>
              <span className="text-xs text-muted-foreground truncate flex-1">{h.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
