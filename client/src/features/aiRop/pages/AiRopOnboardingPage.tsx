import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AiRopShell } from "../components/layout/AiRopShell";
import { WowScanIntro } from "../components/onboarding/WowScanIntro";
import { InterviewWizard } from "../components/onboarding/InterviewWizard";
import { fetchCatalogSummary, completeOnboarding, fetchSettings, AI_ROP_KEYS } from "../api/aiRopApi";
import { queryClient } from "@/lib/queryClient";
import type { OnboardingData } from "../types/aiRopTypes";
import { useToast } from "@/hooks/use-toast";

export function AiRopOnboardingPage() {
  const [showWizard, setShowWizard] = useState(false);
  const { toast } = useToast();

  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useQuery({
    queryKey: AI_ROP_KEYS.catalogSummary,
    queryFn: fetchCatalogSummary,
  });

  const { data: settings } = useQuery({
    queryKey: AI_ROP_KEYS.settings,
    queryFn: fetchSettings,
  });

  const mutation = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AI_ROP_KEYS.onboardingStatus });
      queryClient.invalidateQueries({ queryKey: AI_ROP_KEYS.settings });
      toast({ title: "AI-РОП настроен!" });
    },
    onError: () => {
      toast({ title: "Ошибка при сохранении настроек", variant: "destructive" });
    },
  });

  function handleWizardComplete(data: OnboardingData) {
    mutation.mutate(data);
  }

  return (
    <AiRopShell>
      {!showWizard ? (
        <WowScanIntro
          onComplete={() => setShowWizard(true)}
          summary={summary ?? null}
          isLoading={summaryLoading}
          isError={summaryError}
        />
      ) : (
        <InterviewWizard
          onComplete={handleWizardComplete}
          initialSettings={settings ?? null}
        />
      )}
    </AiRopShell>
  );
}
