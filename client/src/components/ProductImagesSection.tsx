import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, ChevronDown, ChevronUp, ImageIcon, Star, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ProductImage } from "@shared/schema";

interface ProductImagesSectionProps {
  productId: string;
}

export function ProductImagesSection({ productId }: ProductImagesSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const { data: images, isLoading } = useQuery<ProductImage[]>({
    queryKey: ["/api/products", productId, "images"],
    enabled: !!productId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      setUploading(true);
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("images", file);
      });
      
      const response = await fetch(`/api/products/${productId}/images`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", productId, "images"] });
      toast({ title: "Изображения загружены" });
      setUploading(false);
    },
    onError: () => {
      toast({ title: "Ошибка загрузки", variant: "destructive" });
      setUploading(false);
    },
  });

  const setMainMutation = useMutation({
    mutationFn: async (imageId: string) => {
      return apiRequest("POST", `/api/products/${productId}/images/${imageId}/main`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", productId, "images"] });
      toast({ title: "Главное изображение установлено" });
    },
    onError: () => {
      toast({ title: "Ошибка", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (imageId: string) => {
      return apiRequest("DELETE", `/api/products/${productId}/images/${imageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", productId, "images"] });
      toast({ title: "Изображение удалено" });
    },
    onError: () => {
      toast({ title: "Ошибка удаления", variant: "destructive" });
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadMutation.mutate(files);
    }
  }, [uploadMutation]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadMutation.mutate(files);
    }
    e.target.value = "";
  }, [uploadMutation]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate flex flex-row items-center justify-between gap-2 py-4">
            <div className="flex items-center gap-3">
              <ImageIcon className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">
                Изображения товара
                {images && images.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {images.length}
                  </Badge>
                )}
              </CardTitle>
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors mb-4 ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                  <p className="text-sm text-muted-foreground">Загрузка...</p>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Перетащите изображения сюда или
                  </p>
                  <label>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileSelect}
                      data-testid="input-image-upload"
                    />
                    <Button variant="outline" size="sm" asChild>
                      <span className="cursor-pointer">
                        <Plus className="h-4 w-4 mr-2" />
                        Выбрать файлы
                      </span>
                    </Button>
                  </label>
                  <p className="text-xs text-muted-foreground mt-2">
                    JPG, PNG, GIF, WebP до 10 МБ
                  </p>
                </>
              )}
            </div>

            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">
                Загрузка...
              </div>
            ) : images && images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className="relative group rounded-lg overflow-hidden border bg-muted/30 aspect-square"
                  >
                    <img
                      src={image.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    {image.isMain && (
                      <div className="absolute top-2 left-2">
                        <Badge variant="default" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Главное
                        </Badge>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {!image.isMain && (
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={() => setMainMutation.mutate(image.id)}
                          title="Сделать главным"
                          data-testid={`button-set-main-${image.id}`}
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => deleteMutation.mutate(image.id)}
                        title="Удалить"
                        data-testid={`button-delete-image-${image.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                Нет изображений. Загрузите первое изображение.
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
