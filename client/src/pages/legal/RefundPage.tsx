import { Link } from "wouter";
import { ArrowLeft, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function RefundPage() {
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
          <Link href="/refund-kz">
            <Button variant="outline" size="sm" data-testid="button-switch-lang-kz">
              <Globe className="w-4 h-4 mr-2" />
              KZ
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-8 prose prose-neutral dark:prose-invert max-w-none">
            <h1 className="text-3xl font-bold mb-6">Политика возвратов</h1>
            
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
              <h2 className="text-xl font-semibold mb-4">Когда возврат возможен</h2>
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <p className="font-medium mb-2">Возврат денежных средств производится в следующих случаях:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <strong>Неработоспособность сервиса</strong> — если сервис не функционирует по вине Исполнителя 
                    более 72 часов подряд и проблема не была устранена
                  </li>
                  <li>
                    <strong>Ошибочное списание</strong> — если с вашего счета была списана сумма по ошибке 
                    (двойное списание, списание после отмены подписки)
                  </li>
                  <li>
                    <strong>Неоказание услуги</strong> — если оплата произведена, но доступ к сервису не был предоставлен
                  </li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Когда возврат не производится</h2>
              <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <p className="font-medium mb-2">Возврат денежных средств не осуществляется:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <strong>Услуга использовалась</strong> — если вы активно пользовались сервисом в течение оплаченного периода
                  </li>
                  <li>
                    <strong>Диалоги израсходованы</strong> — если лимит диалогов был частично или полностью использован
                  </li>
                  <li>
                    <strong>Блокировка WhatsApp</strong> — если ваш аккаунт WhatsApp был заблокирован по вине пользователя 
                    (нарушение правил WhatsApp, спам-рассылки)
                  </li>
                  <li>
                    <strong>Изменение решения</strong> — если вы просто передумали пользоваться сервисом после оплаты
                  </li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Порядок оформления возврата</h2>
              <ol className="list-decimal pl-6 space-y-3">
                <li>
                  Направьте заявку на возврат по адресу: {" "}
                  <a href="mailto:support@botfactory.kz" className="text-primary hover:underline">support@botfactory.kz</a>
                </li>
                <li>В заявке укажите:
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Ваш email, привязанный к аккаунту</li>
                    <li>Дату и сумму платежа</li>
                    <li>Причину запроса возврата</li>
                    <li>Подтверждающие документы (если есть)</li>
                  </ul>
                </li>
                <li>Заявка будет рассмотрена в течение 5 рабочих дней</li>
                <li>В случае положительного решения возврат производится на реквизиты, с которых была произведена оплата, в течение 10 рабочих дней</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Отмена подписки</h2>
              <p>
                Вы можете отменить подписку в любое время через личный кабинет. 
                После отмены:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Автоматическое списание будет прекращено</li>
                <li>Доступ к сервису сохранится до конца текущего оплаченного периода</li>
                <li>Неиспользованные дни или диалоги не компенсируются</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Платежные системы</h2>
              <p>
                Оплата и возвраты обрабатываются через сертифицированные платежные системы:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li><strong>Kaspi Pay</strong></li>
                <li><strong>Freedom Pay</strong></li>
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                Данные банковских карт не хранятся на серверах botfactory.kz. 
                Все платежи обрабатываются в соответствии со стандартом PCI DSS.
              </p>
            </section>

            <div className="border-t pt-6 mt-8">
              <p className="text-sm text-muted-foreground">
                По вопросам возвратов обращайтесь: {" "}
                <a href="mailto:support@botfactory.kz" className="text-primary hover:underline">support@botfactory.kz</a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
