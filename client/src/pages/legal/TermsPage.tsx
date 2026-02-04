import { Link } from "wouter";
import { ArrowLeft, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              На главную
            </Button>
          </Link>
          <Link href="/terms-kz">
            <Button variant="outline" size="sm" data-testid="button-switch-lang-kz">
              <Globe className="w-4 h-4 mr-2" />
              KZ
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-8 prose prose-neutral dark:prose-invert max-w-none">
            <h1 className="text-3xl font-bold mb-6">Условия использования (Публичная оферта)</h1>
            
            <p className="text-muted-foreground mb-8">
              Дата вступления в силу: {new Date().toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Исполнитель</h2>
              <p>
                <strong>ИП Альтаев Г.Т.</strong><br />
                Адрес: г. Алматы, проспект Гагарина 132<br />
                Email: <a href="mailto:support@botfactory.kz" className="text-primary hover:underline">support@botfactory.kz</a>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">1. Предмет договора</h2>
              <p>
                Исполнитель предоставляет Заказчику доступ к платформе автоматизации WhatsApp Business (далее — Сервис), 
                а Заказчик оплачивает услуги в соответствии с выбранным тарифным планом.
              </p>
              <p className="mt-4">
                Регистрация на сайте botfactory.kz и/или оплата услуг является акцептом настоящей оферты.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">2. Тарифы и стоимость</h2>
              <div className="bg-muted p-4 rounded-lg">
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Абонентская плата:</strong> 7 000 тенге / месяц (базовый тариф)</li>
                  <li><strong>Стоимость диалога:</strong> 50 тенге за 1 диалог с клиентом</li>
                  <li><strong>Бонус:</strong> 50 диалогов бесплатно в первый месяц использования</li>
                  <li><strong>Пробный период:</strong> отсутствует</li>
                </ul>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Валюта расчетов: казахстанский тенге (KZT)
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">3. Подписка и автопродление</h2>
              <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="font-medium mb-2">Условия рекуррентных платежей:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Подписка оформляется на 30 дней</li>
                  <li>Автоматическое продление и списание средств каждые 30 дней</li>
                  <li>Оплата производится через Kaspi Pay и/или Freedom Pay</li>
                  <li>Отмена подписки возможна в личном кабинете в любое время</li>
                  <li>При отмене подписки доступ сохраняется до конца оплаченного периода</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">4. Права и обязанности сторон</h2>
              <h3 className="text-lg font-medium mt-4 mb-2">Исполнитель обязуется:</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Обеспечить работоспособность Сервиса</li>
                <li>Предоставить техническую поддержку</li>
                <li>Уведомлять о плановых технических работах</li>
              </ul>
              
              <h3 className="text-lg font-medium mt-4 mb-2">Заказчик обязуется:</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Своевременно оплачивать услуги</li>
                <li>Не использовать Сервис для спама и незаконной деятельности</li>
                <li>Соблюдать правила WhatsApp Business Policy</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">5. Ограничение ответственности</h2>
              <p>Исполнитель не несет ответственности за:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Блокировку аккаунта WhatsApp со стороны Meta/WhatsApp</li>
                <li>Действия пользователя, нарушающие правила WhatsApp</li>
                <li>Перебои в работе, вызванные третьими сторонами</li>
                <li>Упущенную выгоду Заказчика</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">6. Порядок расторжения</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Заказчик может отказаться от услуг в любое время через личный кабинет</li>
                <li>Исполнитель вправе приостановить доступ при нарушении условий оферты</li>
                <li>При расторжении неиспользованные средства не возвращаются, кроме случаев, предусмотренных политикой возвратов</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">7. Применимое право</h2>
              <p>
                Настоящая оферта регулируется законодательством Республики Казахстан. 
                Споры разрешаются путем переговоров, а при недостижении согласия — в судебном порядке по месту нахождения Исполнителя.
              </p>
            </section>

            <div className="border-t pt-6 mt-8">
              <p className="text-sm text-muted-foreground">
                По вопросам обращайтесь: {" "}
                <a href="mailto:support@botfactory.kz" className="text-primary hover:underline">support@botfactory.kz</a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
