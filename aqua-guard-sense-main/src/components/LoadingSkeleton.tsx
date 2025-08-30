
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const TankMonitorSkeleton = () => (
  <Card className="p-4 sm:p-6">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-6 w-24" />
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
    
    <div className="mb-4">
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
    
    <div className="grid grid-cols-2 gap-4">
      <div className="text-center">
        <Skeleton className="h-4 w-20 mx-auto mb-2" />
        <Skeleton className="h-6 w-16 mx-auto" />
      </div>
      <div className="text-center">
        <Skeleton className="h-4 w-16 mx-auto mb-2" />
        <Skeleton className="h-6 w-16 mx-auto" />
      </div>
    </div>
  </Card>
);

export const MotorControlSkeleton = () => (
  <Card className="p-4 sm:p-6">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-6 w-32" />
      </div>
      <Skeleton className="h-4 w-4 rounded-full" />
    </div>
    
    <div className="text-center mb-6">
      <Skeleton className="h-16 w-16 rounded-full mx-auto mb-3" />
      <Skeleton className="h-8 w-24 mx-auto" />
    </div>
    
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="flex items-center justify-center space-x-4">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-6 w-12" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
    
    <Skeleton className="h-12 w-full" />
  </Card>
);

export const SystemStatusSkeleton = () => (
  <Card className="p-4 sm:p-6">
    <div className="flex items-center justify-between mb-4">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-4 w-4 rounded-full" />
    </div>
    
    <div className="grid grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="text-center">
          <Skeleton className="h-4 w-16 mx-auto mb-2" />
          <Skeleton className="h-6 w-12 mx-auto" />
        </div>
      ))}
    </div>
  </Card>
);
