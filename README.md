# Survival

Une forêt 3D où se promener, à la première personne.

- **La forêt** : épicéas et bouleaux, relief doux, clairières, rochers moussus, troncs couchés, fougères et un petit ruisseau qu'on traverse sur trois gués en pierres plates. Zone de promenade d'environ 150 m de côté.
- **Jour et nuit réels** : la position du soleil est calculée pour Annecy, à l'heure actuelle (étoiles la nuit)
- **Météo en direct à Annecy** (Open-Meteo) : nuages, pluie, neige au sol, brouillard, vent dans les arbres
- **Saisons** : couleurs des arbres, de l'herbe et des fougères, feuilles mortes en automne, neige en hiver
- **Sons** : pas selon le sol (herbe, terre, feuilles, neige), vent dans les arbres, oiseaux légers le jour, murmure du ruisseau

## Jouer

- **iPhone / navigateur** : https://lpmnakha.github.io/survival/
  (sur iPhone : Partager → « Sur l'écran d'accueil » pour l'ouvrir en plein écran)
- **Android** : télécharger `survival.apk` dans les [Releases](../../releases/tag/apk)

## Commandes

- Mobile : pouce gauche pour marcher, glisser à droite pour regarder
- Ordinateur : flèches ou ZQSD, cliquer-glisser pour regarder

Pour tester : ajouter à l'adresse `?heure=21`, `?saison=hiver` (printemps, ete, automne, hiver) ou `?meteo=pluie` (clair, nuageux, couvert, brouillard, pluie, averse, neige, orage). On peut combiner : `?heure=17&saison=hiver&meteo=neige`.

## Technique

- Même base que [Détente](https://github.com/LPMnakha/detente) : ciel, météo, contrôles, style low poly
- Three.js (r169, inclus dans `www/vendor`), sans étape de build : le dossier `www` est le site
- Textures et sons générés par le code, aucun fichier média (icônes générées par `tools/icons.py`)
- GitHub Pages publie la branche `main` ; l'`index.html` racine renvoie vers `www/`
- `.github/workflows/android.yml` emballe `www` avec Capacitor et publie l'APK
- En local : `npx http-server www` puis ouvrir http://localhost:8080
