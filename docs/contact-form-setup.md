# Black Raven — neposredno pošiljanje prek GoDaddy SMTP

Obiskovalec izpolni obrazec na GitHub Pages. Ob kliku Pošlji pošlje JavaScript HTTPS zahtevo do lastnikovega strežnika; strežnik prek poslovnega SMTP posreduje navadno e-pošto na info@blackraven.solutions. Ni FormSubmit, Formspree ali odpiranja e-poštnega programa.

## Stanje

Obrazec že vsebuje URL `https://api.blackraven.solutions/contact`. Ob odprtju strani preveri `https://api.blackraven.solutions/ready`; šele ko lasten strežnik uspešno potrdi SMTP povezavo, se gumb **samodejno omogoči**. Dokler ni dejanskega strežnika in SMTP poverilnic, obiskovalec vidi pošteno opozorilo in ne more oddati navidezno uspešnega sporočila. GitHub Pages sam ne izvaja Node/PHP backend kode.

## Strežniška konfiguracija

- Spletna stran: GitHub Pages (dday2301.github.io/Black-Raven/ ali blackraven.solutions).
- Predviden lastni HTTPS API: https://api.blackraven.solutions/contact.
- Backend: backend/server.js, Node.js 20+, Nodemailer.
- GoDaddy Professional Email powered by Titan: smtpout.secureserver.net, vrata 465, SSL/TLS, prijava z e-poštnim naslovom in geslom. Predhodno preveri dejanski tip računa.
- Prejemnik: fiksno info@blackraven.solutions; obiskovalčev naslov je Reply-To.

## Aktivacija po korakih

1. Zagotovi spletno gostovanje, ki lahko neprekinjeno izvaja Node.js (npr. obstoječi VPS). Nakup domene in e-poštnega predala še ne pomeni, da imaš strežnik za Node. GoDaddy shared hosting lahko potrebuje drugačno implementacijo.
2. Preveri, da info@blackraven.solutions DEJANSKO sprejema testno pošto; najprej uredi MX/DKIM/SPF.
3. Na lastni strežnik namesti mapo backend in tam izvedi npm install --omit=dev.
4. V zasebne okoljske spremenljivke vnesi SMTP_USER, SMTP_PASS, SMTP_HOST, SMTP_PORT, SITE_ORIGINS. Primer je v backend/.env.example. Gesel nikoli ne vnesi v javno kodo, GitHub ali pogovor.
5. Zaženi node server.js kot storitev pod neprivilegiranim sistemskim uporabnikom. Aplikacija privzeto posluša samo na 127.0.0.1:3000.
6. V GoDaddy DNS dodaj A zapis za subdomeno api na IP strežnika. Obstoječih A zapisov za spletno stran ne spreminjaj.
7. Na strežniku nastavi HTTPS reverse proxy (Caddy/Nginx) do 127.0.0.1:3000. Predloga: backend/Caddyfile.example. Za omejitve po IP mora proxy povoziti glavo X-Real-IP.
8. Preveri HTTPS `GET https://api.blackraven.solutions/health` (ustrezen odgovor je `{"status":"up"}`). To **ne** pomeni, da SMTP deluje.
9. Preveri `GET https://api.blackraven.solutions/ready` z dovoljeno glavo `Origin: https://blackraven.solutions`. Pri uspešno preverjenem SMTP mora vrniti HTTP 200 in `{"ready":true}`; sicer HTTP 503 in `{"ready":false}`. Obrazec na strani to preveri sam in **ne potrebuje nove objave HTML**.
10. Testiraj oddajo iz spletnega obrazca z nenevarnimi podatki in dejansko preveri prejem v predalu, tudi Reply-To, mobilni prikaz, napake in omejitve. SMTP sprejem še ni dokaz dostave v Inbox.

## Varnost in omejitve

Poštno geslo je samo na lastnikovem strežniku. HTTPS ščiti prenos do API, SMTP/TLS prenos do poštnega strežnika. Backend uporablja fiksnega pošiljatelja in prejemnika, validacijo, honeypot, omejitev velikosti, CORS in omejevanje zahtev. CORS ni zaščita pred boti: za produkcijo je potrebno tudi omejevanje na ravni reverse proxyja. Uspešen HTTP 202 pomeni, da je SMTP zahtevo sprejel; končno dostavo mora lastnik potrditi v Inboxu. Pred javnim zagonom je potrebna še GDPR in pravna presoja obdelave osebnih podatkov.

Povezavi: https://www.godaddy.com/help/set-up-third-party-plugins-or-websites-using-smtp-settings-42788 ; https://docs.github.com/pages/getting-started-with-github-pages/creating-a-github-pages-site
