# 3D Dispatch Tool

Outil interne de dispatch de requêtes 3D pour gérer le backlog et la performance des artistes 3D.

## Fonctionnalités

### Pour les Artistes 3D
- **Vue Kanban** : Suivi du backlog avec colonnes New, Ongoing, Correction, Sent
- **Drag & Drop** : Déplacer les requêtes entre les colonnes pour mettre à jour le statut
- **Détails de requête** : Visualisation complète (IKP link, design, couleurs, description)
- **Upload de rendus** : Upload d'images directement depuis l'interface

### Pour les Admins
- **Dashboard avec KPIs** : Vue d'ensemble avec règles de calcul personnalisées
  - **Requests** = Backlog + Ongoing
  - **Backlog** = New + Pending
  - **Ongoing** = Transmitted to 3D artist
  - **Sent this week** = Sent to client (filtre semaine en cours)
- **Récapitulatif par artiste** : Tableau trié par target/week avec progress bar combinée
  - Colonnes : Name, Sent this week, Ongoing, Progress, Target/week
  - Progress bar : Vert (Sent this week) + Orange clair (Ongoing)
  - Affichage du pourcentage de progression
- **Tableau toutes requêtes** : Vue complète avec assignation manuelle et filtres
- **Dispatch automatique** : Algorithme basé sur backlog, performance et target/week
- **Configuration dispatch** : Ajustement des poids de l'algorithme

## Installation

### Option 1 : Script automatique (recommandé)

**Sur macOS/Linux :**
```bash
./start.sh
```

**Sur Windows :**
```bash
start.bat
```

### Option 2 : Commandes manuelles

```bash
# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000)

## Structure

- `/` - Page d'accueil avec liens vers artistes et admin
- `/kanban/[artistId]` - Vue Kanban pour un artiste spécifique
- `/request/[requestId]` - Détails d'une requête avec upload de rendus
- `/admin` - Dashboard admin avec KPIs et tableau
- `/admin/dispatch` - Page de dispatch avec configuration automatique

## Artistes 3D

| Artiste | Target/Week |
|---------|-------------|
| Vitalii | 30 |
| Xuan | 20 |
| Vladyslav | 20 |
| Mychailo | 15 |
| Konstantin | 10 |
| Sarabjot | 10 |
| Mustafa | 10 |
| Ahsan | 10 |
| Tagyr | 10 |

## Technologies

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- @dnd-kit (drag & drop)
- shadcn/ui (composants UI)

## Données

Les données sont stockées dans `/data/requests.json` et `/data/artists.json`. Pour le MVP, ce sont des fichiers JSON statiques qui peuvent être facilement migrés vers une base de données plus tard.

## Récupération des Prix

Le système supporte deux méthodes pour récupérer les prix des projets :

### Méthode 1: Via Google Drive (ancienne)
- Extraction du code projet depuis Google Doc
- Scraping depuis Plum Living
- Disponible via l'interface de synchronisation Google Sheets

### Méthode 2: Via CSV Typeform (recommandée)
- Parse les CSV Typeform pour extraire les codes projets
- Mapping automatique avec les requests via **NAME + DATE**
- Récupération des prix depuis Plum Living avec authentification automatique
- **Documentation complète** : Voir `docs/PRICE_FETCHING_FROM_CSV.md`

**Utilisation rapide** :
```bash
# Récupération complète des prix
npx tsx scripts/fetch-prices-from-csv.ts

# Vérifier la progression
npx tsx scripts/check-price-progress.ts
```

