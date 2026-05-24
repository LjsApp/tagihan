import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  prefix?: boolean;
};

const formatID = (n: number) =>
  isNaN(n) || n === 0 ? "" : new Intl.NumberFormat("id-ID").format(Math.round(n));

export const RupiahInput = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, className, placeholder = "0", disabled, prefix = true }, ref) => {
    const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, "");
      onChange(digits ? parseInt(digits, 10) : 0);
    };
    return (
      <div className="relative">
        {prefix && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
            Rp
          </span>
        )}
        <Input
          ref={ref}
          inputMode="numeric"
          value={formatID(value)}
          onChange={handle}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "rounded-none border-2 border-paper-edge bg-paper num text-right",
            prefix && "pl-8",
            className,
          )}
        />
      </div>
    );
  },
);
RupiahInput.displayName = "RupiahInput";
