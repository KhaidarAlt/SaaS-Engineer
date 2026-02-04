import { Link } from "wouter";
import { ArrowLeft, Mail, Phone, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContactsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              На главную / Basty betke
            </Button>
          </Link>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Контакты / Baylanys</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Русский</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Адрес</p>
                        <p className="text-muted-foreground">г. Алматы, проспект Гагарина 132</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Mail className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Email</p>
                        <a href="mailto:support@botfactory.kz" className="text-primary hover:underline">
                          support@botfactory.kz
                        </a>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Phone className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Телефон</p>
                        <a href="tel:+77711063874" className="text-primary hover:underline">
                          +7 771 106 38 74
                        </a>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Время работы</p>
                        <p className="text-muted-foreground">Пн-Пт: 09:00 - 18:00 (Алматы)</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Kazaksha</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Mekenzhai</p>
                        <p className="text-muted-foreground">Almaty k., Gagarin dangyyly 132</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Mail className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Email</p>
                        <a href="mailto:support@botfactory.kz" className="text-primary hover:underline">
                          support@botfactory.kz
                        </a>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Phone className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Telefon</p>
                        <a href="tel:+77711063874" className="text-primary hover:underline">
                          +7 771 106 38 74
                        </a>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Zhumys уакyty</p>
                        <p className="text-muted-foreground">Ds-Zh: 09:00 - 18:00 (Almaty)</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Юридическая информация / Zandy akparat</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h4 className="font-medium mb-2">Русский</h4>
                  <p className="text-muted-foreground">
                    <strong>ИП Альтаев Г.Т.</strong><br />
                    Юридический адрес: г. Алматы, проспект Гагарина 132<br />
                    Республика Казахстан
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Kazaksha</h4>
                  <p className="text-muted-foreground">
                    <strong>ZhK Altaev G.T.</strong><br />
                    Zandy mekenzhai: Almaty k., Gagarin dangyyly 132<br />
                    Kazakstan Respublikasy
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Документы / Kuzhatter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                <Link href="/privacy">
                  <Button variant="outline" className="w-full justify-start" data-testid="link-privacy-ru">
                    Политика конфиденциальности (RU)
                  </Button>
                </Link>
                <Link href="/privacy-kz">
                  <Button variant="outline" className="w-full justify-start" data-testid="link-privacy-kz">
                    Kupiyalylyk saiyasaty (KZ)
                  </Button>
                </Link>
                <Link href="/terms">
                  <Button variant="outline" className="w-full justify-start" data-testid="link-terms-ru">
                    Условия использования (RU)
                  </Button>
                </Link>
                <Link href="/terms-kz">
                  <Button variant="outline" className="w-full justify-start" data-testid="link-terms-kz">
                    Paidalanu sharttary (KZ)
                  </Button>
                </Link>
                <Link href="/refund">
                  <Button variant="outline" className="w-full justify-start" data-testid="link-refund-ru">
                    Политика возвратов (RU)
                  </Button>
                </Link>
                <Link href="/refund-kz">
                  <Button variant="outline" className="w-full justify-start" data-testid="link-refund-kz">
                    Kaitaru saiyasaty (KZ)
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
