# Survival

Une forêt 3D à la première personne, où l'on ramasse de quoi faire un feu de camp.

- **La forêt** : épicéas et bouleaux, relief doux, clairières, rochers moussus, troncs couchés, fougères et un petit ruisseau qu'on traverse sur sept gués en pierres plates. Zone de 400 m de côté.
- **Jour et nuit réels** : la position du soleil est calculée pour Annecy, à l'heure actuelle (étoiles la nuit)
- **Météo en direct à Annecy** (Open-Meteo) : nuages, pluie, neige au sol, brouillard, vent dans les arbres
- **Saisons** : couleurs des arbres, de l'herbe et des fougères, feuilles mortes en automne, neige en hiver
- **Sons** : pas selon le sol (herbe, terre, feuilles, neige), vent dans les arbres, oiseaux légers le jour, murmure du ruisseau, crépitement du feu

## Survivre

- **Inventaire** : 5 cases (pas de sac au début), dont 3 d'accès rapide en bas de l'écran. Piles de 10 au plus. L'icône sac ouvre l'inventaire complet : touche une case puis une autre pour les échanger.
- **En main** : touche une case d'accès rapide pour prendre l'objet en main (ou le ranger).
- **Ramasser** : cailloux, brindilles et bâtons au sol. Approche-toi (moins de 2 m) et touche l'objet : tu te baisses pour le prendre. Ce qui est ramassé repousse ailleurs au bout de 10 à 20 min.
- **Fabriquer** (icône outils) : *Petit feu de camp* = 8 cailloux, 10 brindilles, 4 bâtons. Place la preview au sol, puis touche-la pour poser les éléments un par un (cailloux en cercle, brindilles au centre, bâtons en tipi). « Démonter » rend ce qui a été posé.
- **Allumer** : prends la pierre à feu en main et touche le feu. Le feu prend en 1 à 3 coups.
- **Entretenir** : le feu brûle 10 min, chaque bâton ajoute 5 min (20 min de réserve au plus). Il faiblit avant de s'éteindre. Éteint, remets 3 brindilles puis rallume-le.
- **Sauvegarde** sur l'appareil : inventaire, objets ramassés et feux. Le feu continue de brûler appli fermée.

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
