# Varna dostava povpraševanj Black Raven — aktivacija

## Zakaj je bil FormSubmit odstranjen

Varnostni dodatek v uporabnikovem brskalniku je pri prehodu na `formsubmit.co` prikazal opozorilo o domnevnem phishingu. Opozorila **ne obidemo**. Stari direktni POST in samodejna preusmeritev na FormSubmit sta v celoti odstranjena.

## Novi način

- Na strani `o-nas.html` ostane dvojezični obrazec in povezave z vseh programov.
- JavaScript odda podatke z `fetch` prek HTTPS na preverjen Formspree form-ID endpoint; obiskovalec ne zapusti strani.
- Vgrajeni so: HTML validacija, honeypot `_gotcha`, zaščita pred dvojnim klikom, časovna omejitev, obravnava napak / statusa 429 in povratna informacija uporabniku.
- Podatki se **ne pošljejo**, če form-ID ni nastavljen, endpoint ni dovoljen ali če pride do napake povezave.
- Sporočilo o uspehu pomeni samo, da je strežnik sprejel oddajo; lastnik mora posebej preizkusiti prejem e-pošte.

## Enkratna aktivacija

1. Uredi GoDaddy MX in testiraj, da `info@blackraven.solutions` sprejema navadna e-poštna sporočila.
2. Odpri **https://formspree.io/register**. Račun naj bo v lasti Black Raven Solutions. Uporabi brezplačni paket (po ceniku novembra 2026 do 50 oddaj na mesec).
3. V Formspree ustvarite formo **Black Raven – Contact**, kot *Target Email* nastavite `info@blackraven.solutions`. Če predal še ni delujoč, počakajte z aktivacijo.
4. V nastavitvah Formspree omogoči **Restrict to Domain**, vpiši pravi produkcijski domeni oziroma izvor (npr. `blackraven.solutions` ali `dday2301.github.io` odvisno, kje je stran dejansko objavljena). Omogoči spam zaščito.
5. Kopiraj endpoint v obliki `https://formspree.io/f/XXXXXXXX` (samo pravi ustvarjeni ID; brez e-poštnega naslova v URL-ju).
6. V `o-nas.html` nastavi **`data-endpoint="https://formspree.io/f/XXXXXXXX"`** na obrazcu `#contact-enquiry-form`. Ne spreminjaj direktno kode JS. Po tej spremembi je gumb lahko aktiviran.
7. Testiraj s testnimi podatki: uspeh, zavrnitev, izpad omrežja, mobilni/namizni prikaz ter dejanski prejem v poštnem predalu. Če e-pošta ne prispe, preglej Formspree Inbox in DNS.
8. Pred javno uporabo pregledaš pogoje obdelave osebnih podatkov in pravne obveznosti (GDPR, možen prenos podatkov v ZDA). Zagotovi ustrezno obvestilo o zasebnosti in hrambo. **Ne zbiraj zdravstvenih ali drugih občutljivih podatkov.**

## Če endpoint še ni vzpostavljen

`data-endpoint=""` pomeni **varno neaktiven obrazec**. Gumb je onemogočen in obiskovalec vidi pošteno pojasnilo z nadomestnim e-poštnim naslovom. Podatkov **ne pošiljamo** nikamor.

## Brez skrivnih ključev v javnem repozitoriju

Formspree form-ID je namenjen javni uporabi v statični strani, ni SMTP geslo. V javno kodo nikoli ne dodajaj Gmail / GoDaddy gesel, Resend API ključev ali drugih zasebnih poverilnic.

Viri: https://help.formspree.io/articles/building-your-form/submit-forms-with-javascript-ajax , https://help.formspree.io/articles/building-your-form/honeypot-spam-filtering , https://formspree.io/legal/privacy-policy/ .
