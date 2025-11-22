# 📋 Changelog - Mises à jour du système 3D Dispatch

## 🎯 Vue d'ensemble

Ce document récapitule toutes les mises à jour et améliorations apportées au système de dispatch 3D, notamment l'intégration complète avec Google Sheets et Google Drive.

---

## 🔄 Intégration Google Sheets

### ✅ Fonctionnalités principales

1. **Synchronisation bidirectionnelle**
   - Lecture des données depuis Google Sheets
   - Support de deux onglets: "Follow up PP" et "Follow up client"
   - Combinaison automatique des données des deux sources
   - Sauvegarde locale dans `data/requests.json` et `data/artists.json`

2. **Détection automatique des colonnes**
   - Mapping intelligent par nom de colonne (insensible à la casse)
   - Support de variations de noms (ex: "STATUS", "Status", "status")
   - Fallback sur des colonnes par défaut si non trouvées
   - Détection automatique des colonnes STATUS et 3D ARTIST IN CHARGE

3. **Gestion des données**
   - Parsing des dates (format DD/MM/YYYY et numéros de série Excel)
   - Extraction des numéros de requête depuis différents formats
   - Génération d'IDs uniques avec préfixe de type (pp-req-XXX, client-req-XXX)
   - Déduplication automatique des requêtes
   - Tri par date (plus récent en premier)

### 📁 Fichiers créés/modifiés

#### Nouveaux fichiers
- `lib/google-sheets-impl.ts` - Implémentation complète avec googleapis
- `lib/google-sheets.ts` - Service de parsing et mapping
- `lib/price-fetcher.ts` - Module de récupération des prix depuis Google Drive et Plum Living
- `components/admin/GoogleSheetsSync.tsx` - Composant UI pour la synchronisation
- `app/api/sheets/sync/route.ts` - Endpoint API pour la synchronisation
- `app/api/sheets/list/route.ts` - Endpoint pour lister les feuilles
- `app/api/sheets/debug/route.ts` - Endpoint de debug
- `scripts/check-drive-access.ts` - Script de vérification d'accès Drive
- `scripts/check-google-apis.ts` - Script de vérification des APIs
- `scripts/test-google-auth.ts` - Script de test d'authentification
- `scripts/test-price-fetcher.ts` - Script de test du récupérateur de prix
- `ACTIVER_APIS.md` - Guide pour activer les APIs Google

#### Fichiers modifiés
- `app/admin/page.tsx` - Ajout du composant GoogleSheetsSync
- `.gitignore` - Exclusion des credentials sensibles

---

## 💰 Récupération automatique des prix

### Méthode 1: Via Google Drive (ancienne méthode)

1. **Processus de récupération**
   - Extraction de l'ID de dossier depuis les liens Google Drive
   - Recherche du Google Doc unique dans chaque dossier
   - Extraction du code UUID depuis "### Project (hidden field)"
   - Scraping du prix depuis https://plum-living.com/fr/project/{code}
   - Support de requêtes parallèles avec limite de concurrence (max 5)

2. **Gestion des erreurs**
   - Gestion des dossiers vides ou inaccessibles
   - Gestion des documents multiples dans un dossier
   - Fallback sur plusieurs sélecteurs CSS pour le scraping
   - Logs détaillés pour le debugging

3. **Intégration**
   - Option "Récupérer les prix" dans l'interface de synchronisation
   - Mise à jour automatique des prix dans les requêtes
   - Statistiques de récupération affichées dans l'UI

### Méthode 2: Via CSV Typeform (nouvelle méthode - recommandée)

**Avantages** : Contourne les limitations Google Drive, plus rapide et fiable

1. **Processus de récupération**
   - Parse les CSV Typeform (PP et Client) pour extraire les codes projets
   - Mapping automatique avec les requests existantes via **NAME + DATE**
   - Connexion automatique à Plum Living avec authentification
   - Scraping du prix total depuis la page du projet
   - Mise à jour automatique des requests avec `projectCode` et prix

2. **Structure des CSV**
   - **CSV PP** : Colonne AT (index 45) = code projet, Colonne 39 = Last name, Colonne 51 = Submit Date
   - **CSV Client** : Colonne W (index 22) = code projet, Colonne 14 = Name, Colonne 29 = Submit Date
   - Extraction automatique des emails et dates pour le mapping

3. **Mapping intelligent**
   - **Stratégie principale** : NAME + DATE (normalisé pour correspondance exacte)
   - **Taux de réussite** : ~73% des projets matchés automatiquement
   - Filtre par type (PP vs Client) pour éviter les faux positifs
   - Fallback sur email + date si nom non disponible

4. **Authentification automatique**
   - Détection de redirection vers page de login
   - Remplissage automatique du formulaire
   - Variables d'environnement supportées : `PLUM_LIVING_EMAIL`, `PLUM_LIVING_PASSWORD`

