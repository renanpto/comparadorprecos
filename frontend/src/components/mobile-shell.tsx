import { cn } from "@/lib/utils";

export function MobileShell({
  children,
  className,
  noPadding,
}: {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <div className="min-h-dvh w-full bg-muted/40 flex justify-center">
      <div
        className={cn(
          "w-full max-w-md min-h-dvh bg-background flex flex-col relative shadow-sm",
          !noPadding && "px-4",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
