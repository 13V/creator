import { LaunchForm } from "@/components/LaunchForm";
import { isPlatform } from "@/lib/social/types";

export const metadata = { title: "Launch a coin" };

/**
 * The rail's launcher hands the handle over in the URL, so arriving here
 * lands on a form that has already found the creator rather than an empty one
 * asking for what was just typed.
 */
export default async function LaunchPage({
  searchParams,
}: {
  searchParams: Promise<{ handle?: string; platform?: string }>;
}) {
  const { handle, platform } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="card p-5 sm:p-7">
        <LaunchForm
          initialHandle={handle}
          initialPlatform={platform && isPlatform(platform) ? platform : undefined}
        />
      </div>
    </div>
  );
}
