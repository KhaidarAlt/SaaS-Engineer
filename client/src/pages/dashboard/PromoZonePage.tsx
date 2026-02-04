import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Image as ImageIcon, MoreHorizontal, Upload, X, GripVertical } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSkeleton } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { PromoBlock } from "@shared/schema";

// Helper to normalize image URL (handles both old objectPath and new /objects/ URLs)
function normalizeImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("/objects/")) {
    return url;
  }
  return `/objects/${url}`;
}

const promoBlockFormSchema = z.object({
  imageUrl: z.string().min(1, "Изображение обязательно"),
  title: z.string().optional(),
  description: z.string().max(300, "Максимум 300 символов").optional(),
  buttonText: z.string().default("Купить"),
  linkType: z.enum(["whatsapp", "crm"]),
  linkUrl: z.string().optional(),
  sortOrder: z.coerce.number().min(0).default(0),
  isActive: z.boolean().default(true),
});

type PromoBlockFormData = z.infer<typeof promoBlockFormSchema>;

export default function PromoZonePage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<PromoBlock | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading } = useUpload({
    onError: (error) => {
      toast({ title: "Ошибка загрузки", description: error.message, variant: "destructive" });
    },
  });

  const { data: promoBlocks, isLoading } = useQuery<PromoBlock[]>({
    queryKey: ["/api/promo-blocks"],
  });

  const form = useForm<PromoBlockFormData>({
    resolver: zodResolver(promoBlockFormSchema),
    defaultValues: {
      imageUrl: "",
      title: "",
      description: "",
      buttonText: "Купить",
      linkType: "whatsapp",
      linkUrl: "",
      sortOrder: 0,
      isActive: true,
    },
  });

  const description = form.watch("description") || "";
  const imageUrl = form.watch("imageUrl");

  const createMutation = useMutation({
    mutationFn: async (data: PromoBlockFormData) => {
      return apiRequest("POST", "/api/promo-blocks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-blocks"] });
      toast({ title: "Промо-блок создан" });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Ошибка создания", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PromoBlockFormData }) => {
      return apiRequest("PUT", `/api/promo-blocks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-blocks"] });
      toast({ title: "Промо-блок обновлён" });
      setDialogOpen(false);
      setEditingBlock(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Ошибка обновления", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/promo-blocks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promo-blocks"] });
      toast({ title: "Промо-блок удалён" });
    },
    onError: () => {
      toast({ title: "Ошибка удаления", variant: "destructive" });
    },
  });

  const openEditDialog = (block: PromoBlock) => {
    setEditingBlock(block);
    form.reset({
      imageUrl: block.imageUrl,
      title: block.title || "",
      description: block.description || "",
      buttonText: block.buttonText || "Купить",
      linkType: (block.linkType as "whatsapp" | "crm") || "whatsapp",
      linkUrl: block.linkUrl || "",
      sortOrder: block.sortOrder,
      isActive: block.isActive,
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingBlock(null);
    form.reset({
      imageUrl: "",
      title: "",
      description: "",
      buttonText: "Купить",
      linkType: "whatsapp",
      linkUrl: "",
      sortOrder: 0,
      isActive: true,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: PromoBlockFormData) => {
    if (editingBlock) {
      updateMutation.mutate({ id: editingBlock.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Неверный формат", description: "Только JPG/PNG файлы", variant: "destructive" });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Файл слишком большой", description: "Максимум 2MB", variant: "destructive" });
      return;
    }

    const result = await uploadFile(file);
    if (result) {
      // Make the file publicly accessible
      try {
        await fetch("/api/uploads/set-public", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objectPath: result.objectPath }),
        });
      } catch (e) {
        console.error("Failed to set public access:", e);
      }
      // Store full URL path for display
      form.setValue("imageUrl", `/objects/${result.objectPath}`);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = () => {
    form.setValue("imageUrl", "");
  };

  const getLinkTypeLabel = (type: string) => {
    return type === "whatsapp" ? "WhatsApp" : "CRM";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Промо-зона</h1>
            <p className="text-muted-foreground">
              Управляйте промо-блоками для главной страницы каталога
            </p>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-add-promo-block">
            <Plus className="h-4 w-4 mr-2" />
            Создать промо-блок
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : promoBlocks && promoBlocks.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {promoBlocks.map((block, index) => (
              <motion.div
                key={block.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="hover-elevate overflow-hidden" data-testid={`card-promo-block-${block.id}`}>
                  <div className="relative aspect-[3/1] bg-muted">
                    {block.imageUrl ? (
                      <img
                        src={normalizeImageUrl(block.imageUrl)}
                        alt={block.title || "Промо-блок"}
                        className="w-full h-full object-cover"
                        data-testid={`img-promo-block-${block.id}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex items-center gap-2">
                      <Badge variant={block.isActive ? "default" : "secondary"} data-testid={`badge-status-${block.id}`}>
                        {block.isActive ? "Активен" : "Неактивен"}
                      </Badge>
                    </div>
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/50 text-white px-2 py-1 rounded text-xs">
                      <GripVertical className="h-3 w-3" />
                      <span>{block.sortOrder}</span>
                    </div>
                  </div>
                  <CardHeader className="flex flex-row items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate" data-testid={`text-title-${block.id}`}>
                        {block.title || "Без названия"}
                      </CardTitle>
                      {block.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1" data-testid={`text-description-${block.id}`}>
                          {block.description}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-menu-${block.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(block)} data-testid={`button-edit-${block.id}`}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Редактировать
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(block.id)}
                          data-testid={`button-delete-${block.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Кнопка:</span>
                        <Badge variant="outline">{block.buttonText}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Тип:</span>
                        <Badge variant="outline">{getLinkTypeLabel(block.linkType)}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="font-medium">Нет промо-блоков</p>
              <p className="text-sm text-muted-foreground mb-4">
                Создайте промо-блоки для привлечения внимания клиентов
              </p>
              <Button onClick={openCreateDialog} data-testid="button-add-first-promo-block">
                <Plus className="h-4 w-4 mr-2" />
                Создать промо-блок
              </Button>
            </CardContent>
          </Card>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingBlock ? "Редактировать промо-блок" : "Новый промо-блок"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Изображение *</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-file-upload"
                />
                {imageUrl ? (
                  <div className="relative aspect-[3/1] rounded-lg overflow-hidden bg-muted">
                    <img
                      src={normalizeImageUrl(imageUrl)}
                      alt="Превью"
                      className="w-full h-full object-cover"
                      data-testid="img-preview"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={removeImage}
                      data-testid="button-remove-image"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-24 border-dashed"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    data-testid="button-upload-image"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-6 w-6" />
                      <span>{isUploading ? "Загрузка..." : "Загрузить изображение"}</span>
                    </div>
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Рекомендуемый размер 1200×400, JPG/PNG, до 2MB
                </p>
                {form.formState.errors.imageUrl && (
                  <p className="text-sm text-destructive">{form.formState.errors.imageUrl.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Заголовок</Label>
                <Input
                  id="title"
                  placeholder="Новая коллекция"
                  {...form.register("title")}
                  data-testid="input-title"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="description">Описание</Label>
                  <span className="text-xs text-muted-foreground" data-testid="text-char-counter">
                    {description.length}/300
                  </span>
                </div>
                <Textarea
                  id="description"
                  placeholder="Краткое описание промо-блока"
                  rows={3}
                  {...form.register("description")}
                  data-testid="input-description"
                />
                {form.formState.errors.description && (
                  <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="buttonText">Текст кнопки</Label>
                  <Input
                    id="buttonText"
                    placeholder="Купить"
                    {...form.register("buttonText")}
                    data-testid="input-button-text"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Тип ссылки</Label>
                  <Select
                    value={form.watch("linkType")}
                    onValueChange={(value) => form.setValue("linkType", value as "whatsapp" | "crm")}
                  >
                    <SelectTrigger data-testid="select-link-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="crm">CRM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.watch("linkType") === "crm" && (
                <div className="space-y-2">
                  <Label htmlFor="linkUrl">URL ссылки</Label>
                  <Input
                    id="linkUrl"
                    placeholder="https://..."
                    {...form.register("linkUrl")}
                    data-testid="input-link-url"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="sortOrder">Порядок сортировки</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  min={0}
                  {...form.register("sortOrder")}
                  data-testid="input-sort-order"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label htmlFor="isActive">Активен</Label>
                  <p className="text-sm text-muted-foreground">
                    Отображать промо-блок в каталоге
                  </p>
                </div>
                <Switch
                  id="isActive"
                  checked={form.watch("isActive")}
                  onCheckedChange={(checked) => form.setValue("isActive", checked)}
                  data-testid="switch-is-active"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending || isUploading}
                  data-testid="button-save-promo-block"
                >
                  {editingBlock ? "Сохранить" : "Создать"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
