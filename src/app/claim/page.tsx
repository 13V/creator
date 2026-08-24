import { Suspense } from "react";

import { ClaimFlow } from "@/components/ClaimFlow";
import { Skeleton } from "@/components/ui";

export const metadata = { title: "Claim your fees" };

export default function ClaimPage() {
  return (
    <div className="mx-auto grid grid-cols-1 w-full max-w-2xl gap-7">
      <header>
        <h1 className="display text-4xl sm:text-[2.75rem]">Claim your fees</h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          Somebody launched a coin for you and the trading fees have been piling
          up in a wallet with your name on it. Prove the account is yours and
          take them.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-72" />}>
        <ClaimFlow />
      </Suspense>
    </div>
  );
}
