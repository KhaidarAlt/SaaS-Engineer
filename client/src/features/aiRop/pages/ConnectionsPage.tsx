import { useLocation } from "wouter";
import { ConnectOverviewPage } from "../connect/pages/ConnectOverviewPage";
import { WhatsAppHubPage } from "../connect/pages/WhatsAppHubPage";
import { WhatsAppMetaBridgePage } from "../connect/pages/WhatsAppMetaBridgePage";
import { WhatsAppWahaWizardPage } from "../connect/pages/WhatsAppWahaWizardPage";
import { InstagramConnectPage } from "../connect/pages/InstagramConnectPage";
import { TelegramConnectPage } from "../connect/pages/TelegramConnectPage";

const BASE = "/dashboard/ai/rop/connections";

export default function ConnectionsPage() {
  const [location] = useLocation();

  if (location.startsWith(`${BASE}/whatsapp/meta`)) {
    return <WhatsAppMetaBridgePage />;
  }
  if (location.startsWith(`${BASE}/whatsapp/waha`)) {
    return <WhatsAppWahaWizardPage />;
  }
  if (location.startsWith(`${BASE}/whatsapp`)) {
    return <WhatsAppHubPage />;
  }
  if (location.startsWith(`${BASE}/instagram`)) {
    return <InstagramConnectPage />;
  }
  if (location.startsWith(`${BASE}/telegram`)) {
    return <TelegramConnectPage />;
  }

  return <ConnectOverviewPage />;
}
