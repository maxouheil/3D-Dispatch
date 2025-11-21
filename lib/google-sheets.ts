/**
 * Google Sheets Integration Service
 * 
 * Ce service permet de synchroniser les données depuis Google Sheets
 * vers les fichiers JSON locaux.
 * 
 * Configuration requise:
 * 1. Créer un projet dans Google Cloud Console
 * 2. Activer Google Sheets API
 * 3. Créer un Service Account et télécharger la clé JSON
 * 4. Partager le spreadsheet avec l'email du service account
 * 5. Définir les variables d'environnement:
 *    - GOOGLE_SHEETS_ID: ID du spreadsheet (dans l'URL)
 *    - GOOGLE_SERVICE_ACCOUNT_KEY: Chemin vers le fichier JSON de credentials
 */

import { Request, Artist, RequestType } from './types';

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  serviceAccountKeyPath?: string;
  serviceAccountKey?: object;
}

export interface SheetRange {
  sheetName: string;
  range: string; // Ex: "A1:Z1000"
}

/**
 * Lit les données d'une feuille Google Sheets
 */
export async function readGoogleSheet(
  spreadsheetId: string,
  range: string,
  credentials?: object
): Promise<string[][]> {
  // Cette fonction sera implémentée avec googleapis
  // Pour l'instant, retourne un tableau vide
  throw new Error('Not implemented - requires googleapis package');
}

/**
 * Convertit les lignes du spreadsheet en objets Request
 * 
 * @param rows - Lignes du spreadsheet (première ligne = headers)
 * @param headers - Mapping des colonnes (optionnel, auto-détecté si non fourni)
 * @param artists - Liste des artistes pour mapper les noms vers les IDs
 * @param sheetType - Type de feuille: 'pp' pour Follow up PP, 'client' pour Follow up client, 'main' pour l'onglet principal
 */
export function parseRequestsFromSheet(
  rows: string[][],
  headers?: Record<string, number>,
  artists: Artist[] = [],
  sheetType: 'pp' | 'client' | 'main' = 'main'
): Request[] {
  if (rows.length === 0) return [];

  // Auto-détection des headers si non fournis
  if (!headers) {
    const headerRow = rows[0];
    headers = {};
    headerRow.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase().trim();
      headers![normalizedHeader] = index;
    });
    
    // Debug: afficher les headers trouvés
    if (process.env.NODE_ENV === 'development') {
      console.log('Headers détectés:', headers);
      console.log('Première ligne de données:', rows[1]?.slice(0, 10));
    }
  }

  const requests: Request[] = [];

  // Parcourir TOUTES les lignes de données (skip header)
  // On accepte toutes les lignes qui ont au moins quelques données
  let parsedCount = 0;
  let skippedCount = 0;
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    
    // Skip seulement si la ligne est complètement vide
    if (!row || row.length === 0 || row.every(cell => !cell || cell.toString().trim() === '')) {
      skippedCount++;
      continue;
    }

    try {
      const request = mapRowToRequest(row, headers, artists, sheetType, i + 1); // +1 car on skip le header
      if (request) {
        requests.push(request);
        parsedCount++;
      } else {
        skippedCount++;
        // Log seulement si vraiment nécessaire
        if (skippedCount <= 3 && process.env.NODE_ENV === 'development') {
          console.log(`Row ${i + 1} skipped - A=${row[0]}, B=${row[1]}, C=${row[2]}`);
        }
      }
    } catch (error) {
      console.error(`Error parsing row ${i + 1}:`, error);
      skippedCount++;
    }
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`Parsed ${parsedCount} requests, skipped ${skippedCount} rows from sheet type: ${sheetType}`);
  }

  return requests;
}

/**
 * Convertit les lignes du spreadsheet en objets Artist
 */
export function parseArtistsFromSheet(
  rows: string[][],
  headers?: Record<string, number>
): Artist[] {
  if (rows.length === 0) return [];

  if (!headers) {
    const headerRow = rows[0];
    headers = {};
    headerRow.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase().trim();
      headers![normalizedHeader] = index;
    });
  }

  const artists: Artist[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    try {
      const artist = mapRowToArtist(row, headers);
      if (artist) {
        artists.push(artist);
      }
    } catch (error) {
      console.error(`Error parsing row ${i + 1}:`, error);
    }
  }

  return artists;
}

