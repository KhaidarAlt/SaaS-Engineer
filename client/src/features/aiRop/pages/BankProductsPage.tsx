import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Landmark, Plus, Trash2, Check, X, Edit2 } from "lucide-react";
import type { BankProduct } from "@shared/schema";

const QUERY_KEY = ["/api/ai-rop/bank-products"];

export default function BankProductsPage() {
  const { toast } = useToast();
  const [addingBank, setAddingBank] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newConditions, setNewConditions] = useState("");

  const { data: products = [], isLoading } = useQuery<BankProduct[]>({
    queryKey: QUERY_KEY,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      await apiRequest("PUT", `/api/ai-rop/bank-products/${id}`, { isEnabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось обновить статус", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, description, conditions }: { id: string; description: string; conditions: string }) => {
      await apiRequest("PUT", `/api/ai-rop/bank-products/${id}`, { description, conditions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: "Сохранено", description: "Данные обновлены" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось сохранить", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { bankName: string; productName: string; description: string; conditions: string }) => {
      await apiRequest("POST", "/api/ai-rop/bank-products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setAddingBank(false);
      setNewBankName("");
      setNewProductName("");
      setNewDescription("");
      setNewConditions("");
      toast({ title: "Добавлено", description: "Банковский продукт создан" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось создать продукт", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/ai-rop/bank-products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: "Удалено" });
    },
  });

  const grouped = products.reduce<Record<string, BankProduct[]>>((acc, p) => {
    if (!acc[p.bankName]) acc[p.bankName] = [];
    acc[p.bankName].push(p);
    return acc;
  }, {});

  const enabledCount = products.filter((p) => p.isEnabled).length;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="bank-products-page">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Банковские продукты</h1>
        <p className="text-muted-foreground mt-1">
          Управляйте рассрочками и кредитными продуктами. Включённые продукты будут предлагаться AI-продавцом клиентам.
        </p>
        {enabledCount > 0 && (
          <Badge variant="secondary" className="mt-2" data-testid="badge-enabled-count">
            Активных: {enabledCount}
          </Badge>
        )}
      </div>

      {Object.entries(grouped).map(([bankName, bankProducts]) => (
        <Card key={bankName} data-testid={`card-bank-${bankName}`}>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Landmark className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">{bankName}</CardTitle>
            <Badge variant="outline" className="ml-auto">
              {bankProducts.filter((p) => p.isEnabled).length}/{bankProducts.length}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {bankProducts.map((product) => (
              <BankProductRow
                key={product.id}
                product={product}
                onToggle={(isEnabled) => toggleMutation.mutate({ id: product.id, isEnabled })}
                onUpdate={(description, conditions) =>
                  updateMutation.mutate({ id: product.id, description, conditions })
                }
                onDelete={() => deleteMutation.mutate(product.id)}
                isSaving={updateMutation.isPending}
              />
            ))}
          </CardContent>
        </Card>
      ))}

      {!addingBank ? (
        <Button
          variant="outline"
          onClick={() => setAddingBank(true)}
          className="w-full"
          data-testid="button-add-product"
        >
          <Plus className="h-4 w-4 mr-2" />
          Добавить банковский продукт
        </Button>
      ) : (
        <Card data-testid="card-new-product">
          <CardHeader>
            <CardTitle className="text-lg">Новый банковский продукт</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                placeholder="Название банка"
                value={newBankName}
                onChange={(e) => setNewBankName(e.target.value)}
                data-testid="input-new-bank-name"
              />
              <Input
                placeholder="Название продукта"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                data-testid="input-new-product-name"
              />
            </div>
            <Input
              placeholder="Описание (необязательно)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              data-testid="input-new-description"
            />
            <Input
              placeholder="Условия (необязательно)"
              value={newConditions}
              onChange={(e) => setNewConditions(e.target.value)}
              data-testid="input-new-conditions"
            />
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  createMutation.mutate({
                    bankName: newBankName.trim(),
                    productName: newProductName.trim(),
                    description: newDescription.trim(),
                    conditions: newConditions.trim(),
                  })
                }
                disabled={!newBankName.trim() || !newProductName.trim() || createMutation.isPending}
                data-testid="button-save-new-product"
              >
                Добавить
              </Button>
              <Button variant="ghost" onClick={() => setAddingBank(false)} data-testid="button-cancel-new-product">
                Отмена
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BankProductRow({
  product,
  onToggle,
  onUpdate,
  onDelete,
  isSaving,
}: {
  product: BankProduct;
  onToggle: (enabled: boolean) => void;
  onUpdate: (description: string, conditions: string) => void;
  onDelete: () => void;
  isSaving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(product.description || "");
  const [conds, setConds] = useState(product.conditions || "");

  function handleSave() {
    onUpdate(desc.trim(), conds.trim());
    setEditing(false);
  }

  function handleCancel() {
    setDesc(product.description || "");
    setConds(product.conditions || "");
    setEditing(false);
  }

  return (
    <div
      className={`rounded-md border p-3 transition-colors ${product.isEnabled ? "bg-primary/5 border-primary/20" : ""}`}
      data-testid={`row-product-${product.id}`}
    >
      <div className="flex items-start gap-3">
        <Switch
          checked={product.isEnabled}
          onCheckedChange={onToggle}
          data-testid={`switch-product-${product.id}`}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium" data-testid={`text-product-name-${product.id}`}>
              {product.productName}
            </span>
            {product.isEnabled && (
              <Badge variant="default" className="text-xs">Активен</Badge>
            )}
          </div>

          {!editing ? (
            <>
              {product.description && (
                <p className="text-sm text-muted-foreground mt-1" data-testid={`text-description-${product.id}`}>
                  {product.description}
                </p>
              )}
              {product.conditions && (
                <p className="text-sm text-muted-foreground mt-0.5" data-testid={`text-conditions-${product.id}`}>
                  Условия: {product.conditions}
                </p>
              )}
            </>
          ) : (
            <div className="space-y-2 mt-2">
              <Textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Описание продукта"
                className="text-sm min-h-[60px]"
                data-testid={`textarea-description-${product.id}`}
              />
              <Textarea
                value={conds}
                onChange={(e) => setConds(e.target.value)}
                placeholder="Условия (сроки, проценты, мин. сумма)"
                className="text-sm min-h-[60px]"
                data-testid={`textarea-conditions-${product.id}`}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!editing ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setEditing(true)}
              data-testid={`button-edit-${product.id}`}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSave}
                disabled={isSaving}
                data-testid={`button-save-${product.id}`}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCancel}
                data-testid={`button-cancel-${product.id}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            data-testid={`button-delete-${product.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
