import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  ImageIcon,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Category } from "@shared/schema";

const COLUMN_MAPPINGS: Record<string, string[]> = {
  sku: ["sku", "артикул", "код", "code", "id", "product_id"],
  name: ["name", "название", "наименование", "title", "product", "товар"],
  description: ["description", "описание", "desc"],
  price: ["price", "цена", "стоимость", "cost"],
  category: ["category", "категория", "cat", "раздел"],
  stockQty: ["stock", "остаток", "qty", "quantity", "количество", "stock_qty", "наличие"],
  alwaysInStock: ["always_in_stock", "всегдавналичии", "always", "безограничений"],
  inStock: ["in_stock", "вналичии", "available", "доступен"],
  discountType: ["discount_type", "типскидки", "скидкатип"],
  discountValue: ["discount_value", "скидка", "discount", "скидказначение"],
  images: ["images", "фото", "image", "photo", "изображения", "картинки"],
};

interface ParsedRow {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
  warnings: string[];
  autoFixes: string[];
  isValid: boolean;
}

interface ColumnMapping {
  sourceColumn: string;
  targetField: string | null;
}

type ImportMode = "upsert" | "create_only" | "replace";

interface ImportStats {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [importMode, setImportMode] = useState<ImportMode>("upsert");
  const [fieldsToUpdate, setFieldsToUpdate] = useState({
    price: true,
    stockQty: true,
    description: true,
    category: true,
    discount: true,
    images: true,
  });
  const [isImporting, setIsImporting] = useState(false);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [zipImages, setZipImages] = useState<Map<string, Blob>>(new Map());
  const [unmatchedImages, setUnmatchedImages] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const autoMapColumn = (columnName: string): string | null => {
    const normalized = columnName.toLowerCase().trim().replace(/[\s_-]/g, "");
    
    for (const [field, aliases] of Object.entries(COLUMN_MAPPINGS)) {
      for (const alias of aliases) {
        if (normalized === alias.replace(/[\s_-]/g, "") || normalized.includes(alias.replace(/[\s_-]/g, ""))) {
          return field;
        }
      }
    }
    return null;
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportStats(null);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        toast({ title: "Файл пуст или не содержит данных", variant: "destructive" });
        return;
      }

      const headers = (jsonData[0] as string[]).map(h => String(h || "").trim());
      setColumns(headers);

      const mappings: ColumnMapping[] = headers.map(col => ({
        sourceColumn: col,
        targetField: autoMapColumn(col),
      }));
      setColumnMappings(mappings);

      const rows: ParsedRow[] = [];
      for (let i = 1; i < Math.min(jsonData.length, 21); i++) {
        const rowData = jsonData[i] as any[];
        const data: Record<string, string> = {};
        headers.forEach((header, idx) => {
          data[header] = String(rowData[idx] ?? "").trim();
        });

        const errors: string[] = [];
        const warnings: string[] = [];
        const autoFixes: string[] = [];

        const skuField = mappings.find(m => m.targetField === "sku")?.sourceColumn;
        const nameField = mappings.find(m => m.targetField === "name")?.sourceColumn;
        const priceField = mappings.find(m => m.targetField === "price")?.sourceColumn;
        const categoryField = mappings.find(m => m.targetField === "category")?.sourceColumn;

        if (!skuField || !data[skuField]) {
          errors.push("Отсутствует артикул (SKU)");
        }
        if (!nameField || !data[nameField]) {
          errors.push("Отсутствует название");
        }
        if (priceField && data[priceField] && isNaN(parseFloat(data[priceField]))) {
          const cleaned = data[priceField].replace(/[^\d.,]/g, "").replace(",", ".");
          if (cleaned && !isNaN(parseFloat(cleaned))) {
            autoFixes.push(`Цена исправлена: "${data[priceField]}" → ${cleaned}`);
            data[priceField] = cleaned;
          } else {
            errors.push("Цена не является числом");
          }
        }
        if (categoryField && data[categoryField]) {
          const cat = categories?.find(c => 
            c.name.toLowerCase() === data[categoryField].toLowerCase() ||
            c.slug === data[categoryField].toLowerCase()
          );
          if (!cat) {
            autoFixes.push(`Категория "${data[categoryField]}" будет создана автоматически`);
          }
        }

        rows.push({
          rowNumber: i + 1,
          data,
          errors,
          warnings,
          autoFixes,
          isValid: errors.length === 0,
        });
      }