/**
 * Parse une date depuis Google Sheets
 * Peut être au format DD/MM/YYYY ou un numéro de série Excel
 */
function parseDateDDMMYYYY(dateStr: string | number): string {
  if (!dateStr && dateStr !== 0) return new Date().toISOString();
  
  // Si c'est un nombre (numéro de série Excel), le convertir
  if (typeof dateStr === 'number') {
    // Excel date serial number: 1 = 1900-01-01
    // Google Sheets utilise le même système mais avec une base différente
    // Pour Google Sheets: 0 = 1899-12-30
    const excelEpoch = new Date(1899, 11, 30); // 30 décembre 1899
    const date = new Date(excelEpoch.getTime() + dateStr * 24 * 60 * 60 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  
  // Si c'est une chaîne, essayer DD/MM/YYYY
  const dateStrClean = dateStr.toString().trim();
  if (!dateStrClean) return new Date().toISOString();
  
  // Format DD/MM/YYYY
  const parts = dateStrClean.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const year = parseInt(parts[2], 10);
    
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }
  
  // Fallback: try standard Date parsing
  const parsedDate = new Date(dateStrClean);
  if (!isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString();
  }
  
  return new Date().toISOString();
}

/**
 * Parse un prix au format $XX vers nombre
 */
function parsePrice(priceStr: string): number {
  if (!priceStr) return 0;
  // Retirer le $ et convertir
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  const price = parseFloat(cleaned);
  return isNaN(price) ? 0 : price;
}

/**
 * Extrait le prénom d'un email PP
 * Exemple: "camille.cappucci@plum-living.com" → "camille"
 */
function extractFirstNameFromEmail(email: string): string {
  if (!email) return '';
  
  // Retirer les espaces et convertir en minuscules
  const cleaned = email.trim().toLowerCase();
  
  // Extraire la partie avant le @
  const localPart = cleaned.split('@')[0];
  
  // Extraire le prénom (avant le premier point)
  const firstName = localPart.split('.')[0];
  
  // Capitaliser la première lettre
  return firstName.charAt(0).toUpperCase() + firstName.slice(1);
}

/**
 * Map le statut du spreadsheet vers le statut TypeScript
 */
function mapStatus(spreadsheetStatus: string): Request['status'] {
  const statusLower = spreadsheetStatus.toLowerCase().trim();
  
  if (statusLower.includes('sent to client') || statusLower === 'sent') {
    return 'sent';
  }
  if (statusLower.includes('ongoing') || statusLower.includes('en cours')) {
    return 'ongoing';
  }
  if (statusLower.includes('correction') || statusLower.includes('retour')) {
    return 'correction';
  }
  if (statusLower.includes('cancelled') || statusLower.includes('annulé')) {
    return 'sent'; // Ou créer un nouveau statut 'cancelled' si nécessaire
  }
  
  return 'new'; // Par défaut
}

/**
 * Map le nom d'artiste du spreadsheet vers l'ID d'artiste
 * Format: "Xuan 🇻🇳" → id de l'artiste correspondant
 * 
 * Mapping connu:
 * - Xuan 🇻🇳 → Xuan (id: "3" dans artists.json)
 * - Ahsan 🇱🇰 → Sarabjot (id: "6" dans artists.json) ou créer Ahsan
 * - Vitalii 🇺🇦 → Vitalii (id: "1" dans artists.json)
 * - Tagyr 🇺🇦 → Nouveau, à créer
 */
function mapArtistNameToId(artistName: string, artists: Artist[]): string | null {
  if (!artistName) return null;
  
  // Retirer les emojis et espaces
  const cleanedName = artistName.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
  
  // Mapping explicite pour les noms connus du spreadsheet
  const nameMapping: Record<string, string | null> = {
    'xuan': '3', // Xuan dans artists.json (id: 3)
    'vitalii': '1', // Vitalii dans artists.json (id: 1)
    'ahsan': '8', // Ahsan dans artists.json (id: 8)
    'tagyr': '9', // Tagyr dans artists.json (id: 9)
  };
  
  const normalizedName = cleanedName.toLowerCase();
  const mappedId = nameMapping[normalizedName];
  
  if (mappedId) {
    return mappedId;
  }
  
  // Fallback: chercher l'artiste par nom (insensible à la casse)
  const artist = artists.find(a => {
    const aName = a.name.toLowerCase();
    return aName.includes(normalizedName) || normalizedName.includes(aName);
  });
  
  return artist ? artist.id : null;
}

/**
 * Mappe une ligne du spreadsheet vers un objet Request
 * 
 * Mapping adapté au spreadsheet réel:
 * - A: REQUEST # → number
 * - C: CLIENT NAME (vrai nom) → clientName
 * - E: CHANNEL → type (PP si PLUM_*, sinon Client)
 * - F: RECEIVED → date
 * - H: 3D ARTIST IN CHARGE → assignedTo (mappé vers artistId)
 * - I: STATUS → status (mappé)
 * - K: DRIVE LINK → ikpLink
 * - O: PRICE → price (format $XX)
 * - P: SUPPLEMENT → description
 */
function mapRowToRequest(
  row: string[],
  headers: Record<string, number>,
  artists: Artist[] = [],
  sheetType: 'pp' | 'client' | 'main' = 'main',
  rowIndex: number = 0 // Index de la ligne pour générer un ID de fallback
): Request | null {
  const getValue = (key: string): string => {
    const index = headers[key.toLowerCase()];
    return index !== undefined ? (row[index] || '').trim() : '';
  };

  // REQUEST # - Simplifié pour être plus tolérant
  // Colonne A (index 0) = numéro direct (2497)
  // Colonne B (index 1) = "PP_REQUEST_2497_DESCHAMPS" ou "Client_1000"
  
  let numberFinal = 0;
  
  // D'abord essayer la colonne A directement (le plus fiable)
  if (row[0] !== undefined && row[0] !== null && row[0] !== '') {
    const colANumber = typeof row[0] === 'number' ? row[0] : parseInt(row[0].toString(), 10);
    if (!isNaN(colANumber) && colANumber > 0) {
      numberFinal = colANumber;
    }
  }
  
  // Si colonne A ne fonctionne pas, essayer colonne B
  if (numberFinal === 0 && row[1]) {
    const requestNumberStr = row[1].toString();
    // Extraire le numéro de "PP_REQUEST_2497_DESCHAMPS" ou "Client_1000"
    const extractedNumber = parseInt(requestNumberStr.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(extractedNumber) && extractedNumber > 0) {
      numberFinal = extractedNumber;
    }
  }
  
  // Si toujours rien, essayer via getValue (pour compatibilité)
  if (numberFinal === 0) {
    const requestNumberStr = getValue('request #') || getValue('request') || getValue('number') || '';
    if (requestNumberStr) {
      const extractedNumber = parseInt(requestNumberStr.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(extractedNumber) && extractedNumber > 0) {
        numberFinal = extractedNumber;
      }
    }
  }
  
  // Si toujours pas de numéro, utiliser l'index de la ligne comme fallback
  // Cela permet de parser TOUTES les lignes même si le numéro n'est pas trouvé
  if (numberFinal === 0) {
    // Utiliser l'index de la ligne comme numéro (au moins on a quelque chose)
    numberFinal = rowIndex;
  }

  // CLIENT NAME - Colonne C (index 2)
  // Plus tolérant : accepter même si vide
  const clientName = (getValue('client name') || 
                     getValue('name') ||
                     getValue('client') ||
                     row[2] || // Colonne C
                     '').trim() || 'Unknown';
  
  // Déterminer le type selon l'onglet
  // Si on est dans "Follow up PP", c'est forcément PP
  // Si on est dans "Follow up client", c'est Client
  // Sinon, chercher CHANNEL dans l'onglet principal
  let type: RequestType = 'Client';
  if (sheetType === 'pp') {
    type = 'PP';
  } else if (sheetType === 'client') {
    type = 'Client';
  } else {
    // Onglet principal: déterminer par CHANNEL
    const channel = getValue('channel') || row[4] || '';
    type = channel.toUpperCase().startsWith('PLUM_') ? 'PP' : 'Client';
  }
  
  // PP E-MAIL - Colonne E (index 4) dans "Follow up PP"
  // Dans "Follow up client", il n'y a pas de PP E-MAIL
  const ppEmail = sheetType === 'pp' ? (
    getValue('pp e-mail') || 
    getValue('pp email') || 
    getValue('pp') ||
    row[4] || // Colonne E
    ''
  ) : '';
  
  // Extraire le prénom de l'email PP (seulement si type PP)
  const ppName = (type === 'PP' && ppEmail) ? extractFirstNameFromEmail(ppEmail) : undefined;

  // RECEIVED - Colonne F (index 5)
  // Peut être un nombre (numéro de série Excel) ou une chaîne DD/MM/YYYY
  // getValue convertit en string, donc on doit utiliser row[5] directement pour les nombres
  const receivedDateRaw = row[5] !== undefined && row[5] !== null && row[5] !== '' 
    ? row[5] 
    : (getValue('received') || getValue('date received') || getValue('date') || '');
  
  const date = receivedDateRaw ? parseDateDDMMYYYY(receivedDateRaw) : new Date().toISOString();

  // STATUS - Chercher dans différentes colonnes selon l'onglet
  // Dans "Follow up PP" et "Follow up client", STATUS est en colonne J (index 9)
  // Dans l'onglet principal c'est colonne I (index 8)
  const statusStr = getValue('status') || 
                   getValue('state') ||
                   (sheetType === 'pp' || sheetType === 'client' ? (row[9] || '') : (row[8] || '')) ||
                   '';
  const status = statusStr ? mapStatus(statusStr) : '';

  // 3D ARTIST IN CHARGE - Colonne H (index 7)
  const artistName = getValue('3d artist in charge') || 
                    getValue('artist') ||
                    getValue('assigned to') ||
                    getValue('assigned') ||
                    row[7] || // Colonne H
                    '';
  const assignedTo = artistName ? mapArtistNameToId(artistName, artists) : null;

  // PRICE - Colonne O (index 14) dans l'onglet principal
  // Peut être ailleurs dans Follow up
  const priceStr = getValue('price') || 
                  getValue('prix') ||
                  row[14] || // Colonne O dans l'onglet principal
                  row[15] || // Peut varier
                  '';
  const price = priceStr ? parsePrice(priceStr) : 0;

  // Chercher DRIVE LINK
  const driveLink = getValue('drive link') || 
                   getValue('link') ||
                   getValue('drive') ||
                   row[10] || 
                   row[11] || // Peut varier
                   '';
  const ikpLink = driveLink || `https://drive.google.com/drive/folders/request-${numberFinal}`;

  // Chercher SUPPLEMENT/COMMENT/DESCRIPTION
  const supplement = getValue('supplement') || 
                     getValue('comment') ||
                     getValue('description') ||
                     getValue('comments') ||
                     row[15] || 
                     row[16] || // Peut varier
                     '';
  const description = supplement || '';

  // Pas de données pour design, colors, thumbnail dans le spreadsheet actuel
  // On laisse des valeurs par défaut
  const colors: Request['colors'] = {};
  const renders: Request['renders'] = [];

  return {
    id: `req-${numberFinal}`,
    number: numberFinal,
    clientName,
    ppName,
    type,
    date,
    status,
    assignedTo,
    price,
    ikpLink,
    design: '', // Non disponible dans le spreadsheet
    colors,
    description,
    thumbnail: '/thumbnails/default.jpg', // Non disponible dans le spreadsheet
    renders,
  };
}

/**
 * Mappe une ligne du spreadsheet vers un objet Artist
 */
function mapRowToArtist(
  row: string[],
  headers: Record<string, number>
): Artist | null {
  const getValue = (key: string): string => {
    const index = headers[key.toLowerCase()];
    return index !== undefined ? (row[index] || '').trim() : '';
  };

  const getNumber = (key: string, defaultValue: number = 0): number => {
    const value = getValue(key);
    if (!value) return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  const id = getValue('id');
  const name = getValue('name');
  
  if (!id || !name) return null;

  return {
    id,
    name,
    targetPerWeek: getNumber('target per week', 0),
    currentWeekCompleted: getNumber('current week completed', 0),
    backlogCount: getNumber('backlog count', 0),
    ongoingCount: getNumber('ongoing count', 0),
    sentCount: getNumber('sent count', 0),
    performanceScore: getNumber('performance score', 0),
  };
}

/**
 * Synchronise les données depuis Google Sheets vers les fichiers JSON
 */
export async function syncFromGoogleSheets(
  config: GoogleSheetsConfig
): Promise<{ requests: Request[]; artists: Artist[] }> {
  // Cette fonction sera implémentée avec googleapis
  throw new Error('Not implemented - requires googleapis package');
}