5. **Scripts disponibles**
   - `scripts/fetch-prices-from-csv.ts` - Récupération complète pour tous les projets
   - `scripts/test-csv-price-fetcher.ts` - Test avec 2 projets
   - `scripts/check-price-progress.ts` - Monitoring de la progression
   - Route API : `POST /api/prices/from-csv`

6. **Performance**
   - 5 projets en parallèle (maxConcurrent)
   - ~10-15 secondes par projet
   - Estimation : ~2-3 heures pour 3058 projets
   - Logs détaillés dans `/tmp/fetch-prices.log`

**Documentation complète** : Voir `docs/PRICE_FETCHING_FROM_CSV.md`

---

## 📊 Mapping des données

### Structure des colonnes

#### Onglet "Follow up PP"
- Colonne B (index 1): REQUEST # → `number`
- Colonne C (index 2): CLIENT NAME → `clientName`
- Colonne E (index 4): PP email → `ppName`
- Colonne F (index 5): Date → `date`
- Colonne I (index 8): 3D ARTIST IN CHARGE → `assignedTo` (mappé vers artistId)
- Colonne J (index 9): STATUS → `status` (valeur brute préservée)
- Colonne L (index 11): Lien Google Drive → `ikpLink`

#### Onglet "Follow up client"
- Colonne B (index 1): REQUEST # → `number`
- Colonne D (index 3): CLIENT NAME → `clientName`
- Colonne G (index 6): RECEIVED → `date`
- Colonne I (index 8): 3D ARTIST IN CHARGE → `assignedTo` (mappé vers artistId)
- Colonne K (index 10): STATUS → `status` (valeur brute préservée)
- Colonne M (index 12): Lien Google Drive → `ikpLink`

### Mapping des artistes

- Support des emojis dans les noms (ex: "Xuan 🇻🇳")
- Nettoyage automatique des emojis pour le matching
- Mapping explicite vers les IDs d'artistes:
  - Xuan → id: "3"
  - Vitalii → id: "1"
  - Vladyslav → id: "2"
  - Mychailo → id: "4"
  - Konstantin → id: "5"
  - Sarabjot → id: "6"
  - Mustafa → id: "7"
  - Ahsan → id: "8"
  - Tagyr → id: "9"

### Gestion des statuts

- Préservation des valeurs brutes depuis le spreadsheet
- Pas de transformation automatique (affichage tel quel)
- Support de tous les statuts personnalisés

---

## 🛠️ Scripts et outils de développement

### Scripts de vérification

1. **check-drive-access.ts**
   - Vérifie l'accès du service account aux dossiers Drive
   - Liste les fichiers dans un dossier parent
   - Détecte les problèmes d'accès (erreur 403)
   - Affiche des instructions pour partager les dossiers

2. **check-google-apis.ts**
   - Vérifie que les APIs Google sont activées
   - Teste la connexion avec le service account
   - Affiche les informations du projet

3. **test-google-auth.ts**
   - Teste l'authentification Google
   - Vérifie les credentials du service account

4. **test-price-fetcher.ts**
   - Teste la récupération des prix
   - Permet de tester un lien Drive spécifique

---

## 📚 Documentation

### Nouveaux documents

1. **ACTIVER_APIS.md**
   - Guide pour activer Google Sheets API et Google Drive API
   - Liens directs vers la console Google Cloud
   - Instructions pour le projet `d-dispatch-478910`

2. **docs/MAPPING_FINAL.md**
   - Mapping complet des colonnes spreadsheet → frontend
   - Structure des données attendues
   - Exemples de formats

3. **docs/MODIFICATIONS_REQUESTS.md**
   - Détails des modifications apportées à la page Requests
   - Combinaison des onglets PP et Client
   - Extraction du prénom PP depuis les emails

4. **docs/ANALYSE_SPREADSHEET.md**
   - Guide pour analyser la structure du spreadsheet
   - Mapping automatique vs personnalisé
   - Instructions pour personnaliser le mapping

5. **docs/GOOGLE_SHEETS_INTEGRATION.md**
   - Analyse complète de l'intégration
   - Architecture proposée
   - Options d'intégration disponibles

6. **docs/SETUP_GOOGLE_SHEETS.md**
   - Guide de configuration étape par étape
   - Instructions pour créer un service account
   - Configuration des variables d'environnement

7. **docs/README_GOOGLE_SHEETS.md**
   - Résumé de l'intégration Google Sheets
   - Structure du spreadsheet attendue
   - Instructions d'installation

---

## 🎨 Interface utilisateur

### Composant GoogleSheetsSync

- **Fonctionnalités**
  - Bouton de synchronisation avec indicateur de chargement
  - Checkbox pour activer la récupération des prix
  - Affichage des résultats de synchronisation
  - Statistiques détaillées (nombre de requêtes, artistes, prix récupérés)
  - Informations de debug expandables
  - Bouton de rafraîchissement de la page

- **Affichage des résultats**
  - Message de succès/erreur avec icônes
  - Détails des requêtes synchronisées (PP vs Client)
  - Statistiques de récupération des prix
  - Informations de debug (onglets trouvés, lignes lues, etc.)
  - Structure des données pour debugging

