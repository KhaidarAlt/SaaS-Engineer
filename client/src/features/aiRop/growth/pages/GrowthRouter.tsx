import { useLocation } from "wouter";
import { GrowthOverviewPage } from "./GrowthOverviewPage";
import { GrowthModulePage } from "./GrowthModulePage";
import { CampaignDetailPage } from "./CampaignDetailPage";
import { AudiencePage } from "./AudiencePage";
import { ScenariosPage } from "./ScenariosPage";

export function GrowthRouter() {
  const [location] = useLocation();
  const path = location.replace("/dashboard/ai/rop/growth", "").replace(/^\//, "");
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0 || segments[0] === "") {
    return <GrowthOverviewPage />;
  }

  if (segments[0] === "audience") {
    return <AudiencePage />;
  }

  if (segments[0] === "scenarios") {
    return <ScenariosPage />;
  }

  if (segments[0] === "campaign" && segments[1]) {
    return <CampaignDetailPage campaignId={segments[1]} />;
  }

  const moduleMap: Record<string, string> = {
    reactivation: "REACTIVATION",
    upsell: "UPSELL",
    abandoned: "ABANDONED",
    reminders: "REMINDER",
    nps: "NPS",
  };

  const campaignType = moduleMap[segments[0]];
  if (campaignType) {
    return <GrowthModulePage type={campaignType as any} />;
  }

  return <GrowthOverviewPage />;
}
