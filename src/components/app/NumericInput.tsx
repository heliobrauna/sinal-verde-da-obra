import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

type NumericInputProps = Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: number;
  onValueChange: (value: number) => void;
  decimals?: number;
  monetary?: boolean;
};

function format(value: number, decimals: number) {
  if (!Number.isFinite(value) || value === 0) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function parse(value: string, decimals: number, monetary: boolean) {
  const typed = value.replace(/[^\d,.-]/g, "");
  const digits = typed.replace(/\D/g, "");
  if (!typed.includes(",") && monetary && decimals === 2 && digits.length >= 7) {
    const inferredDecimals = digits.length === 7 ? 1 : 2;
    return Number(digits) / 10 ** inferredDecimals;
  }
  const clean = typed.replace(/\./g, "").replace(",", ".");
  const parsed = Number(clean);
  if (!Number.isFinite(parsed)) return 0;
  const factor = 10 ** decimals;
  return Math.round(parsed * factor) / factor;
}

export function NumericInput({
  value,
  onValueChange,
  decimals = 2,
  monetary = false,
  onBlur,
  onFocus,
  ...props
}: NumericInputProps) {
  const [display, setDisplay] = useState(() => format(value, decimals));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDisplay(format(value, decimals));
  }, [value, decimals, focused]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={display}
      onFocus={(event) => {
        setFocused(true);
        setDisplay(value ? format(value, decimals) : "");
        onFocus?.(event);
      }}
      onChange={(event) => {
        const parsed = parse(event.target.value, decimals, monetary);
        setDisplay(event.target.value);
        onValueChange(parsed);
      }}
      onBlur={(event) => {
        setFocused(false);
        setDisplay(format(parse(event.target.value, decimals, monetary), decimals));
        onBlur?.(event);
      }}
    />
  );
}
