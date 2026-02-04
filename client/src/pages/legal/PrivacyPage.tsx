import { Link } from "wouter";
import { ArrowLeft, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function PrivacyPage() {
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
          <Link href="/privacy-kz">
            <Button variant="outline" size="sm" data-testid="button-switch-lang-kz">
              <Globe className="w-4 h-4 mr-2" />
              KZ
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-8 prose prose-neutral dark:prose-invert max-w-none">
            <h1 className="text-3xl font-bold mb-6">Политика конфиденциальности</h1>
            
            <p className="text-muted-foreground mb-8">
              Дата вступления в силу: {new Date().toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Оператор данных</h2>
              <p>
                <strong>ИП Альтаев Г.Т.</strong><br />
                Юридический адрес: г. Алматы, проспект Гагарина 132<br />
                Email: <a href="mailto:support@botfactory.kz" className="text-primary hover:underline">support@botfactory.kz</a>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">1. Общие положения</h2>
              <p>
                Настоящая Политика конфиденциальности регулирует порядок сбора, обработки и защиты персональных данных 
                пользователей сервиса botfactory.kz в соответствии с законодательством Республики Казахстан.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">2. Собираемые данные</h2>
              <p>Мы собираем следующие категории данных:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Имя пользователя</li>
                <li>Номер телефона</li>
                <li>Адрес электронной почты (email)</li>
                <li>Данные WhatsApp Business Account</li>
                <li>История диалогов с клиентами</li>
                <li>Технические данные (IP-адрес, тип браузера, устройство)</li>
                <li>Данные о платежах: ID транзакции, статус, сумма, выбранный тариф</li>
              </ul>
              <div className="bg-muted p-4 rounded-lg mt-4">
                <p className="font-medium">Важное указание:</p>
                <p>
                  Данные банковских карт НЕ хранятся на стороне botfactory.kz. 
                  Платежи обрабатываются через сертифицированные платежные системы Kaspi Pay и/или Freedom Pay 
                  в соответствии со стандартом PCI DSS.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">3. Цели обработки данных</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Предоставление доступа к платформе</li>
                <li>Подключение WhatsApp Business</li>
                <li>Учет диалогов и взаимодействий с клиентами</li>
                <li>Расчеты по подписке и биллинг</li>
                <li>Техническая поддержка пользователей</li>
                <li>Исполнение требований законодательства Республики Казахстан</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">4. Facebook Login</h2>
              <p>
                Сервис использует Facebook Login for Business исключительно для подключения WhatsApp Business Accounts. 
                Данные пользователей не передаются для рекламных целей. Разрешение public_profile используется 
                только для аутентификации.
              </p>
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg mt-4 text-sm">
                <p className="font-medium">For Meta App Review:</p>
                <p>
                  The service uses Facebook Login for Business solely to connect WhatsApp Business Accounts. 
                  No payment card data is processed by Meta. public_profile is used only for authentication.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">5. Срок хранения данных</h2>
              <p>
                Персональные данные хранятся в течение периода действия подписки и до 5 лет после её окончания 
                в целях бухгалтерского учета в соответствии с требованиями законодательства РК.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">6. Права пользователя</h2>
              <p>Вы имеете право:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Запросить информацию о хранимых данных</li>
                <li>Потребовать удаления персональных данных</li>
                <li>Получить выгрузку своих данных</li>
                <li>Отозвать согласие на обработку данных</li>
              </ul>
              <p className="mt-4">
                Для реализации своих прав направьте запрос на: {" "}
                <a href="mailto:support@botfactory.kz" className="text-primary hover:underline">support@botfactory.kz</a>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">7. Безопасность данных</h2>
              <p>Мы применяем следующие меры защиты:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Шифрование данных по протоколу HTTPS</li>
                <li>Защита доступа к серверам</li>
                <li>Регулярное резервное копирование</li>
                <li>Ограничение доступа сотрудников к персональным данным</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">8. Изменения в политике</h2>
              <p>
                Мы оставляем за собой право вносить изменения в настоящую Политику конфиденциальности. 
                Актуальная версия всегда доступна по адресу botfactory.kz/privacy.
              </p>
            </section>

            <div className="border-t pt-6 mt-8">
              <p className="text-sm text-muted-foreground">
                Если у вас есть вопросы, свяжитесь с нами: {" "}
                <a href="mailto:support@botfactory.kz" className="text-primary hover:underline">support@botfactory.kz</a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
