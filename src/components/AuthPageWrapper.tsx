import { ReactNode } from "react";

export function AuthPageWrapper({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background"
      style={{
        backgroundImage: `
          radial-gradient(ellipse at 20% 50%, hsl(var(--primary) / 0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, hsl(var(--accent) / 0.06) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 100%, hsl(var(--gold) / 0.05) 0%, transparent 50%)
        `,
      }}
    >
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-[0.04] bg-primary" />
      <div className="absolute -bottom-32 -left-32 w-[30rem] h-[30rem] rounded-full opacity-[0.03] bg-accent" />
      {children}
    </div>
  );
}
