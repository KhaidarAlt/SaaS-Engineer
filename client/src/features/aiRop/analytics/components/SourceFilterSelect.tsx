import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SourceFilter } from "../types/analyticsTypes";

interface SourceFilterSelectProps {
  value: SourceFilter;
  onChange: (source: SourceFilter) => void;
}

export function SourceFilterSelect({ value, onChange }: SourceFilterSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SourceFilter)}>
      <SelectTrigger className="w-[160px]" data-testid="select-source-filter">
        <SelectValue placeholder="Источник" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">Все</SelectItem>
        <SelectItem value="PRODUCTION">Production</SelectItem>
        <SelectItem value="TESTING">Тестирование</SelectItem>
      </SelectContent>
    </Select>
  );
}
