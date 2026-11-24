# Gym Tracker

Persoonlijke website om gymtrainingen, schema en vooruitgang bij te houden.

- Online: https://714876-tim.github.io/gym-log/ (GitHub Pages, repo `714876-Tim/gym-log`, branch `main`, map `/`). De repo is openbaar.
- Update online zetten = commit + `git push` naar `main`; Pages bouwt vanzelf (± 1 min). Verhoog altijd `CACHE` in `sw.js`, anders blijven telefoons de oude versie tonen.
- `website designs/` en `.claude/` staan in `.gitignore` en gaan niet online.

- Gewone HTML/CSS/JS zonder build-stap: `index.html`, `style.css`, `app.js`. Openen = dubbelklik op `index.html`.
- Grafieken via Chart.js 4.4.1 (CDN, jsdelivr).
- Gegevens staan in `localStorage` onder de sleutel `gymsite.v1` (schedule, sessions, checkins). Verander het dataformaat niet zonder bestaande gegevens om te zetten.
- Alle tekst in de interface is Engels (de gebruiker praat Nederlands in de chat).
- Design: volledig zwart + glazen blokken (glass) + 3D. Koppen in Archivo (breed, chroom-gradient met 3D-extrusie), tekst in Lexend, oranje (ember) accent, actieve knoppen chroom. Mobiel eerst, ronde glazen tabknoppen onderin.
- 3D: `bg3d.js` tekent met three.js r128 (cdnjs) een vervormende chromen bol + koperen ring + kleine bol achter het glas (matcap-textuur op canvas gemaakt), en laat kaarten kantelen met de muis. Zonder WebGL blijven CSS-blobs als terugval. `body` moet een transparante achtergrond houden, anders bedekt hij het 3D-canvas.
- Progress: per workout (volume per sessie + oefeningen met verschil) en per oefening (zwaarste set + geschat 1RM).
- Opslaan van een training met een zwaarder gewicht verhoogt automatisch het gewicht in het schema (`bumpPlanWeights`).
- Today: set afvinken (✓ vult lege velden met de grijze hint), rusttimer (`startRest`, eindtijd-gebaseerd, rust per oefening in `state.rest`), PR-melding (`bestBefore`), advies zwaarder gewicht (`progressionFor`: alle sets op bovenkant reps-bereik → +2,5 kg / +1 kg onder 15 kg / +1,25 kg per side), notitie per oefening (`state.exNotes`).
- Een half ingevulde training staat in `localStorage` onder `gymsite.draft` (wordt gewist bij opslaan); een lopende timer onder `gymsite.timer`.
- Een set telt alleen mee met reps > 0.
- Installeerbaar als app (PWA): `manifest.webmanifest`, `sw.js`, `icons/`. Verhoog `CACHE` in `sw.js` bij elke wijziging, anders zien telefoons de oude versie.
- Bewaarde Nederlandse teksten/oude oefeningnamen worden bij het laden omgezet in `migrate()` in `app.js`.
- Basic-Fit heeft geen openbare API: bezoeken komen uit opgeslagen trainingen + handmatige check-ins.
- Controleer wijzigingen in de browser (openen, iets invullen, opslaan, grafiek bekijken).
