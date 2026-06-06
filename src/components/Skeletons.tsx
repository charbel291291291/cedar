import React from 'react';

export const SkeletonBlock = ({ className }: { className: string }) => (
  <div className={`bg-muted animate-pulse rounded-md ${className}`} />
);

export function ServiceCardSkeleton() {
  return (
    <div className="flex flex-col bg-card border border-border rounded-xl p-4 gap-4">
      <div className="flex justify-between items-start mb-2 border-b border-border pb-4">
        <SkeletonBlock className="w-16 h-5" />
        <SkeletonBlock className="w-20 h-6" />
      </div>
      <SkeletonBlock className="w-3/4 h-5 mt-2" />
      <SkeletonBlock className="w-1/2 h-5 mb-2" />
      <div className="space-y-3 mt-4">
        <SkeletonBlock className="w-full h-10" />
        <SkeletonBlock className="w-full h-10" />
      </div>
      <div className="mt-auto pt-4">
        <SkeletonBlock className="w-full h-10" />
      </div>
    </div>
  );
}

export function DashboardSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-500">
      <ServiceCardSkeleton />
      <ServiceCardSkeleton />
      <ServiceCardSkeleton />
      <ServiceCardSkeleton />
      <ServiceCardSkeleton />
      <ServiceCardSkeleton />
    </div>
  );
}
