import { useQuery } from "@tanstack/react-query";
import { fetchOnboardingStatus, AI_ROP_KEYS } from "../api/aiRopApi";
import { AiRopOnboardingPage } from "./AiRopOnboardingPage";
import AiRopDashboardPage from "./AiRopDashboardPage";
import { Skeleton } from "@/components/ui/skeleton";

export default function AiRopEntryPage() {
  const { data: status, isLoading } = useQuery({
    queryKey: AI_ROP_KEYS.onboardingStatus,
    queryFn: fetchOnboardingStatus,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!status?.completed) {
    return <AiRopOnboardingPage />;
  }

  return <AiRopDashboardPage />;
}
