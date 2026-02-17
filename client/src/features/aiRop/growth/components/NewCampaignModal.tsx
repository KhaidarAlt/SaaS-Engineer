import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { createCampaign, GROWTH_KEYS } from "../api/growthApi";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  CAMPAIGN_TYPE_LABELS, CAMPAIGN_TYPE_DESCRIPTIONS,
  type CampaignType,
} from "../types/growthTypes";
import { RefreshCw, ShoppingBag, MessageCircle, Bell, Star, Loader2 } from "lucide-react";

const TYPE_ICONS: Record<CampaignType, typeof RefreshCw> = {
  REACTIVATION: RefreshCw,
  UPSELL: ShoppingBag,
  ABANDONED: MessageCircle,
  REMINDER: Bell,
  NPS: Star,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewCampaignModal({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedType, setSelectedType] = useState<CampaignType>("REACTIVATION");
  const [name, setName] = useState("");

  const createMut = useMutation({
    mutationFn: () => createCampaign({
      type: selectedType,
      name: name || CAMPAIGN_TYPE_LABELS[selectedType],
    }),
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: GROWTH_KEYS.summary });
      queryClient.invalidateQueries({ queryKey: GROWTH_KEYS.campaigns });
      onOpenChange(false);
      setName("");
      navigate(`/dashboard/ai/rop/growth/campaign/${campaign.id}`);
    },
    onError: () => {
      toast({ title: "Ошибка создания кампании", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="new-campaign-modal">
        <DialogHeader>
          <DialogTitle>Новая кампания</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            {(Object.keys(CAMPAIGN_TYPE_LABELS) as CampaignType[]).map((type) => {
              const Icon = TYPE_ICONS[type];
              const isSelected = selectedType === type;
              return (
                <Card
                  key={type}
                  className={`cursor-pointer transition-colors ${isSelected ? "border-primary bg-primary/5" : "hover-elevate"}`}
                  onClick={() => setSelectedType(type)}
                  data-testid={`type-${type.toLowerCase()}`}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={`rounded-md p-2 ${isSelected ? "bg-primary/10" : "bg-muted"}`}>
                      <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{CAMPAIGN_TYPE_LABELS[type]}</p>
                      <p className="text-xs text-muted-foreground">{CAMPAIGN_TYPE_DESCRIPTIONS[type]}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">Название (необязательно)</Label>
            <Input
              id="campaign-name"
              placeholder={CAMPAIGN_TYPE_LABELS[selectedType]}
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-campaign-name"
            />
          </div>

          <Button
            className="w-full"
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            data-testid="button-create-campaign"
          >
            {createMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Создать кампанию
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
