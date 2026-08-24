import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="grid grid-cols-1 max-w-3xl gap-6">
      <Skeleton className="h-44" />
      <div className="grid gap-3 sm:grid grid-cols-1-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-56" />
    </div>
  );
}
