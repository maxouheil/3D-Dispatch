# 📊 Règles de calcul des statistiques

Ce document décrit les règles de calcul utilisées pour les statistiques affichées dans le dashboard admin.

## 🎯 KPIs Dashboard (Page principale)

Les KPIs affichés en haut de la page admin suivent ces règles :

### Requests
- **Formule** : Backlog + Ongoing
- **Filtre** : Aucun (toutes les requêtes)

### Backlog
- **Définition** : Toutes les requêtes avec le statut "new" OU "pending"
- **Filtre** : Aucun (toutes les requêtes, pas de limite de date)

### Ongoing
- **Définition** : Toutes les requêtes avec le statut "transmitted to 3D artist" (ou variantes)
- **Filtre** : Aucun (toutes les requêtes, pas de limite de date)

### Sent this week
- **Définition** : Toutes les requêtes avec le statut "sent to client"
- **Filtre** : Semaine en cours uniquement (lundi au dimanche)

## 👥 Tableau des artistes

Le tableau des artistes affiche les statistiques suivantes pour chaque artiste :

### Colonnes affichées

1. **Name** : Nom de l'artiste avec drapeau
2. **Sent this week** : Nombre de requêtes "sent to client" dans la semaine en cours
3. **Ongoing** : Nombre de requêtes "transmitted to 3D artist" (toutes dates)
4. **Progress** : Barre de progression combinée avec pourcentage
5. **Target/week** : Objectif hebdomadaire de l'artiste

### Progress bar

La progress bar combine deux segments dans une seule barre :

- **Vert** : Proportion de "Sent this week" dans le total (Sent + Ongoing)
- **Orange clair** : Proportion de "Ongoing" dans le total (Sent + Ongoing)

**Largeur totale** : (Sent this week + Ongoing) / Target per week × 100%

**Exemple** :
- Sent this week = 10
- Ongoing = 5
- Target = 30
- Barre totale = 15/30 = 50% de la largeur
- Dans cette barre : 67% vert (10/15) + 33% orange (5/15)

### Tri

Le tableau est automatiquement trié par **Target/week** en ordre décroissant (du plus grand au plus petit).

## 📈 Targets par semaine

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

## 🔍 Détails techniques

### Fonctions de statut (`lib/utils.ts`)

- `isBacklogStatus(status)` : Retourne `true` si le statut est "new" ou "pending"
- `isOngoingStatus(status)` : Retourne `true` si le statut contient "transmitted to 3D artist"
- `isSentStatus(status)` : Retourne `true` si le statut est "sent to client"
- `isWithinCurrentWeek(dateString)` : Retourne `true` si la date est dans la semaine en cours (lundi-dimanche)

### Semaine en cours

La semaine en cours est définie comme :
- **Début** : Lundi à 00:00:00 UTC
- **Fin** : Dimanche à 23:59:59 UTC

La fonction `getCurrentWeekRange()` retourne une chaîne formatée (ex: "17 - 23 novembre").

## 📝 Notes importantes

1. **Pas de filtre de date** pour Backlog et Ongoing : Ces statistiques incluent toutes les requêtes, quelle que soit leur date.

2. **Filtre de semaine** uniquement pour "Sent this week" : Seules les requêtes "sent to client" de la semaine en cours sont comptabilisées.

3. **Progress bar** : La barre de progression montre la performance de l'artiste par rapport à son objectif hebdomadaire, avec une distinction visuelle entre les requêtes envoyées (vert) et en cours (orange).


