"use client";

export function TooltipButton({
  children,
  tooltip,
  disabled,
  onClick,
  className,
}: {
  children: React.ReactNode;
  tooltip?: string;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div className="relative group/tooltip w-full">
      <button onClick={onClick} disabled={disabled} className={className}>
        {children}
      </button>
      {/* Tooltip — só aparece quando há mensagem e botão está desabilitado */}
      {disabled && tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-xl whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10">
          {tooltip}
          {/* Setinha */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-700" />
        </div>
      )}
    </div>
  );
}
