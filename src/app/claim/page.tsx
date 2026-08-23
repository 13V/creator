import { Suspense } from "react";

import { ClaimFlow } from "@/components/ClaimFlow";

export const metadata = { title: "Claim your fees — Creator Launchpad" };

export default function ClaimPage() {
  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Claim your creator fees</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">
          Somebody launched a coin for you and the trading fees have been piling
          up. Prove the account is yours and take them.
        </p>
      </div>

      <Suspense fallback={<div className="card h-48 animate-pulse" />}>
        <ClaimFlow />
      </Suspense>
    </div>
  );
}
