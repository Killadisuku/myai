import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="currentColor" className="text-primary" />
      <path
        d="M8.2 22.5V9.5h3.05l4.75 8.35 4.75-8.35H23.8v13H20.9v-8.2l-3.9 6.7h-2l-3.9-6.7v8.2H8.2Z"
        fill="currentColor"
        className="text-primary-foreground"
      />
    </svg>
  );
}

export function LogoWord({ className }: { className?: string }) {
  return (
    <span className={cn("text-[1.05rem] font-semibold tracking-tight", className)}>
      MyAI
    </span>
  );
}
