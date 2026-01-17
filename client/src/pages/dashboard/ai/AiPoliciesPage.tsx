import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AiPaywall } from "@/components/AiPaywall";
import { Shield, Save } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { useEffect } from "react";

interface AiPolicy {
  id: string;
  deliveryPolicy?: string;
  returnPolicy?: string;
  paymentPolicy?: string;
  warrantyPolicy?: string;
  privacyNote?: string;
}

export default function AiPoliciesPage() {
  const { toast } = useToast();

  const { data: status } = useQuery<{ hasAccess: boolean; planName?: string }>({
    queryKey: ["/api/ai/status"],
  });

  const { data: policies, isLoading } = useQuery<AiPolicy>({
    queryKey: ["/api/ai/policies"],
    enabled: status?.hasAccess,
  });

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<AiPolicy>();

  useEffect(() => {
    if (policies) {
      reset(policies);
    }
  }, [policies, reset]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<AiPolicy>) => {
      return apiRequest("PUT", "/api/ai/policies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/policies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/status"] });
      toast({ title: "Политики сохранены" });
    },
  });

  if (!status?.hasAccess) {
    return <div className="p-6"><AiPaywall currentPlan={status?.planName} /></div>;
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const onSubmit = (data: AiPolicy) => {
    saveMutation.mutate(data);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Политики</h1>
          <p className="text-muted-foreground">Правила и условия, которые AI будет использовать в ответах</p>
        </div>
        <Button onClick={handleSubmit(onSubmit)} disabled={!isDirty || saveMutation.isPending} data-testid="button-save-policies">
          <Save className="mr-2 h-4 w-4" />
          Сохранить
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Доставка
            </CardTitle>
            <CardDescription>Условия и сроки доставки</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              {...register("deliveryPolicy")}
              placeholder="Доставка осуществляется по всему Казахстану. Сроки: 1-3 дня по Алматы, 3-7 дней по регионам. Стоимость от 1500₸..."
              className="min-h-[120px]"
              data-testid="input-delivery-policy"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Возврат и обмен
            </CardTitle>
            <CardDescription>Условия возврата товаров</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              {...register("returnPolicy")}
              placeholder="Возврат в течение 14 дней при сохранении товарного вида. Обмен на другой размер бесплатно..."
              className="min-h-[120px]"
              data-testid="input-return-policy"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Оплата
            </CardTitle>
            <CardDescription>Способы оплаты</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              {...register("paymentPolicy")}
              placeholder="Принимаем оплату картой, переводом Kaspi, наличными при получении..."
              className="min-h-[120px]"
              data-testid="input-payment-policy"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Гарантия
            </CardTitle>
            <CardDescription>Гарантийные условия</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              {...register("warrantyPolicy")}
              placeholder="Гарантия на все товары 12 месяцев. В случае брака - бесплатная замена..."
              className="min-h-[120px]"
              data-testid="input-warranty-policy"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Примечание о конфиденциальности
            </CardTitle>
            <CardDescription>Как AI обрабатывает персональные данные</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              {...register("privacyNote")}
              placeholder="Мы не храним персональные данные клиентов. Все переписки автоматически удаляются через 30 дней..."
              className="min-h-[100px]"
              data-testid="input-privacy-policy"
            />
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
