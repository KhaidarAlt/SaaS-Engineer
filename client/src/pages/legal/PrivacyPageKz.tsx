import { Link } from "wouter";
import { ArrowLeft, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function PrivacyPageKz() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Басты бетке
            </Button>
          </Link>
          <Link href="/privacy">
            <Button variant="outline" size="sm" data-testid="button-switch-lang-ru">
              <Globe className="w-4 h-4 mr-2" />
              RU
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-8 prose prose-neutral dark:prose-invert max-w-none">
            <h1 className="text-3xl font-bold mb-6">Kupiyalylyk Saiyasaty</h1>
            
            <p className="text-muted-foreground mb-8">
              Kushe enu kunі: {new Date().toLocaleDateString('kk-KZ', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Derekter operatory</h2>
              <p>
                <strong>ZhK Altaev G.T.</strong><br />
                Zandy mekenzhaiy: Almaty k., Gagarin dangyyly 132<br />
                Email: <a href="mailto:support@botfactory.kz" className="text-primary hover:underline">support@botfactory.kz</a>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">1. Zhalpy erezheler</h2>
              <p>
                Bul saiyasat botfactory.kz servisіn paidalanushylardyn derekterіn zhinau zhane ondeu tartіbіn retteidі 
                Kazakstan Respublikasy zannnamasyna saiykes.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">2. Zhinalatyn derekter</h2>
              <p>Bіz kelesi kategoriyalardagy derekterdi zhinaimyz:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Paidalanushynyn aty</li>
                <li>Telefon nomіrі</li>
                <li>Email mekenzhaiy</li>
                <li>WhatsApp Business Account derekterі</li>
                <li>Klienttermen dialogtar tarihy</li>
                <li>Tekhnikalyk derekter (IP-mekenzhay, brauzer turі, kurylyy)</li>
                <li>Tolem derekterі: tranzaktsiya ID, martebe, soma, tarif</li>
              </ul>
              <div className="bg-muted p-4 rounded-lg mt-4">
                <p className="font-medium">Manyzdy:</p>
                <p>
                  Bank kartalarynyn derekterі botfactory.kz tarapynda saktalmaiydy. 
                  Tolemder Kaspi Pay zhane/nemese Freedom Pay arkyly PCI DSS standartyna saiykes ondeleді.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">3. Ondeu maksattary</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Platformaga kolzhetіmdіlіk beru</li>
                <li>WhatsApp Business kosu</li>
                <li>Dialogtardy esepke alu</li>
                <li>Zhazylym tolemderi zhane billing</li>
                <li>Tekhnikalyk kolday</li>
                <li>KR zannamasyn oryndau</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">4. Facebook Login</h2>
              <p>
                Servis Facebook Login for Business tek WhatsApp Business Accounts kosu ushіn koldanylaidy. 
                Paidalanushy derekterі zharnama maksatynda berіlmeidі. public_profile tek autentifikatsiya ushіn koldanylaidy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">5. Saktau merzіmі</h2>
              <p>
                Zheke derekter zhazylym merzіmі boiyy zhane onyng ayaktaluynnan keiin 5 zhylga deiin saktalady 
                KR zannnamasynyng bukhgalterlіk esep talaptaryna saiykes.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">6. Paidalanushy kukyktary</h2>
              <p>Sіzdіng kukyktaryngyz:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Saktalgan derekter turaly akparat surau</li>
                <li>Zheke derekterdi zhoyudy talap etu</li>
                <li>Oz derekterіngіzdіng koshіrmesіn alu</li>
                <li>Derekterdi ondeuге kelіsіmdі kaiytyryp alu</li>
              </ul>
              <p className="mt-4">
                Oz kukyktaryngyzdy zhuzege asyru ushіn suranys zhіberіngіz: {" "}
                <a href="mailto:support@botfactory.kz" className="text-primary hover:underline">support@botfactory.kz</a>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">7. Derekter kauіpsіzdіgі</h2>
              <p>Bіz kelesi korgau sharalary koldanamyz:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>HTTPS protokoly boyynsha derekterdi shifrylau</li>
                <li>Serverlерге kolu korgau</li>
                <li>Turakty rezervtіk koshіru</li>
                <li>Kyzmetkerlerdіng zheke derekterge kolun shekteu</li>
              </ul>
            </section>

            <div className="border-t pt-6 mt-8">
              <p className="text-sm text-muted-foreground">
                Suraktar bolsa, bіzben bailanysyngyz: {" "}
                <a href="mailto:support@botfactory.kz" className="text-primary hover:underline">support@botfactory.kz</a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
