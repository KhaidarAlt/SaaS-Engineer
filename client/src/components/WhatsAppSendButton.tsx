import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SiWhatsapp } from "react-icons/si";
import { Copy, AlertCircle } from "lucide-react";
import type { OrderForWhatsApp } from "@/lib/whatsapp";
import { buildOrderWhatsAppText, copyToClipboard, openWhatsAppOrFallback } from "@/lib/whatsapp";

interface WhatsAppSendButtonProps {
  recipientPhone: string | null | undefined;
  order: OrderForWhatsApp;
}

export function WhatsAppSendButton({ recipientPhone, order }: WhatsAppSendButtonProps) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const text = useMemo(() => buildOrderWhatsAppText(order), [order]);

  const onSend = async () => {
    if (!recipientPhone) {
      toast({
        title: "Ошибка",
        description: "Владелец магазина не настроил номер WhatsApp для получения заказов.",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    try {
      const { opened } = await openWhatsAppOrFallback({ recipientPhone, text });
      if (!opened) {
        toast({
          title: "Внимание",
          description: "Не удалось открыть WhatsApp автоматически. Скопируйте текст заказа и отправьте вручную.",
          variant: "destructive",
        });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Ошибка при подготовке сообщения для WhatsApp.";
      toast({
        title: "Ошибка",
        description: message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async () => {
    const ok = await copyToClipboard(text);
    if (ok) {
      toast({
        title: "Скопировано",
        description: "Текст заказа скопирован в буфер обмена.",
      });
    } else {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать текст. Выделите и скопируйте вручную.",
        variant: "destructive",
      });
    }
  };

  if (!recipientPhone) {
    return (
      <div className="w-full max-w-xl">
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800 dark:text-yellow-200">
                WhatsApp не настроен
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Владелец магазина не настроил номер WhatsApp для получения заказов.
                Ваш заказ сохранён и будет обработан.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl space-y-3">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Отправка заказа</h3>
          <p className="text-sm text-muted-foreground">
            Откроется WhatsApp с готовым сообщением — нажмите «Отправить».
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button 
            onClick={onSend} 
            disabled={busy} 
            className="gap-2 bg-green-600 hover:bg-green-700"
            data-testid="button-send-whatsapp"
          >
            <SiWhatsapp className="h-4 w-4" />
            {busy ? "Подготовка..." : "Отправить заказ в WhatsApp"}
          </Button>
          <Button 
            onClick={onCopy} 
            variant="outline" 
            className="gap-2"
            data-testid="button-copy-order"
          >
            <Copy className="h-4 w-4" />
            Скопировать текст заказа
          </Button>
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
            Показать текст заказа
          </summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs overflow-x-auto">
            {text}
          </pre>
        </details>
      </div>
    </div>
  );
}
