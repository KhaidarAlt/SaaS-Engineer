import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function AiRopShell({ children }: Props) {
  return (
    <div className="min-h-screen bg-background" data-testid="ai-rop-shell">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {children}
      </div>
    </div>
  );
}
