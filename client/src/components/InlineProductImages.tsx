import { useState, useCallback, useImperativeHandle, forwardRef, useRef, useEffect } from "react";
import { Plus, X, Upload, AlertCircle, ImageIcon, Star, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

async function requestPresignedUrl(blobSize: number): Promise<{ uploadURL: string; objectPath: string }> {
  const response = await fetch("/api/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      name: `image_${Date.now()}.jpg`,
      size: blobSize,
      contentType: "image/jpeg",
    }),
  });
  
  if (response.status === 401) {
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }
  
  if (!response.ok) {
    throw new Error("Failed to get upload URL");
  }
  
  return response.json();
}

async function uploadToPresignedUrl(uploadURL: string, blob: Blob): Promise<void> {
  const response = await fetch(uploadURL, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": "image/jpeg" },
  });
  
  if (!response.ok) {
    throw new Error("Upload failed");
  }
}

async function saveImageRecords(productId: string, objectPaths: string[]): Promise<any> {
  const response = await fetch(`/api/products/${productId}/images`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ objectPaths }),
  });
  
  if (response.status === 401) {
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }
  
  if (!response.ok) {
    throw new Error("Save failed");
  }

  return response.json();
}

async function setMainImage(productId: string, imageId: string): Promise<void> {
  const response = await fetch(`/api/products/${productId}/images/${imageId}/main`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to set main image");
  }
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1920;
const COMPRESSION_QUALITY = 0.85;

interface PreviewImage {
  id: string;
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

interface InlineProductImagesProps {
  onCompressionChange?: (isCompressing: boolean) => void;
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

let nextId = 0;
function generateId() {
  return `img_${Date.now()}_${nextId++}`;
}

export const InlineProductImages = forwardRef<InlineProductImagesRef, InlineProductImagesProps>(
  ({ onCompressionChange }, ref) => {
  const [isDragging, setIsDragging] = useState(false);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [mainImageId, setMainImageId] = useState<string | null>(null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const { toast } = useToast();
  
  const previewImagesRef = useRef<PreviewImage[]>([]);
  const dragItemIdRef = useRef<string | null>(null);
  const mainImageIdRef = useRef<string | null>(null);
  const compressionResolversRef = useRef<(() => void)[]>([]);
  const prevCompressionStateRef = useRef<boolean>(false);
  
  useEffect(() => {
    previewImagesRef.current = previewImages;
    mainImageIdRef.current = mainImageId;
    const isCompressing = previewImages.some(img => img.compressing);
    
    if (prevCompressionStateRef.current !== isCompressing) {
      prevCompressionStateRef.current = isCompressing;
      onCompressionChange?.(isCompressing);
    }
    
    if (!isCompressing && compressionResolversRef.current.length > 0) {
      compressionResolversRef.current.forEach(resolve => resolve());
      compressionResolversRef.current = [];
    }
  }, [previewImages, mainImageId, onCompressionChange]);

  useImperativeHandle(ref, () => ({
    uploadImages: async (productId: string) => {
      const images = previewImagesRef.current;
      const readyImages = images.filter(img => img.compressed && !img.error);
      if (readyImages.length === 0) return;

      const objectPaths: string[] = [];
      
      for (const img of readyImages) {
        const { uploadURL, objectPath } = await requestPresignedUrl(img.compressed!.size);
        await uploadToPresignedUrl(uploadURL, img.compressed!);
        objectPaths.push(objectPath);
      }

      const savedImages = await saveImageRecords(productId, objectPaths);
      const savedArray = Array.isArray(savedImages) ? savedImages : [];

      const selectedMainId = mainImageIdRef.current;
      if (selectedMainId && savedArray.length > 0) {
        const mainIdx = readyImages.findIndex(img => img.id === selectedMainId);
        if (mainIdx >= 0 && savedArray[mainIdx]?.id) {
          if (mainIdx !== 0) {
            await setMainImage(productId, savedArray[mainIdx].id);
          }
        } else if (mainIdx === -1) {
          console.warn("[InlineProductImages] Selected main image was not in ready images (compression error?), defaulting to first");
        }
      }

      setPreviewImages(prev => {
        prev.forEach(img => URL.revokeObjectURL(img.preview));
        return [];
      });
      setMainImageId(null);
    },
    hasImages: () => previewImagesRef.current.filter(img => img.compressed && !img.error).length > 0,
    getImageCount: () => previewImagesRef.current.filter(img => img.compressed && !img.error).length,
    isCompressing: () => previewImagesRef.current.some(img => img.compressing),
    waitForCompression: () => {
      return new Promise<void>((resolve) => {
        if (!previewImagesRef.current.some(img => img.compressing)) {
          resolve();
          return;
        }
        compressionResolversRef.current.push(resolve);
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
        id: generateId(),
        file,
        preview: URL.createObjectURL(file),
        compressed: null,
        compressing: true,
      });
    }

    setPreviewImages(prev => {
      const updated = [...prev, ...validFiles];
      if (prev.length === 0 && validFiles.length > 0) {
        setMainImageId(validFiles[0].id);
      }
      return updated;
    });

    for (let i = 0; i < validFiles.length; i++) {
      try {
        const compressed = await compressImage(validFiles[i].file);
        setPreviewImages(prev => 
          prev.map((img) => 
            img.id === validFiles[i].id
              ? { ...img, compressed, compressing: false }
              : img
          )
        );
      } catch {
        setPreviewImages(prev => 
          prev.map((img) => 
            img.id === validFiles[i].id
              ? { ...img, compressing: false, error: "Ошибка сжатия" }
              : img
          )
        );
      }
    }
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!dragItemIdRef.current) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!dragItemIdRef.current) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (dragItemIdRef.current) return;

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

  const removePreviewImage = useCallback((id: string) => {
    setPreviewImages(prev => {
      const removed = prev.find(img => img.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      const newImages = prev.filter(img => img.id !== id);
      return newImages;
    });
    setMainImageId(prev => {
      if (prev === id) {
        const remaining = previewImagesRef.current.filter(img => img.id !== id);
        return remaining.length > 0 ? remaining[0].id : null;
      }
      return prev;
    });
  }, []);

  const handleItemDragStart = useCallback((e: React.DragEvent, id: string) => {
    dragItemIdRef.current = id;
    setDragItemId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }, []);

  const handleItemDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragItemIdRef.current && dragItemIdRef.current !== id) {
      setDragOverId(id);
    }
  }, []);

  const handleItemDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = e.dataTransfer.getData("text/plain") || dragItemIdRef.current;
    if (!sourceId || sourceId === targetId) {
      setDragItemId(null);
      setDragOverId(null);
      dragItemIdRef.current = null;
      return;
    }

    setPreviewImages(prev => {
      const dragIdx = prev.findIndex(img => img.id === sourceId);
      const targetIdx = prev.findIndex(img => img.id === targetId);
      if (dragIdx === -1 || targetIdx === -1) return prev;

      const newImages = [...prev];
      const [moved] = newImages.splice(dragIdx, 1);
      newImages.splice(targetIdx, 0, moved);
      return newImages;
    });

    setDragItemId(null);
    setDragOverId(null);
    dragItemIdRef.current = null;
  }, []);

  const handleItemDragEnd = useCallback(() => {
    dragItemIdRef.current = null;
    setDragItemId(null);
    setDragOverId(null);
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
          Перетащите изображения сюда или
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
          JPG, PNG, GIF, WebP до 10 МБ • Авто-оптимизация: квадрат до 1920px
        </p>
      </div>

      {previewImages.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            Перетаскивайте фото для изменения порядка. Нажмите звёздочку для выбора главного фото.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {previewImages.map((img) => {
              const isMain = mainImageId === img.id;
              const isDragTarget = dragOverId === img.id;
              const isBeingDragged = dragItemId === img.id;

              return (
                <div
                  key={img.id}
                  draggable
                  onDragStart={(e) => handleItemDragStart(e, img.id)}
                  onDragOver={(e) => handleItemDragOver(e, img.id)}
                  onDrop={(e) => handleItemDrop(e, img.id)}
                  onDragEnd={handleItemDragEnd}
                  className={`relative group cursor-grab active:cursor-grabbing transition-all ${
                    isBeingDragged ? "opacity-40 scale-95" : ""
                  } ${isDragTarget ? "ring-2 ring-primary ring-offset-2 rounded-lg" : ""}`}
                  data-testid={`image-item-${img.id}`}
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-muted border">
                    <img
                      src={img.preview}
                      alt=""
                      className="w-full h-full object-cover pointer-events-none"
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
                      <div className="absolute inset-0 bg-destructive/80 flex items-center justify-center">
                        <AlertCircle className="h-6 w-6 text-destructive-foreground" />
                      </div>
                    )}
                  </div>

                  {isMain && (
                    <div className="absolute top-1.5 left-1.5">
                      <Badge variant="default" className="text-xs px-1.5 py-0.5">
                        <Star className="h-3 w-3 mr-1 fill-current" />
                        Главное
                      </Badge>
                    </div>
                  )}

                  <div className="absolute top-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical className="h-5 w-5 text-white drop-shadow-md" />
                  </div>

                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    {!isMain && !img.error && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); setMainImageId(img.id); }}
                        title="Сделать главным"
                        data-testid={`button-set-main-${img.id}`}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); removePreviewImage(img.id); }}
                      data-testid={`button-remove-image-${img.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="absolute bottom-1 left-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {img.compressed
                        ? formatFileSize(img.compressed.size)
                        : formatFileSize(img.file.size)}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {previewImages.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {previewImages.some(img => img.compressing)
            ? "Сжатие изображений..."
            : `${previewImages.filter(img => img.compressed && !img.error).length} фото готовы к загрузке`}
        </p>
      )}
    </div>
  );
});

InlineProductImages.displayName = "InlineProductImages";
