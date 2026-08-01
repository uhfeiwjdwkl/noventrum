import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { searchSymbols, type SymbolMatch } from "@/lib/prices.functions";

/**
 * Ticker autocomplete backed by Yahoo Finance. Picking a result hands back
 * the exact symbol so live prices always resolve.
 */
export function SymbolSearch({
  value,
  onChange,
  onSelect,
  placeholder = "Search e.g. Apple, AAPL, Bitcoin, Gold",
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (m: SymbolMatch) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [results, setResults] = useState<SymbolMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const skip = useRef(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchSymbols({ data: { query: q } });
        if (cancelled) return;
        setResults(r);
        setActive(0);
        setOpen(r.length > 0);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(m: SymbolMatch) {
    skip.current = true;
    onChange(m.symbol);
    onSelect(m);
    setOpen(false);
  }

  return (
    <div className="relative" ref={box}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (!open || results.length === 0) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % results.length); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + results.length) % results.length); }
            else if (e.key === "Enter") { e.preventDefault(); pick(results[active]); }
            else if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          className="pl-8 pr-8"
          autoComplete="off"
        />
        {loading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border border-border bg-popover shadow-lg">
          {results.map((r, i) => (
            <button
              key={r.symbol + i}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(r)}
              className={
                "w-full text-left px-3 py-2 flex items-center gap-3 " +
                (i === active ? "bg-accent" : "")
              }
            >
              <span className="font-semibold text-sm shrink-0">{r.symbol}</span>
              <span className="text-xs text-muted-foreground truncate flex-1">{r.name}</span>
              <span className="text-[10px] uppercase text-muted-foreground shrink-0">{r.type} {r.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