---

## 🔐 Configuration et sécurité

### Variables d'environnement

```env
GOOGLE_SHEETS_ID=1LzZY_4-I6-w9YvUCgYQKkjNGIfHMwE25K1N-Z9IiAsE
GOOGLE_SERVICE_ACCOUNT_KEY=./credentials/service-account-key.json
# OU
GOOGLE_SERVICE_ACCOUNT_KEY_JSON='{"type":"service_account",...}'
```

### Sécurité

- Exclusion des credentials dans `.gitignore`
- Support de deux méthodes de configuration (fichier ou JSON)
- Scopes limités (readonly pour Sheets et Drive)
- Service account avec permissions minimales

---

## 🐛 Corrections et améliorations

### Corrections de bugs

1. **Détection des colonnes**
   - Amélioration de la détection automatique des colonnes STATUS et ARTIST
   - Fallback sur des colonnes par défaut si non trouvées
   - Support de variations de noms d'onglets

2. **Parsing des données**
   - Gestion des lignes vides dans l'onglet Client
   - Skip des lignes sans request # ni nom
   - Gestion des formats de dates multiples

3. **Déduplication**
   - Déduplication par ID pour éviter les doublons
   - Statistiques de déduplication dans les logs

### Améliorations de performance

- Traitement par batch pour la récupération des prix
- Limite de concurrence (max 5 requêtes simultanées)
- Délai entre les batches pour éviter le rate limiting

---

## 📈 Statistiques et debugging

### Informations de debug disponibles

- Liste des feuilles disponibles
- Onglets PP et Client trouvés
- Nombre de lignes lues par onglet
- Nombre de requêtes parsées
- Lignes ignorées (avec exemples)
- Statistiques de déduplication
- Erreurs de récupération des prix
- Structure des premières lignes de données

### Logs console

- Logs détaillés pour chaque étape de synchronisation
- Affichage des headers de colonnes détectés
- Exemples de données parsées
- Erreurs avec stack traces en mode développement

---

---

## 📊 Mise à jour - Système de statistiques et progress bars (Novembre 2024)

### ✅ Nouvelles règles de calcul des statistiques

1. **KPIs Dashboard**
   - **Requests** = Backlog + Ongoing (pas de filtre semaine)
   - **Backlog** = toutes les requêtes "new" + "pending" (pas de filtre semaine)
   - **Ongoing** = toutes les requêtes "transmitted to 3D artist" (pas de filtre semaine)
   - **Sent this week** = toutes les requêtes "sent to client" (avec filtre semaine en cours)

2. **Tableau des artistes**
   - Tri automatique par target/week (décroissant)
   - Colonnes : Name, Sent this week, Ongoing, Progress, Target/week
   - Suppression des colonnes Backlog et Requests

3. **Progress bar combinée**
   - Affichage de deux segments dans une seule barre :
     - **Vert** : Sent this week (premier segment)
     - **Orange clair** : Ongoing (second segment)
   - Largeur totale = (Sent this week + Ongoing) / Target per week
   - Affichage du pourcentage de progression à côté de la barre

4. **Targets par semaine mises à jour**
   - Vitalii : 30
   - Xuan : 20
   - Vladyslav : 20
   - Mychailo : 15
   - Konstantin, Sarabjot, Mustafa, Ahsan, Tagyr : 10

### 📁 Fichiers modifiés

- `lib/utils.ts` - Nouvelles fonctions de calcul de statut
- `app/admin/page.tsx` - Nouvelles règles de calcul des KPIs
- `app/api/artists/route.ts` - Application des nouvelles règles pour les artistes
- `app/api/artists/[id]/backlog/route.ts` - Application des nouvelles règles pour le backlog
- `components/admin/ArtistBacklogSummary.tsx` - Nouveau tableau avec progress bar combinée
- `data/artists.json` - Mise à jour des targets par semaine
- `lib/dummy-data.ts` - Mise à jour des données par défaut

---

## 🚀 Prochaines étapes possibles

### Améliorations futures

1. **Synchronisation bidirectionnelle**
   - Écriture des modifications vers Google Sheets
   - Mise à jour automatique des statuts

2. **Gestion des renders**
   - Récupération automatique des renders depuis Google Drive
   - Upload des thumbnails

3. **Notifications**
   - Notifications en temps réel des changements
   - Webhooks pour la synchronisation automatique

4. **Optimisations**
   - Cache des données pour réduire les appels API
   - Synchronisation incrémentale
   - Support de plusieurs spreadsheets

---

## 📝 Notes importantes

- Le système nécessite l'activation des APIs Google Sheets et Google Drive
- Le service account doit avoir accès aux dossiers Drive partagés
- La récupération des prix nécessite Puppeteer (optionnel)
- Les credentials doivent être configurés dans `.env.local`
- Le spreadsheet doit être partagé avec le service account

---

**Date de dernière mise à jour:** 2024-11-22
**Version:** 1.1.0

