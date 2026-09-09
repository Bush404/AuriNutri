import { cn } from "@/lib/utils";

export function Logo({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <circle cx="16" cy="16" r="16" fill="#124532" />
        <path
          d="M16 24c-4.4-2.7-7-6-7-9.6C9 10.9 11.6 8 15 8c.7 0 1.4.2 2 .5.6-.3 1.3-.5 2-.5 3.4 0 6 2.9 6 6.4 0 3.6-2.6 6.9-7 9.6-.3.2-.7.2-1 0Z"
          fill="#F2994A"
        />
        <path d="M16 12.5V21" stroke="#124532" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      {!iconOnly && (
        <span className="text-lg font-semibold tracking-tight text-primary-900">
          Auri<span className="text-primary-600">Nutri</span>
        </span>
      )}
    </div>
  );
}
