# With love by Nasra

Mobielvriendelijke website voor persoonlijke kaarten, cadeautjes, giftboxen en cadeauverpakkingen. Matgoud, champagne en crème; teksten in de ik-vorm.

## Project

- `public/`: pagina, formulier, catalogus en geoptimaliseerde productbeelden.
- `worker/index.js`: Cloudflare Worker, aanvraagvalidatie en opslag in D1.
- `drizzle/`: schema-migratie voor aanvragen.
- `tests/`: controles voor productcombinaties, klantgegevens, opslag, foutafhandeling en toegang.
- `scripts/build.mjs`: bundelt de website en afbeeldingen tot één Worker.

Geen externe JavaScript-afhankelijkheden nodig. Node.js met `node:sqlite` is nodig voor de tests.

```sh
npm run build
npm test
```

## Aanvragen

De klant kiest een categorie, vult wensen en naam/e-mail/telefoonnummer in, en verstuurt een vrijblijvende aanvraag. De bedankpagina verschijnt pas nadat de aanvraag is opgeslagen. Er is geen automatische betaling of e-mailmelding.

`/beheer` toont de aanvragen aan de ingelogde eigenaar. Configureer `ADMIN_EMAIL` als runtime secret voor dit account. De Worker vertrouwt voor identiteit uitsluitend op de door Sites gecontroleerde `oai-authenticated-user-email`-header. Host dit niet rechtstreeks op een onbeveiligde Worker-route zonder een gelijkwaardige authenticatielaag.

De D1-binding heet `DB`. Sites past de SQL-migratie toe bij publicatie. Behoud bestaande migratiebestanden; voeg latere schemawijzigingen toe als nieuwe migraties. Klantgegevens horen uitsluitend in de database, niet in Git.

Productbeelden zijn gegenereerde sfeerimpressies. Prijs, samenstelling en levering worden persoonlijk afgestemd.
