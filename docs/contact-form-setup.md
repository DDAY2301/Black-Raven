# Kontaktni obrazec — navodila za aktivacijo

## Kaj je pripravljeno

Stran `o-nas.html` vsebuje kontaktni obrazec (SL/EN), ki pošlje sporočilo prek https://formsubmit.co/ na `info@blackraven.solutions`. Primarni gumbi »Povprašaj« vodijo na obrazec, neposredna možnost za odpiranje e-poštnega programa pa ostaja kot jasno označena alternativa na kontaktni strani. Obrazec ne uporablja SMTP gesel ali zasebnih ključev v brskalniku.

- Polja: ime, e-pošta, program (neobvezno), sporočilo.
- Obvezna polja in osnovna validacija so izvedeni v HTML.
- Zaščita: FormSubmit privzeta reCAPTCHA + skrito polje `_honey` (honeypot).
- Po uspešnem oddajanju FormSubmit vrne obiskovalca na `o-nas.html?enquiry=sent#kontakt`.
- Zunanja storitev obdeluje osebne podatke; pred objavo je treba preveriti GDPR, pravno podlago in informacije o zasebnosti.

## Koraki pred objavo

1. Preverite, da poslovni e-poštni predal `info@blackraven.solutions` sprejema pošto (DNS MX; preverite tudi SPF/DKIM/DMARC).
2. Preglejte PR in ga združite v `main` šele, ko se odločite za objavo. Workflow za GitHub Pages objavlja samo `main`.
3. Na objavljeni strani izpolnite obrazec s testnim sporočilom. **Prva oddaja sproži aktivacijski e-mail na prejemni naslov**.
4. Lastnik predala potrdi povezavo v aktivacijskem sporočilu (po potrebi preveri Spam).
5. Ponovno pošljite testno sporočilo; preverite dejanski prejem v predalu, odgovor z »Reply«, reCAPTCHA, SL/EN jezik ter mobilni in namizni prikaz.
6. Če se spremeni produkcijska domena, v `o-nas.html` posodobite vrednosti skritih polj `_next` in `_url`.

## Pomembno

Ne izvajajte testov na resničnih osebnih podatkih. Brez aktivacije FormSubmit in uspešnega preizkusa prejema ne označite e-poštnega toka kot delujočega. Storitve ne povezujte s production predalom za obdelavo zasebnih podatkov, dokler se ne preverijo pogodbeni pogoji in morebitni prenosi podatkov zunaj EGP.

Koda: `o-nas.html`, `assets/css/contact-form.css`, `assets/js/contact-form.js`.
Vir: https://formsubmit.co/documentation

## Gumbe »Povprašaj« in kontekst

Vsi gumbi za povpraševanja na podstraneh vodijo na `o-nas.html#contact-enquiry-form` namesto do Outlook pojavnega okna. Kadar je bila prej nastavljena zadeva e-pošte, se ta pošlje v URL kot `topic` in v obrazcu prikaže ter shrani v skrito polje. Običajni naslov `info@blackraven.solutions` je izpisan, posebna povezava `Odpri e-poštni program` pa ohrani možnost `mailto:`.
