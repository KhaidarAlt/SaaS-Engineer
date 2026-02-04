import { Link } from "wouter";
import { ArrowLeft, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function TermsPageKz() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Basty betke
            </Button>
          </Link>
          <Link href="/terms">
            <Button variant="outline" size="sm" data-testid="button-switch-lang-ru">
              <Globe className="w-4 h-4 mr-2" />
              RU
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-8 prose prose-neutral dark:prose-invert max-w-none">
            <h1 className="text-3xl font-bold mb-6">Paidalanu sharttary (Zhariya oferta)</h1>
            
            <p className="text-muted-foreground mb-8">
              Kushe enu kuni: {new Date().toLocaleDateString('kk-KZ', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Oryndaushy</h2>
              <p>
                <strong>ZhK Altaev G.T.</strong><br />
                Mekenzhaiy: Almaty k., Gagarin dangyyly 132<br />
                Email: <a href="mailto:support@botfactory.kz" className="text-primary hover:underline">support@botfactory.kz</a>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">1. Sharttyn mani</h2>
              <p>
                Oryndaushy Tapayrys berushige WhatsApp Business avtomattandyru platformasyna (bunnan ari — Servis) 
                kolzhetimdіlіk beredi, al Tapayrys berushi tandagan tarif zhospary boyynsha kyzmetterdі toleydi.
              </p>
              <p className="mt-4">
                botfactory.kz saitynda tirkelue zhane/nemese kyzmetterdі toleu osy ofertany kabylau bolyp tabylady.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">2. Tarifter zhane kuny</h2>
              <div className="bg-muted p-4 rounded-lg">
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Abonentіk tolem:</strong> 7 000 tenge / ay (negіzgі tarif)</li>
                  <li><strong>Dialog kuny:</strong> 1 dialog ushіn 50 tenge</li>
                  <li><strong>Bonus:</strong> Bіrіnshі ayda 50 dialog tegіn</li>
                  <li><strong>Synau kezengі:</strong> zhok</li>
                </ul>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Esep aiyrysu valuytasy: kazakstandyk tenge (KZT)
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">3. Zhazylym zhane avto-uzartu</h2>
              <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="font-medium mb-2">Rekurrenttіk tolem sharttary:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Zhazylym 30 kunga resimdeledі</li>
                  <li>Ar 30 kun saiyn avtomatty uzartu zhane akysha esepten shygaru</li>
                  <li>Tolem Kaspi Pay zhane/nemese Freedom Pay arkyly zhuzeге asyrylady</li>
                  <li>Zhazylymnan bas tartu zhekelіk kabinetіnde keз kelgen uakytda mumkіn</li>
                  <li>Bas tartkan kezde kolzhetemdіlіk tolengen kezengning sonyna deiin saktalady</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">4. Taraptar kukyktary men mіndetterі</h2>
              <h3 className="text-lg font-medium mt-4 mb-2">Oryndaushy mіndetteneді:</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Servistіng zhұmys іsteuіn kamtamasyz etu</li>
                <li>Tekhnikalyk kolday korsetui</li>
                <li>Zhosprly tekhnikalyk zhumystar turaly habarlandyru</li>
              </ul>
              
              <h3 className="text-lg font-medium mt-4 mb-2">Tapayrys berushi mіndetteneді:</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Kyzmetterdi ozіndіk uakytynda toleu</li>
                <li>Servisтi spam zhane zannsmaz қіzmetke paidalanвau</li>
                <li>WhatsApp Business Policy erezhelerіn saktau</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">5. Zhauapkershіlіktі shekteu</h2>
              <p>Oryndaushy kelesi жagdaiylar ushіn zhauap bermeydi:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Meta/WhatsApp tarapynan WhatsApp akkauntyn bugattau</li>
                <li>WhatsApp erezhelerіn buzatyn paidalanushy arektterі</li>
                <li>Ushіnshі taraptar tusіrgen zhұmys uzіlіsterі</li>
                <li>Tapayrys berushіnіng joiylgan paiyдасy</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">6. Tokتatu tartіbі</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Tapayrys berushi zhekelіk kabinetі arkyly keз kelgen uakytта kyzmetterden bas tarta alady</li>
                <li>Oryndaushy oferta sharttary buzylgan жagdaiyda kolzhetemdіlіktі toктata alady</li>
                <li>Toktatylgan kezde paidаlanylmagan karzhylar kaittarylmaidy, kaiiтaru saiasaтында korsetіlgen жagdaiylardan басka</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">7. Koldanylatyn kukyk</h2>
              <p>
                Osy oferta Kazakstan Respublikasy zannamasymen retteledі. 
                Daular keliссіm zholymеn, al kelіsіmge zhete almagan жagdaiyда — Oryndaushy ornalaskan zherі boiynsshа sot tartіbімен шеshіледі.
              </p>
            </section>

            <div className="border-t pt-6 mt-8">
              <p className="text-sm text-muted-foreground">
                Suraktar boyynshа: {" "}
                <a href="mailto:support@botfactory.kz" className="text-primary hover:underline">support@botfactory.kz</a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
