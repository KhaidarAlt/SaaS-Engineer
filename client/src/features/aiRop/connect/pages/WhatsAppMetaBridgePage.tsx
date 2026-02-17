import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WizardLayout } from "../components/WizardLayout";
import { ExternalLink, Shield } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";

export function WhatsAppMetaBridgePage() {
  return (
    <WizardLayout
      title="WhatsApp Cloud API (Meta)"
      subtitle="Официальное подключение через Meta Business"
      backPath="/dashboard/ai/rop/connections/whatsapp"
    >
      <div className="max-w-lg" data-testid="meta-bridge-page">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <SiWhatsapp className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div>
                <h3 className="font-medium">WhatsApp Cloud API</h3>
                <p className="text-xs text-muted-foreground">Настройте подключение через Meta Business Platform</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
                <p>Официальное API с полной поддержкой Meta: шаблоны, верификация, масштабирование</p>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => window.open("/dashboard/whatsapp-cloud", "_blank")}
              data-testid="button-open-meta-settings"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Открыть настройки WhatsApp Cloud
            </Button>

            <p className="text-[11px] text-muted-foreground text-center">
              Откроется в новой вкладке. Все настройки и статус подключения Meta сохраняются автоматически.
            </p>
          </CardContent>
        </Card>
      </div>
    </WizardLayout>
  );
}
