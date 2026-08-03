import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useFinance, DEFAULT_CURRENCIES } from "@/lib/finance/store";
import { toast } from "sonner";

/** ISO 4217 code picker: shows saved codes + "Other..." to add any 3-letter code. */
export function CurrencyPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (code: string) => void;
  className?: string;
}) {
  const currencies = useFinance((s) => s.settings.currencies);
  const addCurrency = useFinance((s) => s.addCurrency);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");

  const list = Array.from(new Set([...(value ? [value] : []), ...currencies, ...DEFAULT_CURRENCIES]));

  return (
    <>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === "__other") {
            setCode("");
            setOpen(true);
          } else onChange(v);
        }}
      >
        <SelectTrigger className={className}><SelectValue /></SelectTrigger>
        <SelectContent>
          {list.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          <SelectItem value="__other">Other…</SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add currency</DialogTitle>
            <DialogDescription>Enter any ISO 4217 3-letter code (e.g. NOK, MXN, ZAR).</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Code</Label>
            <Input
              className="mt-1.5 uppercase"
              maxLength={3}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXX"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const c = code.trim().toUpperCase();
                if (!/^[A-Z]{3}$/.test(c)) {
                  toast.error("Enter a 3-letter code");
                  return;
                }
                addCurrency(c);
                onChange(c);
                setOpen(false);
              }}
            >Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
