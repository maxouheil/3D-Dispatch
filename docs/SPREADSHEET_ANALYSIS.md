# Analyse du Spreadsheet Réel

## 📊 Structure Identifiée

### Colonnes du Spreadsheet

| Colonne | Nom | Description | Mapping |
|---------|-----|-------------|---------|
| A | REQUEST # | Numéro de requête (1, 2, 3...) | `number` |
| B | CLIENT NAME | Nom technique (REQUEST_1_FARAUT) | - |
| C | CLIENT NAME | Nom réel du client (Laurent, Camille...) | `clientName` |
| D | CLIENT E-MAIL | Email du client | - |
| E | CHANNEL | Canal (PLUM_FR, PLUM_DE, PLUM_BE, ou email) | `type` (PP si PLUM_*) |
| F | RECEIVED | Date de réception (DD/MM/YYYY) | `date` |
| G | Week received | Semaine de réception | - |
| H | 3D ARTIST IN CHARGE | Artiste assigné (Xuan 🇻🇳, Ahsan 🇱🇰...) | `assignedTo` |
| I | STATUS | Statut (Sent to client, Cancelled...) | `status` |
| J | CONTACT RETARD | Contact retard | - |
| K | DRIVE LINK | Lien Google Drive | `ikpLink` |
| L | RENDER # | Numéro de rendu | - |
| M | DATE OF SENDING | Date d'envoi (DD/MM/YYYY) | - |
| N | WEEK | Semaine | - |
| O | PRICE | Prix ($10, $20, $30, $40) | `price` |
| P | SUPPLEMENT | Commentaires/notes supplémentaires | `description` |
| Q | INVOICE STATUS | Statut facture (Paid, refunded) | - |
| R | COMMENT | Commentaire | - |
| S | RETOUR CLIENT | Retour client | - |
| T | Feedback status | Statut feedback | - |

### Mapping des Statuts

| Statut Spreadsheet | Statut TypeScript |
|-------------------|-------------------|
| Sent to client | `sent` |
| Cancelled | `sent` (ou nouveau statut) |
| (autres statuts à identifier) | `new`, `ongoing`, `correction` |

### Mapping des Artistes

| Artiste Spreadsheet | ID Artiste | Mapping |
|---------------------|------------|---------|
| Xuan 🇻🇳 | À déterminer | `assignedTo` |
| Ahsan 🇱🇰 | À déterminer | `assignedTo` |
| Vitalii 🇺🇦 | À déterminer | `assignedTo` |
| Tagyr 🇺🇦 | À déterminer | `assignedTo` |

### Détection du Type (PP vs Client)

- Si `CHANNEL` commence par "PLUM_" → Type = `PP`
- Sinon → Type = `Client`

### Format des Dates

Les dates sont au format **DD/MM/YYYY** (ex: 20/11/2024)
Nécessite un parsing personnalisé.

### Format des Prix

Les prix sont au format **$XX** (ex: $10, $20, $30, $40)
Nécessite de retirer le symbole $ et convertir en nombre.

