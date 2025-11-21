# 3D Dispatch Tool

Outil interne de dispatch de requêtes 3D pour gérer le backlog et la performance des artistes 3D.

## Fonctionnalités

### Pour les Artistes 3D
- **Vue Kanban** : Suivi du backlog avec colonnes New, Ongoing, Correction, Sent
- **Drag & Drop** : Déplacer les requêtes entre les colonnes pour mettre à jour le statut
- **Détails de requête** : Visualisation complète (IKP link, design, couleurs, description)
- **Upload de rendus** : Upload d'images directement depuis l'interface

### Pour les Admins
- **Dashboard avec KPIs** : Vue d'ensemble (total requests, ongoing, sent, backlog)
- **Récapitulatif par artiste** : Backlog count, ongoing, sent, target/week avec progress bars
- **Tableau toutes requêtes** : Vue complète avec assignation manuelle
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

- Vitalii
- Vladyslav
- Xuan
- Mychailo
- Konstantin
- Sarabjot
- Mustafa

## Technologies

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- @dnd-kit (drag & drop)
- shadcn/ui (composants UI)

## Données

Les données sont stockées dans `/data/requests.json` et `/data/artists.json`. Pour le MVP, ce sont des fichiers JSON statiques qui peuvent être facilement migrés vers une base de données plus tard.

