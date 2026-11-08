# Black Raven — neposredno pošiljanje iz obrazca prek Cloudflare + GoDaddy

**Stanje:** implementacija pripravljena v GitHubu, vendar Worker še ni nameščen v Cloudflare in SMTP dostava ni preverjena. Nikoli ne prikazuj uspeha brez odgovora SMTP.

## Kaj dejansko počne
- Obiskovalec vnese ime, e-pošto, izbrani program in sporočilo na `blackraven.solutions/o-nas.html`.
- JavaScript preveri `GET /ready`; če je SMTP uporabniški račun pripravljen, omogoči gumb Pošlji.
- `POST /contact` na Cloudflare Workerju strogo preveri podatke, CORS, honeypot in dve omejitvi zahtev.
- Worker odpre šifrirano izhodno TLS/TCP povezavo do `smtpout.secureserver.net:465`, se prijavi kot `info@blackraven.solutions` in pošlje sporočilo *na isto e-pošto* z obiskovalcem v `Reply-To`.
- Nikoli ne bere/piše SMTP gesel v frontendu ali GitHub repozitoriju. Ne uporablja Resend, FormSubmit, Formspree ali mailto.
- HTTP `202 {"accepted":true}` pomeni, da je SMTP sprejel podatke; dejanski prihod v Inbox se preveri ločeno.

## 1. Cloudflare račun
Odpri https://dash.cloudflare.com/ in preveri Workers & Pages. Ustvari brezplačen Workers račun in izberi lastno poddomeno `workers.dev`. Za test **ni treba** premikati GoDaddy DNS, MX, SPF, DKIM ali nameserverjev.

## 2. GitHub povezava za varen ročni deploy
V Cloudflare Dashboard pojdi v **My Profile → API Tokens → Create Token**. Uporabi predlogo `Edit Cloudflare Workers` oziroma najmanjši potrebni obseg za konkretni račun, ime API ključa naj bo `Black Raven GitHub deploy`.

V GitHub repozitoriju `DDAY2301/Black-Raven` odpri **Settings → Secrets and variables → Actions → New repository secret**. Dodaj:
- `CLOUDFLARE_API_TOKEN` = skrivni Cloudflare API token (NE pošiljaj v klepet).
- `CLOUDFLARE_ACCOUNT_ID` = Cloudflare Account ID iz nadzorne plošče (ni SMTP geslo).

Nato odpri GitHub **Actions → Deploy Black Raven contact Worker (manual) → Run workflow**. Po uspehu je Worker objavljen na `https://blackraven-contact.<tvoja-cloudflare-poddomena>.workers.dev`. Ne ugibaj poddomene: prepiši **dejanski URL** iz Cloudflare ali iz dnevnika GitHub Actions.

Če akcija javlja `missing secrets`, jih dodaj po zgornjem postopku. V GitHubu ne ustvarjaj `SMTP_PASS` kot običajne repozitorijske spremenljivke.

## 3. Zasebni Worker Secrets
V Cloudflare **Workers & Pages → blackraven-contact → Settings → Variables and Secrets → Add** nastavi kot **Secret**, ne kot plain-text variable:
- `SMTP_USER` = `info@blackraven.solutions`
- `SMTP_PASS` = dejansko geslo / aplikacijsko geslo GoDaddy poslovnega e-poštnega računa, če ga GoDaddy zahteva.

Nobenega gesla ne dodajaj v javno kodo in ga ne lepi v klepet.

## 4. Preveri API, preden spremeniš stran
Preverjanje `https://<dejanski-worker>.workers.dev/health` mora vrniti `{"status":"up"}`. To še ni preizkus SMTP.

`GET /ready` zahteva glavo `Origin: https://blackraven.solutions`. Če uporabnik odpre `/ready` neposredno v novem zavihku (brez te glave), lahko vidi 403 — to **ni** dokaz, da Worker ne deluje.

V brskalniku na pravi strani bo AJAX uporabil dovoljeno glavo Origin. Pripravljen SMTP vrne 200 + `{"ready":true}`; nepripravljen 503.

Če Worker poroča `ready:false`, v Cloudflare **Logs** preveri povezljivost do GoDaddy, možnost SMTP AUTH in pravilnost podatkov. Ne prikazuj ali zapisuj skrivnosti v dnevnike.

## 5. Poveži dejanski URL s spletno stranjo
Dokler `api.blackraven.solutions` ni aktivno usmerjen na Worker, spletni obrazec ne bo deloval na starem URL-ju.

Za **brezplačen prvi zagon** v GitHub datoteki `o-nas.html` nastavi izključno preverjeni URL:

```html
<form id="contact-enquiry-form" class="contact-form"
  method="POST"
  data-endpoint="https://blackraven-contact.TVOJA-PODDOMENA.workers.dev/contact">
```

Zamenjaj `TVOJA-PODDOMENA` z **dejansko** poddomeno, ki jo dodeli Cloudflare. JavaScript sprejme `blackraven-contact.<poddom>.workers.dev` in samodejno preveri `/ready`.

Če želiš sčasoma naslov `api.blackraven.solutions`, zahteva Cloudflare **aktivno cono (zone)** za domeno in ustrezno usmeritev Workers Custom Domain; ni dovolj samo dodati naključni CNAME pri GoDaddy. To izvedi šele po potrditvi delujočega testnega Workera in previdnem načrtovanju DNS. Glej https://developers.cloudflare.com/workers/configuration/routing/custom-domains/.

## 6. Končni test
Na `https://blackraven.solutions/o-nas.html` pošlji neobčutljiv test: ime, lasten e-poštni naslov, opis sporočila. Preveri:
1. Obrazec omogoči gumb samo ob `ready:true`.
2. Prikaže uspeh samo ob odgovoru HTTP 202 + `accepted:true`.
3. Sporočilo **dejansko prispe** na `info@blackraven.solutions`, tudi v Spam.
4. Ob Reply uporabi obiskovalčev e-poštni naslov.
5. Po preizkusu preveri spam zaščito, Cloudflare WAF in omejitve zahtev.

## Omejitve
Cloudflare Workers podpira izhodne TCP povezave, toda uspešnost TLS in SMTP prijave na GoDaddy je treba preveriti v dejanskem računu. Worker je namerno zaščiten pred sporočili iz nepodprtih domen, velikimi zahtevami in osnovnim spamom. Rate limiting je približen po Cloudflare lokaciji, ni globalno stroga omejitev. Za strožje pogoje lahko pozneje dodamo Turnstile (Cloudflare, brezplačno) in Durable Objects.

### Stanje po spremembi kode
Dokler GitHub Action ni uspešno nameščen na **tvoj** Cloudflare račun, dokler v Cloudflare ne vneseš Secrets in dokler se ne posodobi `data-endpoint` z resničnim URL, kontaktni obrazec **ne bo pošiljal**. Ne sporočaj, da deluje, preden dejansko prispe testno sporočilo.
