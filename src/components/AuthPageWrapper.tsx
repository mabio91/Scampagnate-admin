import { ReactNode } from "react";

export function AuthPageWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      {/* Light mode gradient overlay */}
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          background: `
            radial-gradient(ellipse at 20% 50%, hsl(150 40% 20% / 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, hsl(25 70% 50% / 0.06) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 100%, hsl(38 60% 55% / 0.05) 0%, transparent 50%),
            linear-gradient(160deg, hsl(40 20% 97%) 0%, hsl(40 25% 93%) 50%, hsl(150 15% 92%) 100%)
          `,
        }}
      />
      {/* Dark mode gradient overlay */}
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background: `
            radial-gradient(ellipse at 20% 50%, hsl(150 35% 45% / 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, hsl(25 60% 45% / 0.06) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 100%, hsl(38 50% 45% / 0.05) 0%, transparent 50%),
            linear-gradient(160deg, hsl(150 20% 8%) 0%, hsl(150 18% 10%) 50%, hsl(150 15% 12%) 100%)
          `,
        }}
      />
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-primary/[0.04]" />
      <div className="absolute -bottom-32 -left-32 w-[30rem] h-[30rem] rounded-full bg-accent/[0.03]" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
