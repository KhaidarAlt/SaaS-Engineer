import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  MessageCircle, Users, Send, Settings, BarChart3, 
  Clock, Shield, AlertTriangle, CheckCircle, XCircle,
  RefreshCw, Sparkles, Phone
} from "lucide-react";

interface HealthStatus {
  status: 'safe' | 'caution' | 'stop';
  message: string;
  replyRate: number;
  dailyLimit: number;
  sentToday: number;
}

interface Stats {
  totalContacts: number;
  eligibleContacts: number;
  messagesSentToday: number;
  replyRate: number;
  healthStatus: HealthStatus;
}

interface SmartContact {
  id: string;
  phone: string;
  name: string | null;
  hasDialogHistory: boolean;
  doNotDisturb: boolean;
  isBlocked: boolean;
  lastClientReplyAt: string | null;
  lastMessageSentAt: string | null;
  totalMessagesSent: number;
  totalRepliesReceived: number;
  interactionScore: number;
}

interface SmartMessage {
  id: string;
  contactId: string;
  triggerType: string;
  messageText: string;
  status: string;
  sentAt: string | null;
  replyReceived: boolean;
  createdAt: string;
}

interface Settings {
  enabled: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
  maxFollowUpsPerClient: number;
  minHoursBetweenMessages: number;
  dailyMessageLimit: number;
  autoStopOnNegativeSignals: boolean;
}

const TRIGGER_LABELS: Record<string, string> = {
  abandoned_cart: 'Брошенная корзина',
  unpaid_order: 'Неоплаченный заказ',
  reactivation: 'Реактивация',
  inactivity: 'Неактивность',
  manual: 'Ручная отправка'
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: 'Ожидает', variant: 'secondary' },
  queued: { label: 'В очереди', variant: 'secondary' },
  sent: { label: 'Отправлено', variant: 'default' },
  delivered: { label: 'Доставлено', variant: 'default' },
  read: { label: 'Прочитано', variant: 'default' },
  failed: { label: 'Ошибка', variant: 'destructive' },
  cancelled: { label: 'Отменено', variant: 'outline' }
};

