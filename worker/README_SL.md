# Black Raven: neposredno pošiljanje prek Cloudflare Workers in GoDaddy Titan

**Namen:** Obiskovalec izpolni obrazec na `https://blackraven.solutions/o-nas.html`. Cloudflare Worker varno pošlje sporočilo prek `smtpout.secureserver.net:465` na `info@blackraven.solutions`. Brez Gmail/Outlook okna, Resend ali posrednikov za pošiljanje.

## Trenutno stanje (pomembno)
- V Cloudflare mora biti ustvarjen Worker z imenom **`blackraven-contact`**. Če se še vedno imenuje `blackraven-contactkopiraj`, je treba ime popraviti oziroma uskladiti z `worker/wrangler.jsonc` pred namestitvijo.
- Uporabnik je v Cloudflare Production že nastavil `SMTP_USER=info@blackraven.solutions` in zaščiten `SMTP_PASS`. **Ne prenašaj ju v GitHub**.
- `keep_vars: true` v Wrangler ohranja obstoječo `SMTP_USER` iz Cloudflare Dashboarda. `SMTP_PASS` je zahtevana skrivnost.
- Ohranimo obstoječe MX/SPF/DKIM/DMARC in GitHub Pages A/CNAME. Za prvo namestitev uporabimo `workers.dev`, zato GoDaddy DNS ni treba spreminjati.
- Dokler ni nameščen in preverjen Worker, obrazec ostane pravilno onemogočen.

## Poveži že ustvarjen Worker z repozitorijem

1. Cloudflare → **Compute → Workers & Pages** → izberi Worker **blackraven-contact** (NE blog-lab).
2. Preveri, da se točno tako glasi njegovo ime v Cloudflare. Wrangler `name` je `blackraven-contact`; neusklajena imena blokirajo build.
3. **Settings → Builds → Connect → GitHub**.
4. Izberi repozitorij **`DDAY2301/Black-Raven`**.
5. Nastavi:
   - **Branch**: `main`
   - **Root directory**: `worker` (brez pomišljaja, brez `src`)
   - **Build command**: `npm test` (če sistem sam namesti odvisnosti)
   - **Deploy command**: `npx wrangler deploy`
6. Shrani. Preveri, da prvi build in deploy uspešno zaključita. Cloudflare lahko zahteva potrditve dovoljenj za GitHub.
7. Cloudflare → Worker → **Settings → Variables and Secrets**: preveri, da sta `SMTP_USER` in `SMTP_PASS` še vedno v **Production**. Vsebino skrivnosti ne razkrivaj.

Če Cloudflare sam ponudi drugačen Worker name, ga **ne deployaj brez uskladitve**. Povezanega `blog-lab` Workerja ne spreminjaj.

## Dejanski preizkus povezave

1. Na Cloudflare strani Workerja poišči **workers.dev URL** (npr. `https://blackraven-contact.<pod-domena>.workers.dev`).
2. `GET /health` mora vrniti `{"status":"up"}`; to **ne potrjuje** SMTP.
3. Zahtevek `GET /ready` z glavo `Origin: https://blackraven.solutions` mora vrniti HTTP 200 z `{"ready":true}`. Ta zahteva vzpostavi šifrirano TLS povezavo in preveri SMTP prijavo; **ne pošlje sporočila**. Zahteve brez ustreznega `Origin` vrnejo 403.
4. Ko `/ready` deluje, spremeni `data-endpoint` obrazca na **dejanski, natančno preverjeni** workers.dev URL + `/contact`, npr. `https://blackraven-contact.<pod-domena>.workers.dev/contact`. Brskalniška koda na strani že podpira tak naslov.
5. Objavi posodobljeno statično stran in pošlji **eno testno sporočilo**. Rezultat 202 pomeni, da je SMTP strežnik sprejel sporočilo, ne pa tudi, da je bilo dostavljeno. Preveri dejanski Inbox/Spam in pravilni Reply-To v `info@blackraven.solutions`.

## Varnost
- `SMTP_PASS` samo Cloudflare Secret, ne GitHub Secrets ali frontend.
- Ohranjen prejemnik: `info@blackraven.solutions` (ni splošnega relay sistema).
- HTTPS in dovoljen izvor: `https://blackraven.solutions`, `https://www.blackraven.solutions` in GitHub Pages origin, kot v konfiguraciji.
- Vgrajena omejitev prometa `CONTACT_PER_IP` (3/min/Cloudflare lokacija) in `CONTACT_GLOBAL` (12/min/Cloudflare lokacija). Ti limiti niso popolna zaščita pred porazdeljenim spamom; za javno uporabo priporočamo še Turnstile.
- Zapis v inbox še ni dokazan, dokler se ne opravi dejanski end-to-end preizkus.
- Cloudflare in GoDaddy lahko omejita SMTP pošiljanje zaradi politike proti zlorabam. Če `/ready` vrača 503, preveri Cloudflare Logs, ne le DNS.

## Koda
- `worker/src/index.js`: HTTPS API `/health`, `/ready`, `/contact`.
- `worker/src/smtp.js`: šifrirana SMTP povezava z AUTH PLAIN/LOGIN in MIME.
- `worker/wrangler.jsonc`: ime, domena workers.dev, rate limits, dovoljeni izvori, ohranjanje skrivnosti.
- `worker/test/smtp.test.mjs`: simulirani SMTP testi.
- `.github/workflows/cloudflare-worker-check.yml`: avtomatski preverjeni build brez pošiljanja prave pošte.
