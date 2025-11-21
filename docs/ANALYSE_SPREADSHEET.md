# Analyse du Spreadsheet Admin

## 📊 Objectif

Ce document explique comment analyser votre Google Spreadsheet pour comprendre comment il se connecte au frontend.

## 🔍 Informations Nécessaires

Pour analyser précisément votre spreadsheet (`1LzZY_4-I6-w9YvUCgYQKkjNGIfHMwE25K1N-Z9IiAsE`), j'ai besoin de connaître:

### 1. Structure des Feuilles (Sheets)

- Quels sont les noms des onglets/feuilles dans votre spreadsheet?
- Exemples: "Requests", "Artists", "Dashboard", etc.

### 2. Colonnes de la Feuille "Requests"

Listez toutes les colonnes dans l'ordre (ou envoyez-moi un screenshot de la première ligne):

| Colonne | Exemple de valeur | Type de données |
|---------|-------------------|-----------------|
| A | ? | ? |
| B | ? | ? |
| C | ? | ? |
| ... | ... | ... |

### 3. Colonnes de la Feuille "Artists"

Même chose pour les artistes:

| Colonne | Exemple de valeur | Type de données |
|---------|-------------------|-----------------|
| A | ? | ? |
| B | ? | ? |
| ... | ... | ... |

### 4. Format des Données

- **Dates**: Format utilisé? (DD/MM/YYYY, YYYY-MM-DD, etc.)
- **Nombres**: Format avec séparateurs? (1,234.56 ou 1234.56)
- **Statuts**: Valeurs possibles? (new, ongoing, sent, correction, etc.)
- **Types**: Valeurs possibles? (PP, Client, etc.)

## 🔄 Mapping Automatique vs Personnalisé

Le système actuel utilise un **mapping automatique** qui détecte les colonnes par leur nom (insensible à la casse):

### Mapping Par Défaut (Auto-détecté)

#### Pour les Requests:
- `id` → `id`
- `number` → `number`
- `client name` ou `clientname` → `clientName`
- `type` → `type`
- `date` → `date`
- `status` → `status`
- `assigned to` ou `assignedto` → `assignedTo`
- `price` → `price`
- `ikp link` ou `ikplink` → `ikpLink`
- `design` → `design`
- `colors haut` ou `haut` → `colors.haut`
- `colors bas` ou `bas` → `colors.bas`
- `colors colonne` ou `colonne` → `colors.colonne`
- `description` → `description`
- `thumbnail` → `thumbnail`

#### Pour les Artists:
- `id` → `id`
- `name` → `name`
- `target per week` → `targetPerWeek`
- `current week completed` → `currentWeekCompleted`
- `backlog count` → `backlogCount`
- `ongoing count` → `ongoingCount`
- `sent count` → `sentCount`
- `performance score` → `performanceScore`

### Si Votre Spreadsheet Utilise d'Autres Noms

Si vos colonnes ont des noms différents, vous avez deux options:

#### Option 1: Renommer les Colonnes dans le Spreadsheet
C'est la solution la plus simple - renommez les en-têtes pour correspondre aux noms attendus.

#### Option 2: Personnaliser le Mapping
Je peux modifier le fichier `lib/google-sheets.ts` pour ajouter des mappings personnalisés.

## 🧪 Test de Synchronisation

Une fois configuré, vous pouvez tester la synchronisation:

1. **Via l'interface admin**: Cliquez sur "Synchroniser" dans le dashboard
2. **Via l'API**: 
   ```bash
   curl -X POST http://localhost:3000/api/sheets/sync
   ```

## 📝 Exemple de Structure Attendue

### Feuille "Requests" (Première ligne = Headers)

```
| ID | Number | Client Name | Type | Date | Status | Assigned To | Price | IKP Link | Design | Colors Haut | Colors Bas | Description | Thumbnail |
|----|--------|-------------|------|------|--------|-------------|-------|----------|--------|-------------|------------|--------------|-----------|
| req-2300 | 2300 | IKEA France | PP | 2024-12-01 | new | | 250 | https://... | PAX Wardrobe | White | White | | ... | /thumbnails/... |
```

### Feuille "Artists" (Première ligne = Headers)

```
| ID | Name | Target Per Week | Current Week Completed | Backlog Count | Ongoing Count | Sent Count | Performance Score |
|----|------|-----------------|------------------------|---------------|---------------|------------|-------------------|
| 1 | Vitalii | 8 | 6 | 3 | 2 | 12 | 85 |
```

## 🚀 Prochaines Étapes

1. **Partagez la structure de votre spreadsheet** (colonnes, exemples de données)
2. **Je personnaliserai le mapping** si nécessaire
3. **Testez la synchronisation** une fois configurée
4. **Ajustez les mappings** selon les résultats

## 💡 Astuce

Pour partager rapidement la structure de votre spreadsheet:
- Faites un screenshot de la première ligne (headers)
- Ou exportez les 2-3 premières lignes en CSV et partagez-les
- Ou listez simplement les noms de colonnes dans l'ordre

---

**Note**: Le système est conçu pour être flexible et s'adapter à différentes structures de spreadsheets. Une fois que j'aurai les détails de votre spreadsheet, je pourrai ajuster le code en conséquence.

