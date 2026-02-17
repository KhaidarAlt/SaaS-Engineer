import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Shield, Loader2 } from "lucide-react";
import { fetchDisclaimerStatus, acceptDisclaimer, CONNECT_KEYS } from "../api/connectApi";
import { queryClient } from "@/lib/queryClient";

interface DisclaimerGateProps {
  onAccepted: () => void;
}

export function DisclaimerGate({ onAccepted }: DisclaimerGateProps) {
  const [checked, setChecked] = useState(false);

  const { data: status, isLoading } = useQuery({
    queryKey: CONNECT_KEYS.disclaimerStatus,
    queryFn: fetchDisclaimerStatus,
  });

  const acceptMut = useMutation({
    mutationFn: () => acceptDisclaimer("v1"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECT_KEYS.disclaimerStatus });
      onAccepted();
    },
  });

  useEffect(() => {
    if (status?.accepted) {
      onAccepted();
    }
  }, [status?.accepted, onAccepted]);

  if (isLoading || status?.accepted) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto" data-testid="disclaimer-gate">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Важно перед подключением WAHA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 mt-0.5 shrink-0 text-yellow-500" />
              <p>
                WAHA — неофициальное подключение к WhatsApp. При нарушении правил WhatsApp ваш номер может быть ограничен или заблокирован.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Запрещено:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>Массовые рассылки без согласия получателей</li>
                <li>Спам и покупные базы контактов</li>
                <li>Однотипные сообщения многим контактам</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Рекомендуется:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>Отвечать только на входящие сообщения</li>
                <li>Получать согласие на переписку</li>
                <li>Соблюдать частоту отправки</li>
                <li>Быстро обрабатывать жалобы и стоп-слова</li>
              </ul>
            </div>
            <p className="text-xs border-t pt-3">
              Для максимально безопасной работы используйте официальный канал Meta.
            </p>
          </div>

          <div className="flex items-start gap-2 pt-2 border-t">
            <Checkbox
              id="disclaimer-accept"
              checked={checked}
              onCheckedChange={(v) => setChecked(!!v)}
              data-testid="checkbox-disclaimer"
            />
            <Label htmlFor="disclaimer-accept" className="text-xs leading-tight cursor-pointer">
              Я прочитал(а) и согласен(на). Понимаю риски блокировки номера и что ответственность лежит на владельце номера.
            </Label>
          </div>

          <Button
            className="w-full"
            disabled={!checked || acceptMut.isPending}
            onClick={() => acceptMut.mutate()}
            data-testid="button-accept-disclaimer"
          >
            {acceptMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Продолжить
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
