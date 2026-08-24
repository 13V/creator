import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="grid grid-cols-1 gap-6">
      <Skeleton className="h-9 w-72" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
    </div>
  );
}
