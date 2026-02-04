import { Link } from "wouter";
import { ArrowLeft, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function RefundPageKz() {
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
          <Link href="/refund">
            <Button variant="outline" size="sm" data-testid="button-switch-lang-ru">
              <Globe className="w-4 h-4 mr-2" />
              RU
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-8 prose prose-neutral dark:prose-invert max-w-none">
            <h1 className="text-3xl font-bold mb-6">Kaitaru saiasaty</h1>
            
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
              <h2 className="text-xl font-semibold mb-4">Kaitaru mumkin bolgan жagdaiylar</h2>
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <p className="font-medium mb-2">Akysha karalary kelesi жagdaiylarda kaittarylady:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <strong>Servistіn zhұmys іstemeuі</strong> — eger servis Oryndaushy kіnasіmen 72 sagattan astam 
                    zhұmys іstemese zhane masele sheshіlmese
                  </li>
                  <li>
                    <strong>Kate esepten shygaru</strong> — eger sіzdіn shotyngyzdan soma kate esepten shygарylsa 
                    (kos esepten shygaru, zhazylymnan bas tartkannan keiin esepten shygaru)
                  </li>
                  <li>
                    <strong>Kyzmet korsetіlmeuі</strong> — eger tolem zhurgіzіlse, bіrak servisкe kolzhetemdіlіk berіlmese
                  </li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Kaitaru zhurgіzіlmeitіn жagdaiylar</h2>
              <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <p className="font-medium mb-2">Akysha karalary kaittarylmaiydy:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <strong>Kyzmet paidаlanyldy</strong> — eger sіz tolengen kezengde servistі belsendі paidаlangan bolsangyz
                  </li>
                  <li>
                    <strong>Dialogtar zhumsaldy</strong> — eger dialogtar limiti ішіnara nemese tolygymen paidаlanylsa
                  </li>
                  <li>
                    <strong>WhatsApp bugattauy</strong> — eger sіzdіn WhatsApp akkauntyngyz paidalanushy kіnasіmen 
                    bugattalsa (WhatsApp erezhelерін buzu, spam-zhіberіlіmder)
                  </li>
                  <li>
                    <strong>Sheshіmnі ozgertu</strong> — eger sіz tolemnen кейін servistі paidalanudan bаs tartсangyz
                  </li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Kaitaru resіmдеу tartіbі</h2>
              <ol className="list-decimal pl-6 space-y-3">
                <li>
                  Kaitaruга otіnіsh zhіberіngіz: {" "}
                  <a href="mailto:support@botfactory.kz" className="text-primary hover:underline">support@botfactory.kz</a>
                </li>
                <li>Otіnіshte korsеtіnіz:
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Akkauntka baikаlangan email</li>
                    <li>Tolem kunі men somasy</li>
                    <li>Kaitaru suranysynyng sebеbi</li>
                    <li>Rasтaushы kuzhаtтар (bolsa)</li>
                  </ul>
                </li>
                <li>Otіnіsh 5 zhұmys kunі іshіnde karalady</li>
                <li>On sheshіm kabыldangan жagdaiyda kaitaru tolem zhurgіzіlgen rekvizittерге 10 zhұmys kunі іshіnde zhurgіzіledі</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Zhazylymnan bas tartu</h2>
              <p>
                Sіz zhazylymnan kez kelgen уакытta zhekelіk kabinetі arkyly bas tarta alasyz. 
                Bas tartkannan keiin:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Avtomatty esepten shygaru токтатылады</li>
                <li>Servisкe kolzhetemdіlіk agymdag tolengen кezengning sonyna deiin saktalady</li>
                <li>Paidаlanylmagan künder nemese dialogtar otelmeydi</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Tolem zhüieleri</h2>
              <p>
                Tolem zhane kaitarular sertifikаttalgan tolem zhüieleri arkyly ondeledі:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li><strong>Kaspi Pay</strong></li>
                <li><strong>Freedom Pay</strong></li>
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                Bank kartalarынyn деректерi botfactory.kz serverlerіnde saktalmaiydy. 
                Barlyк tolemder PCI DSS standartyna saiykes ondeledі.
              </p>
            </section>

            <div className="border-t pt-6 mt-8">
              <p className="text-sm text-muted-foreground">
                Kaitaru saualdary boyynsha: {" "}
                <a href="mailto:support@botfactory.kz" className="text-primary hover:underline">support@botfactory.kz</a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
