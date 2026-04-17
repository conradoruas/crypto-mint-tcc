import { cn } from "@/lib/utils";

interface EthAmountInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  "aria-label": string;
  className?: string;
  currency?: string;
}

const BASE_CLASS =
  "w-full bg-surface-container-lowest border border-outline-variant/20 text-on-surface px-4 py-3 rounded-sm text-sm focus:outline-none focus:border-primary transition-all placeholder:text-on-surface-variant/40";

export function EthAmountInput({
  value,
  onChange,
  placeholder,
  error,
  "aria-label": ariaLabel,
  className,
}: EthAmountInputProps) {
  return (
    <div className="w-full">
      <input
        type="text"
        inputMode="decimal"
        pattern="[0-9]*[.]?[0-9]*"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          // Allow only digits, a single dot, and leading decimal (e.g. ".5")
          if (v === "" || /^\d*\.?\d*$/.test(v)) onChange(v);
        }}
        placeholder={placeholder ?? "Amount in ETH"}
        aria-label={ariaLabel}
        aria-invalid={!!error}
        className={cn(BASE_CLASS, error && "!border-error/40", className)}
      />
      {error && <p className="text-xs text-error mt-1.5">{error}</p>}
    </div>
  );
}
