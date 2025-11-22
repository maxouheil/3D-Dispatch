# Estimation du Temps de Récupération des Thumbnails

## Vue d'ensemble

Ce document fournit une estimation du temps nécessaire pour récupérer tous les thumbnails des requêtes 3D depuis Plum Scanner.

## Temps par Requête

### Scraping avec Puppeteer (par requête)

- **Lancement navigateur** (une seule fois): 2-3 secondes
- **Navigation vers page**: 3-5 secondes
- **Login** (une seule fois): 3-5 secondes
- **Attente chargement page**: 3 secondes
- **Extraction thumbnail**: 1 seconde
- **Fermeture page**: 0.5 secondes

**Total par requête (séquentiel)**: ~10-15 secondes
**Moyenne conservatrice**: **12 secondes par requête**

## Estimations par Scénario

### Scénario 1: Séquentiel (1 requête à la fois)

| Nombre de requêtes | Temps estimé |
|-------------------|--------------|
| 100 | ~20 minutes |
| 500 | ~1.7 heures |
| 1,000 | ~3.3 heures |
| 2,000 | ~6.7 heures |
| 3,724 | ~12.4 heures |

**Formule**: `(nombre_requêtes × 12 secondes) / 3600 = heures`

### Scénario 2: Parallélisation (5 workers)

Avec 5 navigateurs en parallèle, le temps est divisé par ~5.

| Nombre de requêtes | Temps estimé |
|-------------------|--------------|
| 100 | ~4 minutes |
| 500 | ~20 minutes |
| 1,000 | ~40 minutes |
| 2,000 | ~1.3 heures |
| 3,724 | ~2.5 heures |

**Formule**: `Math.ceil(nombre_requêtes / 5) × 12 secondes / 3600 = heures`

### Scénario 3: Parallélisation (10 workers)

Avec 10 navigateurs en parallèle, le temps est divisé par ~10.

| Nombre de requêtes | Temps estimé |
|-------------------|--------------|
| 100 | ~2 minutes |
| 500 | ~10 minutes |
| 1,000 | ~20 minutes |
| 2,000 | ~40 minutes |
| 3,724 | ~1.2 heures |

**Formule**: `Math.ceil(nombre_requêtes / 10) × 12 secondes / 3600 = heures`

### Scénario 4: Optimisé (réutilisation navigateur + 5 workers)

En réutilisant le navigateur entre requêtes, on économise ~3 secondes par requête.

**Temps par requête optimisé**: ~9 secondes

| Nombre de requêtes | Temps estimé |
|-------------------|--------------|
| 100 | ~3 minutes |
| 500 | ~15 minutes |
| 1,000 | ~30 minutes |
| 2,000 | ~1 heure |
| 3,724 | ~1.9 heures |

## Estimation avec Gestion d'Erreurs

En supposant:
- **10% de taux d'échec**
- **1 retry par échec**

Le nombre de requêtes à traiter augmente de ~10%.

| Nombre initial | Avec retries | Temps (séquentiel) | Temps (5 workers) |
|---------------|--------------|-------------------|-------------------|
| 100 | 110 | ~22 minutes | ~4.4 minutes |
| 500 | 550 | ~1.8 heures | ~22 minutes |
| 1,000 | 1,100 | ~3.7 heures | ~44 minutes |
| 2,000 | 2,200 | ~7.3 heures | ~1.5 heures |
| 3,724 | 4,096 | ~13.6 heures | ~2.7 heures |

## Recommandations

### Pour 100-500 requêtes
- **Parallélisation**: 5 workers
- **Temps estimé**: 15-20 minutes
- **Stratégie**: Traitement en une seule session

### Pour 500-1,000 requêtes
- **Parallélisation**: 5-10 workers
- **Temps estimé**: 20-40 minutes
- **Stratégie**: Traitement par batch de 100

### Pour 1,000+ requêtes
- **Parallélisation**: 10 workers
- **Temps estimé**: 1-2 heures
- **Stratégie**: 
  - Traitement par batch de 100-200
  - Sauvegarde progressive (toutes les 50 requêtes)
  - Système de retry automatique
  - Rate limiting pour éviter la surcharge

## Optimisations Possibles

### 1. Réutilisation du Navigateur
- **Gain**: ~3 secondes par requête
- **Implémentation**: Créer un navigateur partagé et réutiliser les pages

### 2. Login Unique
- **Gain**: ~3-5 secondes par requête (après la première)
- **Implémentation**: Se connecter une seule fois au début

### 3. Parallélisation
- **Gain**: Temps divisé par le nombre de workers
- **Recommandation**: 5-10 workers selon la charge serveur

### 4. Traitement par Batch
- **Avantage**: Sauvegarde progressive, reprise en cas d'erreur
- **Recommandation**: Batch de 50-100 requêtes

### 5. Cache des Thumbnails
- **Avantage**: Évite de refaire les requêtes déjà traitées
- **Implémentation**: Vérifier si thumbnail existe avant de scraper

### 6. Rate Limiting
- **Avantage**: Évite de surcharger le serveur Plum Living
- **Recommandation**: 1-2 requêtes par seconde par worker

## Exemple de Calcul pour 3,724 Requêtes

### Séquentiel
```
3,724 requêtes × 12 secondes = 44,688 secondes
44,688 / 3600 = 12.4 heures
```

### Parallélisation (5 workers)
```
Math.ceil(3,724 / 5) = 745 batches
745 × 12 secondes = 8,940 secondes
8,940 / 3600 = 2.5 heures
```

### Optimisé (5 workers, réutilisation navigateur)
```
Math.ceil(3,724 / 5) = 745 batches
745 × 9 secondes = 6,705 secondes
6,705 / 3600 = 1.9 heures
```

## Utilisation du Script

### Estimation
```bash
npx tsx scripts/estimate-thumbnail-fetch-time.ts
```

### Récupération (optimisée)
```bash
# Avec 5 workers, batch de 100
npx tsx scripts/fetch-all-thumbnails.ts --workers=5 --batch-size=100

# Avec 10 workers, batch de 200
npx tsx scripts/fetch-all-thumbnails.ts --workers=10 --batch-size=200
```

## Notes Importantes

1. **Ressources système**: Plus de workers = plus de RAM/CPU utilisés
2. **Rate limiting**: Plum Living peut limiter les requêtes trop rapides
3. **Stabilité réseau**: Les erreurs réseau peuvent ralentir le processus
4. **Login**: Le login peut expirer après un certain temps, nécessitant une reconnexion

## Conclusion

Pour **3,724 requêtes**:
- **Séquentiel**: ~12.4 heures
- **Parallélisation (5 workers)**: ~2.5 heures
- **Optimisé (5 workers)**: ~1.9 heures

**Recommandation**: Utiliser la parallélisation avec 5-10 workers pour un bon équilibre entre vitesse et stabilité.


