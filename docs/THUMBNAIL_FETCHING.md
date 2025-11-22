# Récupération des Thumbnails IKP depuis Plum Scanner

## Vue d'ensemble

Ce document explique comment les thumbnails des projets IKEA Kitchen Planner (IKP) sont récupérés depuis Plum Scanner/Plum Living.

## Source des Thumbnails

Les thumbnails sont stockés sur **Azure Blob Storage** avec le pattern suivant:

```
https://plumscannerfiles.blob.core.windows.net/qstransfer/{date}-{projectCode}-thumbnail.jpeg
```

### Exemple d'URL

```
https://plumscannerfiles.blob.core.windows.net/qstransfer/2025-07-31T08%3A27%3A10-4996EBE2-98E6-4D03-A777-9EC4BDBB1C26-thumbnail.jpeg
```

### Format de l'URL

- **Base URL**: `https://plumscannerfiles.blob.core.windows.net/qstransfer/`
- **Date**: Format ISO avec `:` encodés en `%3A` (ex: `2025-07-31T08%3A27%3A10`)
- **Project Code**: UUID du projet (ex: `4996EBE2-98E6-4D03-A777-9EC4BDBB1C26`)
- **Suffixe**: `-thumbnail.jpeg`

## Méthodes de Récupération

### 1. Scraping depuis la Page Plum Living

La fonction `fetchThumbnailFromPlumLiving()` utilise Puppeteer pour:

1. Se connecter à `https://plum-living.com/fr/project/{projectCode}`
2. Se connecter automatiquement si nécessaire (avec les credentials configurés)
3. Chercher les thumbnails dans:
   - Les balises `<img>` avec `src` contenant `plumscannerfiles.blob.core.windows.net`
   - Les styles `background-image` contenant ces URLs
   - Les attributs `data-*` contenant ces URLs
   - Le HTML source de la page
   - Les requêtes réseau interceptées

### 2. Construction d'URL selon le Pattern

La fonction `buildThumbnailUrl()` construit l'URL selon le pattern connu:

```typescript
buildThumbnailUrl(projectCode: string, date?: string): string
```

**Note**: Cette méthode peut ne pas fonctionner si la date est incorrecte, car les fichiers sont nommés avec la date de création/upload.

## Utilisation

### Récupérer un Thumbnail

```typescript
import { fetchThumbnailFromPlumLiving } from '@/lib/thumbnail-fetcher';

const projectCode = '4996EBE2-98E6-4D03-A777-9EC4BDBB1C26';
const thumbnailUrl = await fetchThumbnailFromPlumLiving(projectCode);

if (thumbnailUrl) {
  console.log('Thumbnail URL:', thumbnailUrl);
  // Utiliser l'URL pour mettre à jour la request
}
```

### Construire une URL de Thumbnail

```typescript
import { buildThumbnailUrl } from '@/lib/thumbnail-fetcher';

const projectCode = '4996EBE2-98E6-4D03-A777-9EC4BDBB1C26';
const date = '2025-07-31T08:27:10'; // Optionnel
const thumbnailUrl = buildThumbnailUrl(projectCode, date);
```

## Intégration avec le Flux Existant

### Mise à Jour lors de la Récupération des Prix

Pour automatiser la récupération des thumbnails lors de la récupération des prix, vous pouvez modifier `fetchPriceFromPlumLiving()` dans `lib/price-fetcher.ts` pour aussi récupérer le thumbnail:

```typescript
// Dans fetchPriceFromPlumLiving, après avoir récupéré le prix:
const { fetchThumbnailFromPlumLiving } = await import('./thumbnail-fetcher');
const thumbnail = await fetchThumbnailFromPlumLiving(projectCode);
// Retourner à la fois le prix et le thumbnail
```

### Mise à Jour des Requests

Pour mettre à jour les thumbnails dans les requests existantes:

```typescript
import { fetchThumbnail } from '@/lib/thumbnail-fetcher';
import { getRequests, saveRequests } from '@/app/api/requests/route';

const requests = getRequests();
for (const request of requests) {
  if (request.projectCode && !request.thumbnail.includes('plumscannerfiles')) {
    const thumbnail = await fetchThumbnail(request.projectCode);
    if (thumbnail) {
      request.thumbnail = thumbnail;
    }
  }
}
saveRequests(requests);
```

## Limitations

1. **Authentification requise**: L'accès à la page Plum Living nécessite une connexion
2. **Date inconnue**: Si la date de création n'est pas connue, la construction d'URL peut échouer
3. **Performance**: Le scraping avec Puppeteer est plus lent qu'une API directe
4. **Stabilité**: Les URLs peuvent changer si la structure de la page Plum Living change

## Variables d'Environnement

Les mêmes credentials que pour la récupération des prix sont utilisés:

```bash
PLUM_LIVING_EMAIL=souheil@plum-living.com
PLUM_LIVING_PASSWORD=Lbooycz7
```

## Dépannage

### Thumbnail non trouvé

1. Vérifier que le `projectCode` est correct
2. Vérifier que la connexion à Plum Living fonctionne
3. Vérifier que le projet existe sur Plum Living
4. Essayer de construire l'URL manuellement avec différentes dates

### Erreur de connexion

1. Vérifier les credentials dans les variables d'environnement
2. Vérifier que Puppeteer est installé: `npm install puppeteer`
3. Vérifier que la page Plum Living est accessible

## Fichiers Concernés

- `lib/thumbnail-fetcher.ts` - Module de récupération des thumbnails
- `lib/price-fetcher.ts` - Module de récupération des prix (peut être étendu)
- `lib/types.ts` - Interface `Request` avec le champ `thumbnail`
- `components/kanban/KanbanCard.tsx` - Affichage des thumbnails