      setParsedData(rows);
      toast({ title: `Загружено ${jsonData.length - 1} строк` });
    } catch (error) {
      console.error("Parse error:", error);
      toast({ title: "Ошибка чтения файла", variant: "destructive" });
    }
  }, [categories, toast]);

  const handleZipSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setZipFile(selectedFile);

    try {
      const zip = await JSZip.loadAsync(selectedFile);
      const images = new Map<string, Blob>();
      const allFiles: string[] = [];

      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;
        
        const ext = relativePath.split(".").pop()?.toLowerCase();
        if (!["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) continue;

        allFiles.push(relativePath);
        const blob = await zipEntry.async("blob");
        
        const fileName = relativePath.split("/").pop() || "";
        const sku = fileName.replace(/\.[^/.]+$/, "").replace(/[-_]\d+$/, "");
        
        if (!images.has(sku)) {
          images.set(sku, blob);
        } else {
          const key = `${sku}_gallery_${images.size}`;
          images.set(key, blob);
        }
      }

      setZipImages(images);
      
      const skuField = columnMappings.find(m => m.targetField === "sku")?.sourceColumn;
      const existingSkus = new Set(parsedData.map(row => skuField ? row.data[skuField]?.toLowerCase() : ""));
      
      const unmatched = Array.from(images.keys()).filter(sku => {
        const baseSku = sku.replace(/_gallery_\d+$/, "");
        return !existingSkus.has(baseSku.toLowerCase());
      });
      
      setUnmatchedImages(unmatched);
      toast({ title: `Загружено ${images.size} изображений из ZIP` });
    } catch (error) {
      console.error("ZIP parse error:", error);
      toast({ title: "Ошибка чтения ZIP файла", variant: "destructive" });
    }
  }, [columnMappings, parsedData, toast]);

  const updateColumnMapping = (sourceColumn: string, targetField: string | null) => {
    setColumnMappings(prev => 
      prev.map(m => m.sourceColumn === sourceColumn ? { ...m, targetField } : m)
    );
  };

  const handleImport = async () => {
    if (parsedData.length === 0) {
      toast({ title: "Нет данных для импорта", variant: "destructive" });
      return;
    }

    setIsImporting(true);
    const stats: ImportStats = { total: 0, created: 0, updated: 0, skipped: 0, errors: 0 };

    try {
      const skuField = columnMappings.find(m => m.targetField === "sku")?.sourceColumn;
      const nameField = columnMappings.find(m => m.targetField === "name")?.sourceColumn;
      const priceField = columnMappings.find(m => m.targetField === "price")?.sourceColumn;
      const categoryField = columnMappings.find(m => m.targetField === "category")?.sourceColumn;
      const stockField = columnMappings.find(m => m.targetField === "stockQty")?.sourceColumn;
      const descField = columnMappings.find(m => m.targetField === "description")?.sourceColumn;

      const createdCategories = new Map<string, string>();

      const categoryNamesMap = new Map<string, string>();
      for (const row of parsedData) {
        if (!row.isValid) continue;
        if (categoryField && row.data[categoryField]) {
          const catName = row.data[categoryField].trim();
          if (catName) {
            const normalizedKey = catName.toLowerCase().trim();
            const existing = categories?.find(c =>
              c.name.toLowerCase().trim() === normalizedKey ||
              c.slug === normalizedKey
            );
            if (!existing && !categoryNamesMap.has(normalizedKey)) {
              categoryNamesMap.set(normalizedKey, catName);
            }
          }
        }
      }

      for (const [normalizedKey, catName] of categoryNamesMap) {
        try {
          const newCat = await apiRequest("POST", "/api/categories", {
            name: catName,
          });
          createdCategories.set(normalizedKey, newCat.id);
        } catch (error) {
          console.error(`Failed to create category "${catName}":`, error);
        }
      }

      if (createdCategories.size > 0) {
        await queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      }

      for (const row of parsedData) {
        if (!row.isValid) {
          stats.skipped++;
          continue;
        }

        stats.total++;

        const sku = skuField ? row.data[skuField] : "";
        const name = nameField ? row.data[nameField] : "";
        const rawPrice = priceField ? row.data[priceField] : "0";
        const price = rawPrice.replace(/[^\d.,]/g, "").replace(",", ".") || "0";
        const categoryName = categoryField ? row.data[categoryField] : "";
        const stockQty = stockField ? parseInt(row.data[stockField]) || 0 : 0;
        const description = descField ? row.data[descField] : "";

        let categoryId: string | undefined;
        if (fieldsToUpdate.category && categoryName) {
          const normalizedCat = categoryName.toLowerCase().trim();
          const existingCat = categories?.find(c =>
            c.name.toLowerCase().trim() === normalizedCat ||
            c.slug === normalizedCat
          );
          categoryId = existingCat?.id || createdCategories.get(normalizedCat);
        }

        const productData = {
          sku,
          name,
          price,
          description: fieldsToUpdate.description ? description : undefined,
          categoryId,
          stockQty: fieldsToUpdate.stockQty ? stockQty : undefined,
          inStock: true,
          alwaysInStock: false,
          isActive: true,
        };

        try {
          if (importMode === "upsert") {
            const result = await apiRequest("POST", "/api/import/product", {
              ...productData,
              mode: "upsert",
              fieldsToUpdate,
            });
            if (result.created) {
              stats.created++;
            } else {
              stats.updated++;
            }
          } else if (importMode === "create_only") {
            await apiRequest("POST", "/api/products", productData);
            stats.created++;
          }
        } catch (error) {
          stats.errors++;
        }
      }

      setImportStats(stats);
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      
      const autoFixMsg = createdCategories.size > 0
        ? `, Категорий создано: ${createdCategories.size}`
        : "";
      toast({ 
        title: "Импорт завершён",
        description: `Создано: ${stats.created}, Обновлено: ${stats.updated}, Ошибок: ${stats.errors}${autoFixMsg}`,
      });
    } catch (error) {
      toast({ title: "Ошибка импорта", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ["SKU", "Название", "Описание", "Цена", "Категория", "Остаток", "ВсегдаВНаличии", "ВНаличии"];
    const example = ["PROD001", "Пример товара", "Описание товара", "1000", "Электроника", "50", "нет", "да"];
    
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Шаблон");
    XLSX.writeFile(wb, "import_template.xlsx");
  };

  const validRows = parsedData.filter(r => r.isValid).length;
  const errorRows = parsedData.filter(r => !r.isValid).length;
  const warningRows = parsedData.filter(r => r.warnings.length > 0).length;
  const autoFixRows = parsedData.filter(r => r.autoFixes && r.autoFixes.length > 0).length;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Импорт каталога</h1>
              <p className="text-muted-foreground">
                Загрузите CSV или XLSX файл с товарами
              </p>
            </div>
            <Button variant="outline" onClick={downloadTemplate} data-testid="button-download-template">
              <Download className="h-4 w-4 mr-2" />
              Скачать шаблон
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  Файл с товарами
                </CardTitle>
                <CardDescription>CSV или XLSX файл</CardDescription>
              </CardHeader>
              <CardContent>
                <label className="block">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleFileSelect}
                    data-testid="input-import-file"
                  />
                  <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
                    {file ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                        <span className="text-sm font-medium">{file.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.preventDefault();
                            setFile(null);
                            setParsedData([]);
                            setColumns([]);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Нажмите или перетащите файл
                        </p>
                      </>
                    )}
                  </div>
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  Архив с фото (ZIP)
                </CardTitle>
                <CardDescription>Изображения будут сопоставлены по SKU</CardDescription>
              </CardHeader>
              <CardContent>
                <label className="block">
                  <input
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={handleZipSelect}
                    data-testid="input-import-zip"
                  />
                  <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
                    {zipFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <ImageIcon className="h-5 w-5 text-primary" />
                        <span className="text-sm font-medium">{zipFile.name}</span>
                        <Badge variant="secondary">{zipImages.size} фото</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.preventDefault();
                            setZipFile(null);
                            setZipImages(new Map());
                            setUnmatchedImages([]);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Нажмите или перетащите ZIP
                        </p>
                      </>
                    )}
                  </div>
                </label>
              </CardContent>
            </Card>
          </div>

          {columns.length > 0 && (
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Сопоставление колонок</CardTitle>
                <CardDescription>Проверьте автоматическое сопоставление колонок</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {columnMappings.map((mapping) => (
                    <div key={mapping.sourceColumn} className="space-y-1">
                      <Label className="text-xs text-muted-foreground truncate block">
                        {mapping.sourceColumn}
                      </Label>
                      <Select
                        value={mapping.targetField || "ignore"}
                        onValueChange={(value) => 
                          updateColumnMapping(mapping.sourceColumn, value === "ignore" ? null : value)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs" data-testid={`select-mapping-${mapping.sourceColumn}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ignore">— Пропустить —</SelectItem>
                          <SelectItem value="sku">Артикул (SKU)</SelectItem>
                          <SelectItem value="name">Название</SelectItem>
                          <SelectItem value="description">Описание</SelectItem>
                          <SelectItem value="price">Цена</SelectItem>
                          <SelectItem value="category">Категория</SelectItem>
                          <SelectItem value="stockQty">Остаток</SelectItem>
                          <SelectItem value="inStock">В наличии</SelectItem>
                          <SelectItem value="alwaysInStock">Всегда в наличии</SelectItem>
                          <SelectItem value="discountType">Тип скидки</SelectItem>
                          <SelectItem value="discountValue">Скидка</SelectItem>
                          <SelectItem value="images">Изображения</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {parsedData.length > 0 && (
            <>
              <Card className="mb-6">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Настройки импорта</CardTitle>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          {validRows} готово
                        </Badge>
                        {autoFixRows > 0 && (
                          <Badge variant="outline" className="gap-1 border-blue-500 text-blue-600 dark:text-blue-400">
                            <CheckCircle2 className="h-3 w-3" />
                            {autoFixRows} автоисправлений
                          </Badge>
                        )}
                        {errorRows > 0 && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {errorRows} ошибок
                          </Badge>
                        )}
                        {warningRows > 0 && (
                          <Badge variant="secondary" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {warningRows} предупреждений
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label>Режим импорта</Label>
                      <Select value={importMode} onValueChange={(v) => setImportMode(v as ImportMode)}>
                        <SelectTrigger data-testid="select-import-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="upsert">Обновить существующие (по SKU)</SelectItem>
                          <SelectItem value="create_only">Только создавать новые</SelectItem>
                          <SelectItem value="replace">Заменить каталог</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {importMode === "upsert" && (
                      <div className="space-y-3">
                        <Label>Какие поля обновлять</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(fieldsToUpdate).map(([field, enabled]) => (
                            <div key={field} className="flex items-center justify-between py-1">
                              <Label className="text-sm font-normal">
                                {{
                                  price: "Цена",
                                  stockQty: "Остаток",
                                  description: "Описание",
                                  category: "Категория",
                                  discount: "Скидки",
                                  images: "Фото",
                                }[field]}
                              </Label>
                              <Switch
                                checked={enabled}
                                onCheckedChange={(checked) =>
                                  setFieldsToUpdate(prev => ({ ...prev, [field]: checked }))
                                }
                                data-testid={`switch-update-${field}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Collapsible open={showPreview} onOpenChange={setShowPreview}>
                <Card className="mb-6">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover-elevate py-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          Предпросмотр (первые 20 строк)
                        </CardTitle>
                        {showPreview ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="border rounded-lg overflow-auto max-h-96">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">#</TableHead>
                              <TableHead className="min-w-[180px]">Статус</TableHead>
                              {columnMappings
                                .filter(m => m.targetField)
                                .map(m => (
                                  <TableHead key={m.sourceColumn}>{m.sourceColumn}</TableHead>
                                ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {parsedData.map((row) => (
                              <TableRow key={row.rowNumber} className={!row.isValid ? "bg-destructive/5" : ""}>
                                <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                                <TableCell>
                                  {row.isValid ? (
                                    row.autoFixes && row.autoFixes.length > 0 ? (
                                      <div className="space-y-1">
                                        <Badge variant="outline" className="text-xs border-blue-500 text-blue-600 dark:text-blue-400">
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          Авто
                                        </Badge>
                                        {row.autoFixes.map((fix, i) => (
                                          <p key={i} className="text-[11px] text-blue-600 dark:text-blue-400">{fix}</p>
                                        ))}
                                      </div>
                                    ) : row.warnings.length > 0 ? (
                                      <div className="space-y-1">
                                        <Badge variant="secondary" className="text-xs">
                                          <AlertTriangle className="h-3 w-3 mr-1" />
                                          Предупр.
                                        </Badge>
                                        {row.warnings.map((w, i) => (
                                          <p key={i} className="text-[11px] text-muted-foreground">{w}</p>
                                        ))}
                                      </div>
                                    ) : (
                                      <Badge variant="outline" className="text-xs text-green-600">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        ОК
                                      </Badge>
                                    )
                                  ) : (
                                    <div className="space-y-1">
                                      <Badge variant="destructive" className="text-xs">
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                        Ошибка
                                      </Badge>
                                      {row.errors.map((err, i) => (
                                        <div key={i} className="text-[11px]">
                                          <p className="font-medium text-destructive">{err}</p>
                                          <p className="text-muted-foreground">
                                            {err.includes("артикул") && "Добавьте колонку с артикулом (SKU) в файл или укажите маппинг"}
                                            {err.includes("название") && "Добавьте колонку с названием товара в файл или укажите маппинг"}
                                            {err.includes("не является числом") && "Укажите цену цифрами, например: 15000"}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </TableCell>
                                {columnMappings
                                  .filter(m => m.targetField)
                                  .map(m => (
                                    <TableCell key={m.sourceColumn} className="text-xs max-w-32 truncate">
                                      {row.data[m.sourceColumn] || "—"}
                                    </TableCell>
                                  ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {unmatchedImages.length > 0 && (
                <Card className="mb-6 border-yellow-500/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-yellow-600">
                      <AlertTriangle className="h-5 w-5" />
                      Нераспознанные изображения ({unmatchedImages.length})
                    </CardTitle>
                    <CardDescription>
                      Эти изображения не удалось сопоставить с товарами по SKU
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {unmatchedImages.slice(0, 10).map(name => (
                        <Badge key={name} variant="outline">{name}</Badge>
                      ))}
                      {unmatchedImages.length > 10 && (
                        <Badge variant="secondary">+{unmatchedImages.length - 10} ещё</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {importStats && (
                <Card className="mb-6 border-green-500/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      Результаты импорта
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold">{importStats.total}</div>
                        <div className="text-xs text-muted-foreground">Всего</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">{importStats.created}</div>
                        <div className="text-xs text-muted-foreground">Создано</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600">{importStats.updated}</div>
                        <div className="text-xs text-muted-foreground">Обновлено</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-red-600">{importStats.errors}</div>
                        <div className="text-xs text-muted-foreground">Ошибок</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFile(null);
                    setParsedData([]);
                    setColumns([]);
                    setColumnMappings([]);
                    setImportStats(null);
                  }}
                  data-testid="button-clear-import"
                >
                  Очистить
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={isImporting || validRows === 0}
                  data-testid="button-start-import"
                >
                  {isImporting ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                      Импорт...
                    </span>
                  ) : (
                    `Импортировать ${validRows} товаров`
                  )}
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
