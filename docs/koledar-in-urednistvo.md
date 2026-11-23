# Black Raven — koledar, uredništvo in prvi trije meseci bloga

## Kaj je pripravljeno v razvojni veji

- Na naslovnici je dodan dvojezičen, dostopen mesečni koledar. Prvi gumb na naslovnici in prvi program »Vikend tečaji« vodita na `#koledar`. Opisi obstoječih tečajev ostanejo.
- Koledar pridobi samo `published` dogodke iz obstoječega Cloudflare Workerja na `GET /events`. Če Worker ni nadgrajen, se varno uporabi lokalni `data/events.json` (prazen seznam), ne izmišljeni termini.
- Worker dobi `GET /events`, `GET /posts` in zaščiten `/admin`, `/admin/events`, `/admin/posts`. Stari SMTP kontaktni endpointi ostanejo nedotaknjeni.
- Uredništvo podpira osnutke, objavo, urejanje in brisanje dogodkov/člankov. Objavljen dogodek potrebuje HTTPS vir ali izrecno organizatorjevo potrditev.
- Vsebinsko shranjevanje uporablja Cloudflare KV (`CONTENT_KV`); prijava uporablja Cloudflare Access (enkratna koda/IdP), ne gesla v HTML ali repozitoriju.

## Potrebna nastavitev pred delujočo prijavo

To je razvojna izvedba; **prijava in trajno shranjevanje nista operativna, dokler niso opravljeni spodnji koraki**. Ne spreminjaj kontaktnih SMTP nastavitev ali obstoječih DNS zapisov brez ločene odobritve.

1. Ustvari Cloudflare KV namespace, npr. `blackraven-content`, in ga poveži z obstoječim Workerjem `blackraven-contact` pod imenom bindinga **`CONTENT_KV`**. V `worker/wrangler.jsonc` nato dodaj dejansko dodeljeni KV namespace ID; ne uporabljaj izmišljenih ID-jev.
2. V Cloudflare Zero Trust Access ustvari **Self-hosted application**, ki ščiti **samo pot** `/admin*` na obstoječem naslovu `blackraven-contact.dan-grmusa.workers.dev` (podprto je tudi path-based Access za `workers.dev`). Dovoli samo potrjene uredniške e-naslove. **Ne zaščiti celotnega Workerja**, ker bi blokiral javne poti `/contact`, `/ready`, `/events` in `/posts`. Ločen uredniški hostname je dodatna možnost.
3. Nastavi produkcijske spremenljivke Workerja:
   - `ACCESS_TEAM_DOMAIN`: npr. `vas-team.cloudflareaccess.com` (brez `https://`)
   - `ACCESS_AUD`: dejanski Audience Tag ustrezne Access aplikacije
   - `ACCESS_ALLOWED_EMAILS`: ločen z vejico, preverjeni uredniški e-naslovi
   Te vrednosti niso potrebne v javnih datotekah. Za spremembe zahtevaj odobritev naročnika. Niti eno geslo ne sodi v GitHub.
4. Poskrbi, da podpisani Access JWT prispe v Worker kot `Cf-Access-Jwt-Assertion`. Worker sam validira RS256 podpis proti uradnim Access javnim ključem, `iss`, `aud`, `exp` in seznam dovoljenih e-naslovov; brez tega prijavo zavrne.
5. Testiraj `GET /events`, `GET /posts`, prijavo `GET /admin` na `https://blackraven-contact.dan-grmusa.workers.dev/admin`, shranjevanje in osnutke. Preveri CORS in izvajanje na `https://blackraven.solutions`.
6. Šele po testiranju in odobritvi združi PR ter objavi Worker in statično stran. Preveri, da `/contact` ter `/ready` še vedno delujeta.

### Varnostne omejitve

- Cloudflare Access se uporablja kot prijava; **ne** izdeluj lokalnega / JS gesla.
- Brez `CONTENT_KV` ali manjkajočih parametrov Access admin vrne HTTP 503.
- Nepodpisani in nepooblaščeni JWT vrne 401; branje objavljene vsebine ostane javno.
- Pisanje zahteva iste-origin, JSON in preverjen JWT.
- Obstoječi dokumenti ali stari Facebook dogodki **niso** potrjeni prihodnji termini. Na dan 23. 11. 2026 ni bilo mogoče neodvisno potrditi prihodnjega termina iz Facebooka, zato je seznam namenoma prazen.

## Kaj stranka potrebuje za blog v prvih treh mesecih

Predlog realnega in vzdržnega začetnega ritma: **2 kakovostna članka na mesec (6 skupaj)** in **1 krajša terenska novica ali galerija na mesec (3 skupaj)**. Skupaj 9 osnovnih objav; ne ponavljaj generične umetne vsebine.

Potrebni materiali: 6 izbranih tem (npr. osnovna oprema, varnost pri ognju, priprava na dež, družinski tabor, priprava vode, kaj pričakovati na prvem tečaju); 9–18 avtentičnih in dovoljeno objavljivih fotografij, kratek opis programov, lastne terenske izkušnje, povezave na vire, navedba avtorja in dovoljenja za fotografije udeležencev. Vsaka novica potrebuje datum, naslov, 150–300 besed ali opis fotografij. Posamezen poglobljen članek približno 600–900 besed, strokovno pregledan pred objavo.

Dodatni podatki, ki jih mora potrditi Miha: dostopni uredniški e-naslov, izvorne povezave na konkretne Facebook dogodke, dejansko potrjeni datumi in lokacije, fotografije z dovoljenji, način prijavljanja in želena objavna frekvenca.

## Testi pred PR merge

```sh
node --check assets/js/calendar.js
node --check worker/src/index.js
node --check worker/src/content.js
node --check worker/src/editor.js
node --test worker/test/*.test.mjs
# iz mape worker:
npx wrangler deploy --dry-run
```
