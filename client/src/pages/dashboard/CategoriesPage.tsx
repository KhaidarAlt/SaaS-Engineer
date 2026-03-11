import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Tag, MoreHorizontal, ChevronRight, GripVertical } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSkeleton } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { resolveImageUrl } from "@/lib/imageUrl";
import type { Category } from "@shared/schema";

const categoryFormSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  parentId: z.string().optional(),
});

type CategoryFormData = z.infer<typeof categoryFormSchema>;

function DraggableList({
  items,
  onReorder,
  renderItem,
  group,
}: {
  items: Category[];
  onReorder: (newOrder: Category[]) => void;
  renderItem: (item: Category, dragHandleProps: React.HTMLAttributes<HTMLDivElement>) => React.ReactNode;
  group: string;
}) {
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.stopPropagation();
    dragItem.current = index;
    setDraggingIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    dragOver.current = index;
    setOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragItem.current === null || dragOver.current === null) return;
    if (dragItem.current === dragOver.current) {
      setDraggingIndex(null);
      setOverIndex(null);
      return;
    }
    const newOrder = [...items];
    const [removed] = newOrder.splice(dragItem.current, 1);
    newOrder.splice(dragOver.current, 0, removed);
    onReorder(newOrder);
    dragItem.current = null;
    dragOver.current = null;
    setDraggingIndex(null);
    setOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
    setOverIndex(null);
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={item.id}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          data-group={group}
          className={`transition-all duration-150 ${
            draggingIndex === index ? "opacity-40" : ""
          } ${overIndex === index && draggingIndex !== index ? "ring-2 ring-primary ring-offset-2 rounded-lg" : ""}`}
        >
          {renderItem(item, {
            className: "cursor-grab active:cursor-grabbing touch-none select-none",
          })}
        </div>
      ))}
    </div>
  );
}

export default function CategoriesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const { toast } = useToast();

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      description: "",
      imageUrl: "",
      parentId: "",
    },
  });

  const rootCategories = (categories?.filter(c => !c.parentId) || [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const getSubcategories = (parentId: string) =>
    (categories?.filter(c => c.parentId === parentId) || [])
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const createMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      return apiRequest("POST", "/api/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Категория создана" });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Ошибка создания", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CategoryFormData }) => {
      return apiRequest("PUT", `/api/categories/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Категория обновлена" });
      setDialogOpen(false);
      setEditingCategory(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Ошибка обновления", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Категория удалена" });
    },
    onError: () => {
      toast({ title: "Ошибка удаления", variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("POST", "/api/categories/reorder", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
    },
    onError: () => {
      toast({ title: "Ошибка сохранения порядка", variant: "destructive" });
    },
  });

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    form.reset({
      name: category.name,
      description: category.description || "",
      imageUrl: category.imageUrl || "",
      parentId: category.parentId || "",
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingCategory(null);
    form.reset({ name: "", description: "", imageUrl: "", parentId: "" });
    setDialogOpen(true);
  };

  const availableParents = categories?.filter(c => {
    if (!editingCategory) return !c.parentId;
    return !c.parentId && c.id !== editingCategory.id;
  }) || [];

  const onSubmit = (data: CategoryFormData) => {
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleRootReorder = (newOrder: Category[]) => {
    reorderMutation.mutate(newOrder.map(c => c.id));
  };

  const handleSubReorder = (newOrder: Category[]) => {
    reorderMutation.mutate(newOrder.map(c => c.id));
  };

  const renderCategoryCard = (
    cat: Category,
    isRoot: boolean,
    dragHandleProps: React.HTMLAttributes<HTMLDivElement>
  ) => (
    <Card className="hover-elevate">
      <CardHeader className={`flex flex-row items-start justify-between gap-2 ${isRoot ? "" : "py-3"}`}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            {...dragHandleProps}
            data-testid={`drag-handle-${cat.id}`}
            className={`flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors ${dragHandleProps.className || ""}`}
          >
            <GripVertical className="h-5 w-5" />
          </div>
          {!isRoot && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
          <div className={`${isRoot ? "w-10 h-10" : "w-8 h-8"} rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0`}>
            {cat.imageUrl ? (
              <img
                src={resolveImageUrl(cat.imageUrl)}
                alt={cat.name}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <Tag className={`${isRoot ? "h-5 w-5" : "h-4 w-4"} text-primary`} />
            )}
          </div>
          <div className="min-w-0">
            <CardTitle className={isRoot ? "text-base" : "text-sm"}>{cat.name}</CardTitle>
            {cat.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">{cat.description}</p>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid={`menu-category-${cat.id}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEditDialog(cat)}>
              <Pencil className="h-4 w-4 mr-2" />
              Редактировать
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => deleteMutation.mutate(cat.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Категории</h1>
            <p className="text-muted-foreground">
              Перетащите категории для изменения порядка отображения в каталоге
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} data-testid="button-add-category">
                <Plus className="h-4 w-4 mr-2" />
                Добавить категорию
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCategory ? "Редактировать категорию" : "Новая категория"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Название *</Label>
                  <Input
                    id="name"
                    placeholder="Название категории"
                    {...form.register("name")}
                    data-testid="input-category-name"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Описание</Label>
                  <Input
                    id="description"
                    placeholder="Описание категории"
                    {...form.register("description")}
                    data-testid="input-category-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imageUrl">URL изображения</Label>
                  <Input
                    id="imageUrl"
                    placeholder="https://..."
                    {...form.register("imageUrl")}
                    data-testid="input-category-image"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Родительская категория</Label>
                  <Select
                    value={form.watch("parentId") || "none"}
                    onValueChange={(value) => form.setValue("parentId", value === "none" ? "" : value)}
                  >
                    <SelectTrigger data-testid="select-parent-category">
                      <SelectValue placeholder="Нет (корневая категория)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Нет (корневая категория)</SelectItem>
                      {availableParents.map((parent) => (
                        <SelectItem key={parent.id} value={parent.id}>
                          {parent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Выберите родительскую категорию для создания подкатегории
                  </p>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-category"
                  >
                    {editingCategory ? "Сохранить" : "Создать"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : categories && categories.length > 0 ? (
          <div className="space-y-1">
            <DraggableList
              items={rootCategories}
              onReorder={handleRootReorder}
              group="root"
              renderItem={(cat, dragHandleProps) => (
                <div key={cat.id} className="space-y-1">
                  {renderCategoryCard(cat, true, dragHandleProps)}
                  {getSubcategories(cat.id).length > 0 && (
                    <div className="ml-6 pl-4 border-l-2 border-muted">
                      <DraggableList
                        items={getSubcategories(cat.id)}
                        onReorder={handleSubReorder}
                        group={`sub-${cat.id}`}
                        renderItem={(subCat, subDragHandleProps) =>
                          renderCategoryCard(subCat, false, subDragHandleProps)
                        }
                      />
                    </div>
                  )}
                </div>
              )}
            />
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <Tag className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="font-medium">Нет категорий</p>
              <p className="text-sm text-muted-foreground mb-4">
                Создайте категории для организации товаров
              </p>
              <Button onClick={openCreateDialog} data-testid="button-add-first-category">
                <Plus className="h-4 w-4 mr-2" />
                Добавить категорию
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