export default function SmartContactPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedTrigger, setSelectedTrigger] = useState<string>("reactivation");
  const [previewMessage, setPreviewMessage] = useState<string>("");
  const [maxMessages, setMaxMessages] = useState(10);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<Stats>({
    queryKey: ['/api/smart-contact/stats']
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<Settings>({
    queryKey: ['/api/smart-contact/settings']
  });

  const { data: contacts, isLoading: contactsLoading } = useQuery<SmartContact[]>({
    queryKey: ['/api/smart-contact/contacts']
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<SmartMessage[]>({
    queryKey: ['/api/smart-contact/messages']
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<Settings>) => {
      const res = await apiRequest('PUT', '/api/smart-contact/settings', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/smart-contact/settings'] });
      toast({ title: "Настройки сохранены" });
    }
  });

  const generateMessageMutation = useMutation({
    mutationFn: async (data: { triggerType: string; context?: object }) => {
      const res = await apiRequest('POST', '/api/smart-contact/generate-message', data);
      return res.json() as Promise<{ message: string }>;
    },
    onSuccess: (data) => {
      setPreviewMessage(data.message);
    }
  });

  const batchSendMutation = useMutation({
    mutationFn: async (data: { triggerType: string; maxMessages: number }) => {
      const res = await apiRequest('POST', '/api/smart-contact/batch-send', data);
      return res.json() as Promise<{ queued: number; message: string }>;
    },
    onSuccess: (data) => {
      toast({ title: "Успешно", description: data.message });
      queryClient.invalidateQueries({ queryKey: ['/api/smart-contact/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/smart-contact/messages'] });
    },
    onError: (error: any) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    }
  });

  const handleToggleEnabled = (enabled: boolean) => {
    updateSettingsMutation.mutate({ enabled });
  };

  const handleGeneratePreview = () => {
    generateMessageMutation.mutate({ triggerType: selectedTrigger });
  };

  const handleBatchSend = () => {
    batchSendMutation.mutate({ triggerType: selectedTrigger, maxMessages });
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'safe': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'caution': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'stop': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return null;
    }
  };

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'safe': return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Безопасно</Badge>;
      case 'caution': return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Осторожно</Badge>;
      case 'stop': return <Badge variant="destructive">Остановлено</Badge>;
      default: return null;
    }
  };

  if (statsLoading || settingsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Умный повторный контакт</h1>
          <p className="text-muted-foreground">Безопасная система реактивации клиентов</p>
        </div>
        <div className="flex items-center gap-4">
          {stats?.healthStatus && (
            <div className="flex items-center gap-2">
              {getHealthIcon(stats.healthStatus.status)}
              {getHealthBadge(stats.healthStatus.status)}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch
              id="enabled"
              checked={settings?.enabled || false}
              onCheckedChange={handleToggleEnabled}
              data-testid="switch-enabled"
            />
            <Label htmlFor="enabled">
              {settings?.enabled ? 'Включено' : 'Выключено'}
            </Label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего контактов</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalContacts || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Доступно для контакта</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.eligibleContacts || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Отправлено сегодня</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.messagesSentToday || 0} / {stats?.healthStatus.dailyLimit || 100}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Процент ответов</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.replyRate || 0}%</div>
          </CardContent>
        </Card>
      </div>

      {stats?.healthStatus && stats.healthStatus.status !== 'safe' && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              {getHealthIcon(stats.healthStatus.status)}
              <span className="font-medium">{stats.healthStatus.message}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <BarChart3 className="h-4 w-4 mr-2" />
            Обзор
          </TabsTrigger>
          <TabsTrigger value="send" data-testid="tab-send">
            <Send className="h-4 w-4 mr-2" />
            Отправка
          </TabsTrigger>
          <TabsTrigger value="contacts" data-testid="tab-contacts">
            <Users className="h-4 w-4 mr-2" />
            Контакты
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <Clock className="h-4 w-4 mr-2" />
            История
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="h-4 w-4 mr-2" />
            Настройки
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Как это работает</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Shield className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">Безопасность</h4>
                    <p className="text-sm text-muted-foreground">Сообщения только тем, кто уже писал вам</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">AI-генерация</h4>
                    <p className="text-sm text-muted-foreground">Уникальные сообщения для каждого клиента</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">Тихие часы</h4>
                    <p className="text-sm text-muted-foreground">Автоматическая пауза в ночное время</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">Адаптивные лимиты</h4>
                    <p className="text-sm text-muted-foreground">Система сама регулирует объём</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="send" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Создать кампанию</CardTitle>
                <CardDescription>Выберите триггер и количество сообщений</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Тип триггера</Label>
                  <Select value={selectedTrigger} onValueChange={setSelectedTrigger}>
                    <SelectTrigger data-testid="select-trigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TRIGGER_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Максимум сообщений</Label>
                  <Input
                    type="number"
                    value={maxMessages}
                    onChange={(e) => setMaxMessages(parseInt(e.target.value) || 10)}
                    min={1}
                    max={100}
                    data-testid="input-max-messages"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleGeneratePreview}
                    disabled={generateMessageMutation.isPending}
                    data-testid="button-preview"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Предпросмотр
                  </Button>
                  <Button
                    onClick={handleBatchSend}
                    disabled={
                      !settings?.enabled || 
                      batchSendMutation.isPending ||
                      stats?.healthStatus.status === 'stop'
                    }
                    data-testid="button-send"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Отправить
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Пример сообщения</CardTitle>
                <CardDescription>AI сгенерирует уникальное сообщение для каждого клиента</CardDescription>
              </CardHeader>
              <CardContent>
                {generateMessageMutation.isPending ? (
                  <Skeleton className="h-24 w-full" />
                ) : previewMessage ? (
                  <Textarea
                    value={previewMessage}
                    readOnly
                    className="min-h-24 resize-none"
                    data-testid="textarea-preview"
                  />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Нажмите "Предпросмотр" чтобы увидеть пример сообщения
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Контакты</CardTitle>
                <CardDescription>Клиенты, которые ранее писали вам</CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/smart-contact/contacts'] })}
                data-testid="button-refresh-contacts"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {contactsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : contacts && contacts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Телефон</TableHead>
                      <TableHead>Имя</TableHead>
                      <TableHead>Отправлено</TableHead>
                      <TableHead>Ответов</TableHead>
                      <TableHead>Рейтинг</TableHead>
                      <TableHead>Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.id} data-testid={`row-contact-${contact.id}`}>
                        <TableCell className="font-mono">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            +{contact.phone}
                          </div>
                        </TableCell>
                        <TableCell>{contact.name || '—'}</TableCell>
                        <TableCell>{contact.totalMessagesSent}</TableCell>
                        <TableCell>{contact.totalRepliesReceived}</TableCell>
                        <TableCell>
                          <Badge variant={contact.interactionScore >= 70 ? 'default' : contact.interactionScore >= 40 ? 'secondary' : 'outline'}>
                            {contact.interactionScore}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {contact.doNotDisturb ? (
                            <Badge variant="destructive">Не беспокоить</Badge>
                          ) : contact.isBlocked ? (
                            <Badge variant="destructive">Заблокирован</Badge>
                          ) : (
                            <Badge variant="outline">Активен</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Пока нет контактов. Они появятся автоматически после диалогов с клиентами.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>История сообщений</CardTitle>
                <CardDescription>Последние отправленные сообщения</CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/smart-contact/messages'] })}
                data-testid="button-refresh-messages"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {messagesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : messages && messages.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата</TableHead>
                      <TableHead>Триггер</TableHead>
                      <TableHead>Сообщение</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Ответ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((message) => (
                      <TableRow key={message.id} data-testid={`row-message-${message.id}`}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(message.createdAt).toLocaleString('ru')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {TRIGGER_LABELS[message.triggerType] || message.triggerType}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {message.messageText}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_LABELS[message.status]?.variant || 'outline'}>
                            {STATUS_LABELS[message.status]?.label || message.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {message.replyReceived ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Пока нет отправленных сообщений.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Настройки модуля</CardTitle>
              <CardDescription>Конфигурация безопасной отправки</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Тихие часы
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Начало (час)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={settings?.quietHoursStart || 22}
                        onChange={(e) => updateSettingsMutation.mutate({ quietHoursStart: parseInt(e.target.value) })}
                        data-testid="input-quiet-start"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Конец (час)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={settings?.quietHoursEnd || 9}
                        onChange={(e) => updateSettingsMutation.mutate({ quietHoursEnd: parseInt(e.target.value) })}
                        data-testid="input-quiet-end"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Лимиты
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Максимум сообщений в день</Label>
                      <Input
                        type="number"
                        min={10}
                        max={1000}
                        value={settings?.dailyMessageLimit || 100}
                        onChange={(e) => updateSettingsMutation.mutate({ dailyMessageLimit: parseInt(e.target.value) })}
                        data-testid="input-daily-limit"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Максимум повторных сообщений клиенту</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={settings?.maxFollowUpsPerClient || 3}
                        onChange={(e) => updateSettingsMutation.mutate({ maxFollowUpsPerClient: parseInt(e.target.value) })}
                        data-testid="input-max-followups"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Минимум часов между сообщениями</Label>
                      <Input
                        type="number"
                        min={1}
                        max={168}
                        value={settings?.minHoursBetweenMessages || 24}
                        onChange={(e) => updateSettingsMutation.mutate({ minHoursBetweenMessages: parseInt(e.target.value) })}
                        data-testid="input-min-hours"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t">
                <Switch
                  id="auto-stop"
                  checked={settings?.autoStopOnNegativeSignals || true}
                  onCheckedChange={(checked) => updateSettingsMutation.mutate({ autoStopOnNegativeSignals: checked })}
                  data-testid="switch-auto-stop"
                />
                <Label htmlFor="auto-stop">
                  Автоматически останавливать при негативных сигналах
                </Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
