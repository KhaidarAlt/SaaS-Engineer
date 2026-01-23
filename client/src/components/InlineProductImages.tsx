import { useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { Plus, X, Upload, AlertCircle, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1920;
const COMPRESSION_QUALITY = 0.85;

interface PreviewImage {
  file: File;
  preview: string;
  compressed: Blob | null;
  compressing: boolean;
  error?: string;
}

export interface InlineProductImagesRef {
  uploadImages: (productId: string) => Promise<void>;
  hasImages: () => boolean;
  getImageCount: () => number;
  isCompressing: () => boolean;
  waitForCompression: () => Promise<void>;
}

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

export const InlineProductImages = forwardRef<InlineProductImagesRef>((_, ref) => {
  const [isDragging, setIsDragging] = useState(false);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const { toast } = useToast();

  useImperativeHandle(ref, () => ({
    uploadImages: async (productId: string) => {
      const readyImages = previewImages.filter(img => img.compressed && !img.error);
      if (readyImages.length === 0) return;

      const formData = new FormData();
      readyImages.forEach((img, index) => {
        formData.append("images", img.compressed!, `image_${index}.jpg`);
      });

      const response = await fetch(`/api/products/${productId}/images`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      setPreviewImages(prev => {
        prev.forEach(img => URL.revokeObjectURL(img.preview));
        return [];
      });
    },
    hasImages: () => previewImages.filter(img => img.compressed && !img.error).length > 0,
    getImageCount: () => previewImages.filter(img => img.compressed && !img.error).length,
    isCompressing: () => previewImages.some(img => img.compressing),
    waitForCompression: async () => {
      return new Promise<void>((resolve) => {
        const checkCompression = () => {
          const stillCompressing = previewImages.some(img => img.compressing);
          if (!stillCompressing) {
            resolve();
          } else {
            setTimeout(checkCompression, 100);
          }
        };
        checkCompression();
      });
    },
  }));

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
          prev.map((img) => 
            img.file === validFiles[i].file
              ? { ...img, compressed, compressing: false }
              : img
          )
        );
      } catch {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Изображения товара</span>
        {previewImages.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {previewImages.length}
          </Badge>
        )}
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid="dropzone-product-images"
      >
        <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-2">
          Перетащите изображения или
        </p>
        <label>
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
            data-testid="input-inline-image-upload"
          />
          <Button variant="outline" size="sm" asChild>
            <span className="cursor-pointer">
              <Plus className="h-4 w-4 mr-1" />
              Выбрать файлы
            </span>
          </Button>
        </label>
        <p className="text-xs text-muted-foreground mt-2">
          До 10 МБ на файл, автосжатие до 1920px
        </p>
      </div>

      {previewImages.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {previewImages.map((img, index) => (
            <div key={index} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                <img
                  src={img.preview}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                {img.compressing && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                  </div>
                )}
                {img.error && (
                  <div className="absolute inset-0 bg-destructive/80 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-destructive-foreground" />
                  </div>
                )}
              </div>
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removePreviewImage(index)}
                data-testid={`button-remove-image-${index}`}
              >
                <X className="h-3 w-3" />
              </Button>
              <div className="absolute bottom-1 left-1 right-1">
                <Badge variant="secondary" className="text-[10px] w-full justify-center">
                  {img.compressed
                    ? formatFileSize(img.compressed.size)
                    : formatFileSize(img.file.size)}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewImages.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {previewImages.some(img => img.compressing)
            ? "Сжатие изображений..."
            : "Изображения будут загружены при сохранении товара"}
        </p>
      )}
    </div>
  );
});

InlineProductImages.displayName = "InlineProductImages";
