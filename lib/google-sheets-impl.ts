/**
 * Implémentation complète de Google Sheets avec googleapis
 * 
 * Pour utiliser cette implémentation:
 * 1. npm install googleapis
 * 2. Configurez les variables d'environnement
 * 3. Importez syncFromGoogleSheets depuis ce fichier
 */

import { google } from 'googleapis';
import { Request, Artist } from './types';

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  serviceAccountKeyPath?: string;
  serviceAccountKey?: object;
  serviceAccountKeyJson?: string;
}

/**
 * Initialise le client Google Sheets avec les credentials
 */
async function getSheetsClient(config: GoogleSheetsConfig) {
  let credentials: any;

  if (config.serviceAccountKey) {
    credentials = config.serviceAccountKey;
  } else if (config.serviceAccountKeyJson) {
    credentials = JSON.parse(config.serviceAccountKeyJson);
  } else if (config.serviceAccountKeyPath) {
    const fs = await import('fs');
    const keyFile = fs.readFileSync(config.serviceAccountKeyPath, 'utf8');
    credentials = JSON.parse(keyFile);
  } else {
    throw new Error('No service account credentials provided');
  }

  // Log pour debug: vérifier le project_id utilisé
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Google Sheets] Using project: ${credentials.project_id}`);
    console.log(`[Google Sheets] Service account: ${credentials.client_email}`);
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });

  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

/**
 * Lit les données d'une feuille Google Sheets
 * Note: Google Sheets API peut retourner jusqu'à 10,000 lignes par requête
 */
export async function readGoogleSheet(
  spreadsheetId: string,
  sheetName: string,
  range: string = 'A1:Z10000',
  config: GoogleSheetsConfig
): Promise<string[][]> {
  const sheets = await getSheetsClient(config);
  
  const fullRange = `${sheetName}!${range}`;
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: fullRange,
    valueRenderOption: 'UNFORMATTED_VALUE', // Pour avoir les valeurs brutes
  });

  const rows = response.data.values || [];
  return rows as string[][];
}

/**
 * Parse une date depuis Google Sheets
 * Peut être au format DD/MM/YYYY ou un numéro de série Excel
 */
function parseDate(dateStr: string | number): string {
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
 * Extrait le numéro de request depuis le format "REQUEST_233_GORKA" ou "PP_REQUEST_2468_AMANDINE ROUSSEAU" ou "Client_105"
 */
function extractRequestNumber(requestStr: string): number {
  if (!requestStr) return 0;
  
  // Chercher le pattern _XXX_ (ex: REQUEST_233_GORKA ou PP_REQUEST_2468_AMANDINE)
  let match = requestStr.match(/_(\d+)_/);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  // Chercher le pattern _XXX (ex: Client_105)
  match = requestStr.match(/_(\d+)$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  // Chercher juste des chiffres dans la chaîne
  match = requestStr.match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  return 0;
}

/**
 * Génère un ID unique à partir du request #
 * Inclut le type pour éviter les collisions entre PP et Client
 */
function generateRequestId(requestStr: string, type: 'PP' | 'Client'): string {
  if (!requestStr) return `${type.toLowerCase()}-req-${Date.now()}`;
  const number = extractRequestNumber(requestStr);
  if (number > 0) {
    return `${type.toLowerCase()}-req-${number}`;
  }
  // Si pas de numéro, utiliser le request string avec le type
  const cleanStr = requestStr.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  return `${type.toLowerCase()}-${cleanStr}`;
}

/**
 * Préserve la valeur brute du statut depuis la spreadsheet
 * Retourne la valeur exacte telle qu'elle apparaît dans la spreadsheet
 * Si vide, retourne une chaîne vide (pas de valeur par défaut)
 */
function mapStatus(spreadsheetStatus: string): Request['status'] {
  if (!spreadsheetStatus) return '';
  
  // Retourner la valeur brute telle quelle (trimée)
  return spreadsheetStatus.trim();
}

/**
 * Map le nom d'artiste du spreadsheet vers l'ID d'artiste
 * Format: "Xuan 🇻🇳" → id de l'artiste correspondant
 */
function mapArtistNameToId(artistName: string, artists: Artist[]): string | null {
  if (!artistName) return null;
  
  // Retirer les emojis et espaces
  const cleanedName = artistName.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
  
  // Mapping explicite pour les noms connus du spreadsheet
  const nameMapping: Record<string, string | null> = {
    'xuan': '3', // Xuan dans artists.json (id: 3)
    'vitalii': '1', // Vitalii dans artists.json (id: 1)
    'vladyslav': '2', // Vladyslav dans artists.json (id: 2)
    'mychailo': '4', // Mychailo dans artists.json (id: 4)
    'konstantin': '5', // Konstantin dans artists.json (id: 5)
    'sarabjot': '6', // Sarabjot dans artists.json (id: 6)
    'mustafa': '7', // Mustafa dans artists.json (id: 7)
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
 * Synchronise les données depuis Google Sheets
 * Combine les onglets "Follow up PP" et "Follow up client"
 * Récupère uniquement les données brutes des colonnes spécifiées
 * 
 * @param config - Configuration Google Sheets
 * @param fetchPrices - Si true, récupère les prix depuis Google Drive et Plum Living (défaut: false)
 */
export async function syncFromGoogleSheets(
  config: GoogleSheetsConfig,
  fetchPrices: boolean = false
): Promise<{ requests: Request[]; artists: Artist[]; debug?: any }> {
  const { spreadsheetId } = config;

  // Lister toutes les feuilles pour identifier les noms
  const sheets = await listSheets(config);
  
  // Utiliser les artistes par défaut
  const artists: Artist[] = [
    { id: '1', name: 'Vitalii', targetPerWeek: 8, currentWeekCompleted: 0, backlogCount: 0, ongoingCount: 0, sentCount: 0, performanceScore: 0 },
    { id: '2', name: 'Vladyslav', targetPerWeek: 7, currentWeekCompleted: 0, backlogCount: 0, ongoingCount: 0, sentCount: 0, performanceScore: 0 },
    { id: '3', name: 'Xuan', targetPerWeek: 9, currentWeekCompleted: 0, backlogCount: 0, ongoingCount: 0, sentCount: 0, performanceScore: 0 },
    { id: '4', name: 'Mychailo', targetPerWeek: 6, currentWeekCompleted: 0, backlogCount: 0, ongoingCount: 0, sentCount: 0, performanceScore: 0 },
    { id: '5', name: 'Konstantin', targetPerWeek: 8, currentWeekCompleted: 0, backlogCount: 0, ongoingCount: 0, sentCount: 0, performanceScore: 0 },
    { id: '6', name: 'Sarabjot', targetPerWeek: 7, currentWeekCompleted: 0, backlogCount: 0, ongoingCount: 0, sentCount: 0, performanceScore: 0 },
    { id: '7', name: 'Mustafa', targetPerWeek: 8, currentWeekCompleted: 0, backlogCount: 0, ongoingCount: 0, sentCount: 0, performanceScore: 0 },
    { id: '8', name: 'Ahsan', targetPerWeek: 7, currentWeekCompleted: 0, backlogCount: 0, ongoingCount: 0, sentCount: 0, performanceScore: 0 },
    { id: '9', name: 'Tagyr', targetPerWeek: 7, currentWeekCompleted: 0, backlogCount: 0, ongoingCount: 0, sentCount: 0, performanceScore: 0 },
  ];

  // Debug: afficher toutes les feuilles disponibles
  console.log('Available sheets:', sheets.map(s => s.title));

  // Trouver les onglets "Follow up PP" et "Follow up client"
  const followUpPPSheet = sheets.find(s => {
    const title = s.title.toLowerCase();
    return title.includes('follow up pp') ||
           title.includes('followup pp') ||
           title.includes('follow-up pp') ||
           title.includes('follow_up pp') ||
           (title.includes('follow up') && title.includes('pp') && !title.includes('client'));
  });
  
  // Chercher l'onglet Client avec plusieurs variations possibles
  const followUpClientSheet = sheets.find(s => {
    const title = s.title.toLowerCase();
    return title.includes('follow up client') ||
           title.includes('followup client') ||
           title.includes('follow-up client') ||
           title.includes('follow_up client') ||
           title.includes('client follow up') ||
           title.includes('client followup') ||
           title.includes('client follow-up') ||
           (title.includes('follow up') && title.includes('client') && !title.includes('pp')) ||
           (title.includes('client') && !title.includes('pp') && (title.includes('follow') || title.includes('up')));
  });
  
  // Si toujours pas trouvé, chercher tous les onglets qui contiennent "client" mais pas "pp"
  if (!followUpClientSheet) {
    const clientSheets = sheets.filter(s => {
      const title = s.title.toLowerCase();
      return title.includes('client') && !title.includes('pp');
    });
    if (clientSheets.length > 0) {
      console.log(`Found potential Client sheets (not exact match):`, clientSheets.map(s => s.title));
    }
  }

  console.log(`Found PP sheet: ${followUpPPSheet ? followUpPPSheet.title : 'NOT FOUND'}`);
  console.log(`Found Client sheet: ${followUpClientSheet ? followUpClientSheet.title : 'NOT FOUND'}`);

  const allRequests: Request[] = [];
  const debugInfo: any = {
    availableSheets: sheets.map(s => s.title),
    ppSheetFound: followUpPPSheet ? followUpPPSheet.title : null,
    clientSheetFound: followUpClientSheet ? followUpClientSheet.title : null,
    // Initialiser les valeurs Client pour s'assurer qu'elles sont toujours présentes
    clientRowsRead: 0,
    clientRequestsParsed: 0,
    clientRowsSkipped: 0,
    clientTotalRows: 0,
  };

  // Lire "Follow up PP"
  // Colonne B (index 1) → requests #, Colonne C (index 2) → NAME, Colonne E (index 4) → PP email, Colonne F (index 5) → date
  if (followUpPPSheet) {
    try {
      console.log(`Reading sheet: "${followUpPPSheet.title}"`);
      const ppRows = await readGoogleSheet(
        spreadsheetId,
        followUpPPSheet.title,
        'A1:Z3000',
        config
      );
      console.log(`Found ${ppRows.length} rows in "${followUpPPSheet.title}"`);
      
      // Détecter les colonnes depuis les headers (première ligne)
      const headerRow = ppRows[0] || [];
      let statusColIndex = -1;
      let artistColIndex = -1;
      
      // Afficher tous les headers pour debug
      console.log(`PP Sheet headers (first 15):`, headerRow.slice(0, 15).map((h, i) => `${i}: "${h}"`).join(', '));
      
      // Chercher la colonne STATUS (chercher exactement "status" en minuscules)
      for (let j = 0; j < headerRow.length; j++) {
        const header = headerRow[j]?.toString().trim() || '';
        const headerLower = header.toLowerCase();
        
        // Chercher STATUS (exact match ou contient "status")
        if ((headerLower === 'status' || headerLower.includes('status')) && statusColIndex === -1) {
          statusColIndex = j;
          console.log(`✅ Found STATUS column at index ${j}: "${header}"`);
        }
        
        // Chercher 3D ARTIST IN CHARGE
        if ((headerLower.includes('3d artist') || 
             headerLower.includes('artist in charge') || 
             headerLower.includes('assigned') ||
             headerLower === 'artist') && artistColIndex === -1) {
          artistColIndex = j;
          console.log(`✅ Found ARTIST column at index ${j}: "${header}"`);
        }
      }
      
      // Fallback: utiliser les colonnes par défaut si non trouvées
      // Pour PP: STATUS est en colonne J (index 9)
      if (statusColIndex === -1) {
        // Essayer l'index 9 (colonne J) pour PP
        if (headerRow[9] && headerRow[9].toString().toLowerCase().includes('status')) {
          statusColIndex = 9;
          console.log(`✅ Found STATUS column at fallback index 9 (colonne J): "${headerRow[9]}"`);
        } else {
          statusColIndex = 9; // Colonne J par défaut pour PP
          console.log(`⚠️  STATUS column not found in headers, using fallback index ${statusColIndex} (colonne J for PP)`);
        }
      }
      if (artistColIndex === -1) {
        // Essayer l'index 8 (colonne I) qui est souvent où se trouve 3D ARTIST IN CHARGE
        if (headerRow[8] && (headerRow[8].toString().toLowerCase().includes('artist') || headerRow[8].toString().toLowerCase().includes('assigned'))) {
          artistColIndex = 8;
          console.log(`✅ Found ARTIST column at fallback index 8: "${headerRow[8]}"`);
        } else {
          artistColIndex = 8; // Colonne I par défaut
          console.log(`⚠️  ARTIST column not found in headers, using fallback index ${artistColIndex}`);
        }
      }
      
      console.log(`PP Sheet - STATUS column: ${statusColIndex} (colonne J), ARTIST column: ${artistColIndex}\n`);
      
      let ppCount = 0;
      // Skip header (première ligne)
      for (let i = 1; i < ppRows.length; i++) {
        const row = ppRows[i];
        
        // Ignorer les lignes où la colonne B est vide
        const requestStr = row[1]?.toString().trim();
        if (!requestStr) continue;
        
        const name = row[2]?.toString().trim() || '';
        const ppEmail = row[4]?.toString().trim() || '';
        const dateRaw = row[5];
        // Récupérer la valeur brute de STATUS depuis la colonne détectée
        const statusRaw = statusColIndex >= 0 ? (row[statusColIndex]?.toString().trim() || '') : '';
        // Récupérer la valeur brute de 3D ARTIST IN CHARGE depuis la colonne détectée
        const artistName = artistColIndex >= 0 ? (row[artistColIndex]?.toString().trim() || '') : '';
        // Colonne L (index 11) = lien Google Drive pour PP
        const driveLink = row[11]?.toString().trim() || '';
        
        // Debug: afficher les valeurs brutes pour les premières lignes
        if (ppCount < 5) {
          console.log(`PP row ${i + 1} - STATUS raw: "${statusRaw}" → mapped: "${mapStatus(statusRaw)}"`);
        }
        
        const request: Request = {
          id: generateRequestId(requestStr, 'PP'),
          number: extractRequestNumber(requestStr),
          clientName: name,
          ppName: ppEmail,
          type: 'PP',
          date: parseDate(dateRaw),
          status: mapStatus(statusRaw), // Mapper vers le type RequestStatus
          assignedTo: mapArtistNameToId(artistName, artists),
          price: 0,
          ikpLink: driveLink,
          design: '',
          colors: {},
          description: '',
          thumbnail: '/thumbnails/default.jpg',
          renders: [],
        };
        
        allRequests.push(request);
        ppCount++;
      }
      
      console.log(`Parsed ${ppCount} PP requests from "${followUpPPSheet.title}"`);
      debugInfo.ppRowsRead = ppRows.length;
      debugInfo.ppRequestsParsed = ppCount;
    } catch (error) {
      console.warn(`Could not read sheet "${followUpPPSheet.title}":`, error);
      debugInfo.ppError = error instanceof Error ? error.message : String(error);
    }
  } else {
    console.warn('Sheet "Follow up PP" not found');
    debugInfo.ppSheetFound = false;
  }

  // Lire "Follow up client"
  // Colonne B (index 1) → requests #, Colonne D (index 3) → NAME, Colonne F (index 5) → date
  if (followUpClientSheet) {
    try {
      console.log(`Reading sheet: "${followUpClientSheet.title}"`);
      debugInfo.clientSheetTitle = followUpClientSheet.title;
      const clientRows = await readGoogleSheet(
        spreadsheetId,
        followUpClientSheet.title,
        'A1:Z2000',
        config
      );
      console.log(`\n=== CLIENT SHEET DEBUG ===`);
      console.log(`Found ${clientRows.length} rows in "${followUpClientSheet.title}"`);
      debugInfo.clientRowsRead = clientRows.length;
      
      // Détecter les colonnes depuis les headers (première ligne)
      const headerRow = clientRows[0] || [];
      let statusColIndex = -1;
      let artistColIndex = -1;
      
      // Afficher tous les headers pour debug
      console.log(`Client Sheet headers (first 15):`, headerRow.slice(0, 15).map((h, i) => `${i}: "${h}"`).join(', '));
      
      // Chercher la colonne STATUS (chercher exactement "status" en minuscules)
      for (let j = 0; j < headerRow.length; j++) {
        const header = headerRow[j]?.toString().trim() || '';
        const headerLower = header.toLowerCase();
        
        // Chercher STATUS (exact match ou contient "status")
        if ((headerLower === 'status' || headerLower.includes('status')) && statusColIndex === -1) {
          statusColIndex = j;
          console.log(`✅ Found STATUS column at index ${j}: "${header}"`);
        }
        
        // Chercher 3D ARTIST IN CHARGE
        if ((headerLower.includes('3d artist') || 
             headerLower.includes('artist in charge') || 
             headerLower.includes('assigned') ||
             headerLower === 'artist') && artistColIndex === -1) {
          artistColIndex = j;
          console.log(`✅ Found ARTIST column at index ${j}: "${header}"`);
        }
      }
      
      // Fallback: utiliser les colonnes par défaut si non trouvées
      // Pour Client: STATUS est en colonne K (index 10)
      if (statusColIndex === -1) {
        // Essayer l'index 10 (colonne K) pour Client
        if (headerRow[10] && headerRow[10].toString().toLowerCase().includes('status')) {
          statusColIndex = 10;
          console.log(`✅ Found STATUS column at fallback index 10 (colonne K): "${headerRow[10]}"`);
        } else {
          statusColIndex = 10; // Colonne K par défaut pour Client
          console.log(`⚠️  STATUS column not found in headers, using fallback index ${statusColIndex} (colonne K for Client)`);
        }
      }
      if (artistColIndex === -1) {
        // Essayer l'index 8 (colonne I) qui est souvent où se trouve 3D ARTIST IN CHARGE
        if (headerRow[8] && (headerRow[8].toString().toLowerCase().includes('artist') || headerRow[8].toString().toLowerCase().includes('assigned'))) {
          artistColIndex = 8;
          console.log(`✅ Found ARTIST column at fallback index 8: "${headerRow[8]}"`);
        } else {
          artistColIndex = 8; // Colonne I par défaut
          console.log(`⚠️  ARTIST column not found in headers, using fallback index ${artistColIndex}`);
        }
      }
      
      console.log(`Client Sheet - STATUS column: ${statusColIndex} (colonne K), ARTIST column: ${artistColIndex}\n`);
      
      let clientCount = 0;
      let skippedCount = 0;
      
      // Debug: afficher les premières lignes pour comprendre la structure
      if (clientRows.length > 1) {
        console.log(`\nFirst Client row (header):`, JSON.stringify(clientRows[0]?.slice(0, 15)));
        console.log(`Second Client row (data):`, JSON.stringify(clientRows[1]?.slice(0, 15)));
        if (clientRows.length > 2) {
          console.log(`Third Client row (data):`, JSON.stringify(clientRows[2]?.slice(0, 15)));
        }
      }
      
      // Skip header (première ligne)
      for (let i = 1; i < clientRows.length; i++) {
        const row = clientRows[i];
        
        // Vérifier si la ligne est complètement vide
        if (!row || row.length === 0 || row.every(cell => !cell || cell.toString().trim() === '')) {
          skippedCount++;
          continue;
        }
        
        // Chercher le request # dans différentes colonnes possibles
        // Colonne B (index 1) est la principale, mais on peut aussi chercher dans A ou C
        let requestStr = row[1]?.toString().trim() || '';
        if (!requestStr) {
          // Essayer colonne A (index 0)
          requestStr = row[0]?.toString().trim() || '';
        }
        if (!requestStr) {
          // Essayer colonne C (index 2) au cas où
          requestStr = row[2]?.toString().trim() || '';
        }
        
        // Si toujours pas de request #, mais qu'on a un nom ou d'autres données, on peut quand même créer une requête
        // avec un ID basé sur l'index de la ligne
        if (!requestStr) {
          // Vérifier si on a au moins un nom (colonne D ou C)
          const hasName = (row[3]?.toString().trim() || row[2]?.toString().trim() || '').trim();
          if (!hasName) {
            skippedCount++;
            if (skippedCount <= 5) {
              console.log(`Skipped Client row ${i + 1} (no request # and no name): A=${row[0]}, B=${row[1]}, C=${row[2]}, D=${row[3]}, E=${row[4]}, F=${row[5]}, G=${row[6]}`);
            }
            continue;
          }
          // Créer un request # artificiel basé sur l'index
          requestStr = `Client_${i}`;
        }
        
        // Vérifier aussi si on a un nom, sinon skip
        const name = (row[3]?.toString().trim() || row[2]?.toString().trim() || '').trim();
        if (!name) {
          skippedCount++;
          if (skippedCount <= 5) {
            console.log(`Skipped Client row ${i + 1} (no name): requestStr=${requestStr}, D=${row[3]}, C=${row[2]}`);
          }
          continue;
        }
        
        // Date est en colonne G (index 6) "RECEIVED", pas F (index 5) "CHANNEL"
        const dateRaw = row[6] || row[5] || row[4]; // Colonne G (RECEIVED) en priorité
        // Récupérer la valeur brute de STATUS depuis la colonne détectée
        const statusRaw = statusColIndex >= 0 ? (row[statusColIndex]?.toString().trim() || '') : '';
        // Récupérer la valeur brute de 3D ARTIST IN CHARGE depuis la colonne détectée
        const artistName = artistColIndex >= 0 ? (row[artistColIndex]?.toString().trim() || '') : '';
        // Colonne M (index 12) = lien Google Drive pour clients
        const driveLink = row[12]?.toString().trim() || '';
        
        // Debug: afficher les valeurs brutes pour les premières lignes
        if (clientCount < 5) {
          console.log(`Client row ${i + 1} - STATUS raw: "${statusRaw}" → mapped: "${mapStatus(statusRaw)}"`);
        }
        
        const request: Request = {
          id: generateRequestId(requestStr, 'Client'),
          number: extractRequestNumber(requestStr),
          clientName: name,
          ppName: undefined,
          type: 'Client',
          date: parseDate(dateRaw),
          status: mapStatus(statusRaw), // Mapper vers le type RequestStatus
          assignedTo: mapArtistNameToId(artistName, artists),
          price: 0,
          ikpLink: driveLink,
          design: '',
          colors: {},
          description: '',
          thumbnail: '/thumbnails/default.jpg',
          renders: [],
        };
        
        allRequests.push(request);
        clientCount++;
      }
      
      console.log(`Parsed ${clientCount} Client requests from "${followUpClientSheet.title}" (skipped ${skippedCount} rows)`);
      console.log(`Total rows: ${clientRows.length}, Data rows: ${clientRows.length - 1}, Parsed: ${clientCount}, Skipped: ${skippedCount}`);
      console.log(`=== END CLIENT SHEET DEBUG ===\n`);
      debugInfo.clientRequestsParsed = clientCount;
      debugInfo.clientRowsSkipped = skippedCount;
      debugInfo.clientTotalRows = clientRows.length - 1; // -1 pour le header
      if (clientRows.length > 1) {
        debugInfo.clientFirstRow = clientRows[0]?.slice(0, 15);
        debugInfo.clientSecondRow = clientRows[1]?.slice(0, 15);
        if (clientRows.length > 2) {
          debugInfo.clientThirdRow = clientRows[2]?.slice(0, 15);
        }
        // Afficher quelques exemples de lignes ignorées
        if (skippedCount > 0) {
          let skippedExamples: any[] = [];
          for (let i = 1; i < clientRows.length && skippedExamples.length < 3; i++) {
            const row = clientRows[i];
            const requestStr = row[1]?.toString().trim() || row[0]?.toString().trim() || '';
            const name = (row[3]?.toString().trim() || row[2]?.toString().trim() || '').trim();
            if (!requestStr && !name) {
              skippedExamples.push({
                rowIndex: i + 1,
                data: row.slice(0, 10)
              });
            }
          }
          debugInfo.clientSkippedExamples = skippedExamples;
        }
      }
    } catch (error) {
      console.warn(`Could not read sheet "${followUpClientSheet.title}":`, error);
      debugInfo.clientError = error instanceof Error ? error.message : String(error);
      debugInfo.clientErrorStack = error instanceof Error ? error.stack : undefined;
    }
  } else {
    console.warn('Sheet "Follow up client" not found');
    console.warn('Available sheets:', sheets.map(s => s.title));
    debugInfo.clientSheetFound = false;
    // Chercher tous les onglets qui pourraient être l'onglet Client
    const potentialClientSheets = sheets.filter(s => {
      const title = s.title.toLowerCase();
      return title.includes('client') || title.includes('clients');
    });
    debugInfo.potentialClientSheets = potentialClientSheets.map(s => s.title);
  }

  // Dédupliquer les requêtes par ID (garder la première occurrence)
  // Ajouter des stats de debug pour la déduplication
  const duplicateStats = { total: allRequests.length, duplicates: 0 };
  const uniqueRequests = allRequests.reduce((acc, req) => {
    const existing = acc.find(r => r.id === req.id);
    if (!existing) {
      acc.push(req);
    } else {
      duplicateStats.duplicates++;
      // Log les premiers doublons pour debug
      if (duplicateStats.duplicates <= 5) {
        console.log(`Duplicate ID found: ${req.id} (${req.type}, number: ${req.number}, clientName: ${req.clientName})`);
      }
    }
    return acc;
  }, [] as Request[]);
  
  debugInfo.duplicateStats = duplicateStats;
  console.log(`Deduplication: ${duplicateStats.total} total requests, ${duplicateStats.duplicates} duplicates removed, ${uniqueRequests.length} unique requests`);

  // Trier par date (plus récent d'abord)
  const requests = uniqueRequests.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA; // Décroissant (plus récent en premier)
  });

  debugInfo.totalRequests = requests.length;
  debugInfo.ppRequests = requests.filter(r => r.type === 'PP').length;
  debugInfo.clientRequests = requests.filter(r => r.type === 'Client').length;

  // Récupérer les prix si demandé
  if (fetchPrices) {
    try {
      console.log('Fetching prices from Google Drive and Plum Living...');
      const { fetchPricesForRequests } = await import('./price-fetcher');
      
      const requestsWithLinks = requests
        .filter(r => r.ikpLink && r.ikpLink.trim())
        .map(r => ({ id: r.id, ikpLink: r.ikpLink, type: r.type }));
      
      if (requestsWithLinks.length > 0) {
        const priceMap = await fetchPricesForRequests(requestsWithLinks, config, 5);
        
        // Mettre à jour les prix dans les requests
        requests.forEach(request => {
          const price = priceMap.get(request.id);
          if (price !== undefined && price > 0) {
            request.price = price;
          }
        });
        
        const pricesFetched = Array.from(priceMap.values()).filter(p => p > 0).length;
        debugInfo.pricesFetched = pricesFetched;
        debugInfo.pricesTotal = requestsWithLinks.length;
        console.log(`Fetched prices for ${pricesFetched} out of ${requestsWithLinks.length} requests`);
      } else {
        console.log('No requests with drive links to fetch prices for');
        debugInfo.pricesFetched = 0;
        debugInfo.pricesTotal = 0;
      }
    } catch (error: any) {
      console.error('Error fetching prices:', error);
      debugInfo.priceFetchError = error.message;
    }
  }

  // Log final pour debug
  console.log('Final debug info:', JSON.stringify(debugInfo, null, 2));

  return { requests, artists, debug: debugInfo };
}

/**
 * Liste toutes les feuilles disponibles dans le spreadsheet
 */
export async function listSheets(
  config: GoogleSheetsConfig
): Promise<Array<{ title: string; sheetId: number }>> {
  const sheets = await getSheetsClient(config);
  
  const response = await sheets.spreadsheets.get({
    spreadsheetId: config.spreadsheetId,
  });

  const sheetList = response.data.sheets || [];
  return sheetList.map(sheet => ({
    title: sheet.properties?.title || '',
    sheetId: sheet.properties?.sheetId || 0,
  }));
}

