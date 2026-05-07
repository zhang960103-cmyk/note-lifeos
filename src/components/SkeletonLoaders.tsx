import { Skeleton } from "@/components/ui/skeleton";

export function ChatSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-end"><Skeleton className="h-10 w-48 rounded-2xl" /></div>
      <div className="flex justify-start"><Skeleton className="h-16 w-64 rounded-2xl" /></div>
      <div className="flex justify-end"><Skeleton className="h-8 w-36 rounded-2xl" /></div>
      <div className="flex justify-start"><Skeleton className="h-20 w-56 rounded-2xl" /></div>
    </div>
  );
}

export function TodoSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 flex-1 rounded" />
          <Skeleton className="h-3 w-12 rounded" />
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}
