import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, ChevronDown, ChevronUp, ImageIcon, Star, Upload, X, AlertCircle } from "lucide-react";
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

interface PreviewImage {
  file: File;
  preview: string;
  compressed: Blob | null;
  compressing: boolean;
  error?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1920;
const COMPRESSION_QUALITY = 0.85;

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      URL.revokeObjectURL(img.src);
      
      let { width, height } = img;
      
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
          width = MAX_IMAGE_DIMENSION;
        } else {
          width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
          height = MAX_IMAGE_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;
      
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Compression failed"));
          }
        },
        "image/jpeg",
        COMPRESSION_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Failed to load image"));
    };

    img.src = URL.createObjectURL(file);
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " Б";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
  return (bytes / (1024 * 1024)).toFixed(1) + " МБ";
}

export function ProductImagesSection({ productId }: ProductImagesSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const { toast } = useToast();

  const { data: images, isLoading } = useQuery<ProductImage[]>({
    queryKey: ["/api/products", productId, "images"],
    enabled: !!productId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (blobs: Blob[]) => {
      setUploading(true);
      const formData = new FormData();
      blobs.forEach((blob, index) => {
        formData.append("images", blob, `image_${index}.jpg`);
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
      setPreviewImages(prev => {
        prev.forEach(img => URL.revokeObjectURL(img.preview));
        return [];
      });
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

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles: PreviewImage[] = [];

    for (const file of fileArray) {
      if (!file.type.startsWith("image/")) {
        toast({ title: `${file.name} не является изображением`, variant: "destructive" });
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast({ title: `${file.name} превышает 10 МБ`, variant: "destructive" });
        continue;
      }

      validFiles.push({
        file,
        preview: URL.createObjectURL(file),
        compressed: null,
        compressing: true,
      });
    }

    setPreviewImages(prev => [...prev, ...validFiles]);

    for (let i = 0; i < validFiles.length; i++) {
      try {
        const compressed = await compressImage(validFiles[i].file);
        setPreviewImages(prev => 
          prev.map((img, idx) => 
            img.file === validFiles[i].file
              ? { ...img, compressed, compressing: false }
              : img
          )
        );
      } catch (error) {
        setPreviewImages(prev => 
          prev.map((img) => 
            img.file === validFiles[i].file
              ? { ...img, compressing: false, error: "Ошибка сжатия" }
              : img
          )
        );
      }
    }
  }, [toast]);

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
      processFiles(files);
    }
  }, [processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    e.target.value = "";
  }, [processFiles]);

  const removePreviewImage = useCallback((index: number) => {
    setPreviewImages(prev => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleUpload = useCallback(() => {
    const readyImages = previewImages.filter(img => img.compressed && !img.error);
    if (readyImages.length === 0) {
      toast({ title: "Нет готовых изображений", variant: "destructive" });
      return;
    }

    const blobs = readyImages.map(img => img.compressed!);
    uploadMutation.mutate(blobs);
  }, [previewImages, uploadMutation, toast]);

  const hasCompressing = previewImages.some(img => img.compressing);
  const readyCount = previewImages.filter(img => img.compressed && !img.error).length;

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
                  <p className="text-sm text-muted-foreground">Загрузка на сервер...</p>
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
                    JPG, PNG, GIF, WebP до 10 МБ • Автоматическое сжатие до 1920px
                  </p>
                </>
              )}
            </div>

            {previewImages.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Предпросмотр ({previewImages.length})</h4>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        previewImages.forEach(img => URL.revokeObjectURL(img.preview));
                        setPreviewImages([]);
                      }}
                      data-testid="button-clear-preview"
                    >
                      Очистить
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleUpload}
                      disabled={hasCompressing || readyCount === 0 || uploading}
                      data-testid="button-upload-images"
                    >
                      {hasCompressing ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin rounded-full h-3 w-3 border-2 border-primary-foreground border-t-transparent" />
                          Сжатие...
                        </span>
                      ) : (
                        `Загрузить ${readyCount} фото`
                      )}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {previewImages.map((img, index) => (
                    <div
                      key={index}
                      className="relative rounded-lg overflow-hidden border bg-muted/30 aspect-square"
                    >
                      <img
                        src={img.preview}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {img.compressing && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto" />
                            <p className="text-xs text-muted-foreground mt-1">Сжатие...</p>
                          </div>
                        </div>
                      )}
                      {img.error && (
                        <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center">
                          <AlertCircle className="h-6 w-6 text-destructive" />
                        </div>
                      )}
                      {img.compressed && !img.error && (
                        <div className="absolute bottom-1 left-1">
                          <Badge variant="secondary" className="text-xs px-1">
                            {formatFileSize(img.compressed.size)}
                          </Badge>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removePreviewImage(index)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/80 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
                        data-testid={`button-remove-preview-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
