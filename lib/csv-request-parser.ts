/**
 * CSV Request Parser Module
 * 
 * Parse les CSV Typeform pour extraire les données détaillées d'une request
 * Support pour PP (monochrome/bicolor) et Client
 */

import fs from 'fs';
import path from 'path';

export interface CSVRequestData {
  projectCode: string;
  type: 'PP' | 'Client';
  isBicolor: boolean;
  headers: string[];
  data: Record<string, string>;
  columnIndices: number[];
  ikpLink?: string | null;
  submitDate?: string | null; // Date de soumission depuis le CSV (pour construire le thumbnail)
  thumbnail?: string | null; // URL du thumbnail IKP
}

/**
 * Parse le contenu CSV (réutilisé depuis typeform-csv-parser)
 */
function parseCSVContent(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(current);
      current = '';
    } else if ((char === '\n' || (char === '\r' && nextChar !== '\n')) && !inQuotes) {
      currentRow.push(current);
      if (currentRow.length > 0 && currentRow.some(c => c.trim())) {
        rows.push(currentRow);
      }
      currentRow = [];
      current = '';
    } else if (char !== '\r') {
      current += char;
    }
  }

  if (current.trim() || currentRow.length > 0) {
    currentRow.push(current);
    if (currentRow.length > 0 && currentRow.some(c => c.trim())) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Vérifie si une chaîne est un UUID valide
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Détecte si une requête PP est monochrome ou bicolor
 * Pour l'instant, on cherche une colonne qui pourrait indiquer cela
 * TODO: Clarifier quelle colonne indique monochrome/bicolor
 */
function detectPPBicolor(row: string[], headers: string[]): boolean {
  // Chercher des indices dans les colonnes C, D, E, F
  // Si la colonne C (index 2) contient "bicolor" ou plusieurs couleurs, c'est bicolor
  const columnC = row[2]?.toLowerCase().trim() || '';
  const columnD = row[3]?.toLowerCase().trim() || '';
  
  // Si colonne C contient "bicolor" ou plusieurs valeurs séparées
  if (columnC.includes('bicolor') || columnC.includes(',') || columnC.includes(';')) {
    return true;
  }
  
  // Si colonne D contient plusieurs valeurs
  if (columnD.includes(',') || columnD.includes(';')) {
    return true;
  }
  
  // Par défaut, on considère monochrome
  return false;
}

/**
 * Détecte si une requête Client est bicolore via la colonne D
 */
function detectClientBicolor(columnD: string): boolean {
  if (!columnD) return false;
  
  // Si la colonne D contient plusieurs couleurs (séparées par virgule, point-virgule, ou espace)
  const trimmed = columnD.trim();
  if (trimmed.includes(',') || trimmed.includes(';') || trimmed.split(/\s+/).length > 1) {
    return true;
  }
  
  return false;
}

/**
 * Parse les données d'une request depuis le CSV PP
 * 
 * @param csvPath - Chemin vers le fichier CSV PP
 * @param projectCode - Code projet UUID à rechercher
 * @returns Données de la request ou null si non trouvée
 */
export function parsePPCSVRequestData(
  csvPath: string,
  projectCode: string
): CSVRequestData | null {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSVContent(content);

  if (rows.length < 2) {
    throw new Error(`CSV file is empty or has no data rows: ${csvPath}`);
  }

  const headers = rows[0];
  const projectColumnIndex = 45; // Colonne AT

  // Vérifier que la colonne project existe
  if (projectColumnIndex >= headers.length) {
    throw new Error(
      `Project column index ${projectColumnIndex} is out of range. CSV has ${headers.length} columns.`
    );
  }

  // Trouver la ligne correspondant au projectCode
  let targetRow: string[] | null = null;
  let rowIndex = -1;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length > projectColumnIndex) {
      const code = row[projectColumnIndex]?.trim();
      if (code === projectCode && isValidUUID(code)) {
        targetRow = row;
        rowIndex = i;
        break;
      }
    }
  }

  if (!targetRow) {
    return null;
  }

  // Détecter si monochrome ou bicolor
  const isBicolor = detectPPBicolor(targetRow, headers);

  // Extraire TOUTES les colonnes qui ont du contenu (pas seulement une liste prédéfinie)
  // On extrait toutes les colonnes de B (1) jusqu'à AH (33) ou jusqu'à la fin des headers
  const data: Record<string, string> = {};
  const extractedHeaders: string[] = [];
  const columnIndices: number[] = [];
  
  // Extraire toutes les colonnes de B (1) à AH (33) ou jusqu'à la fin
  const maxColumn = Math.min(33, headers.length - 1); // AH = 33, ou la dernière colonne disponible
  
  for (let colIndex = 1; colIndex <= maxColumn; colIndex++) {
    if (colIndex < headers.length) {
      const header = headers[colIndex] || `Column_${colIndex}`;
      const value = targetRow[colIndex] || '';
      
      // Extraire toutes les colonnes, même si vides (on filtrera après si nécessaire)
      // Mais on garde toutes les colonnes pour avoir le mapping complet
      data[header] = value;
      extractedHeaders.push(header);
      columnIndices.push(colIndex);
    }
  }

  return {
    projectCode,
    type: 'PP',
    isBicolor,
    headers: extractedHeaders,
    data,
    columnIndices,
    submitDate: null, // Pas disponible quand on cherche par projectCode directement
  };
}

/**
 * Parse les données d'une request depuis le CSV Client
 * 
 * @param csvPath - Chemin vers le fichier CSV Client
 * @param projectCode - Code projet UUID à rechercher
 * @returns Données de la request ou null si non trouvée
 */
export function parseClientCSVRequestData(
  csvPath: string,
  projectCode: string
): CSVRequestData | null {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSVContent(content);

  if (rows.length < 2) {
    throw new Error(`CSV file is empty or has no data rows: ${csvPath}`);
  }

  const headers = rows[0];
  const projectColumnIndex = 22; // Colonne W

  // Vérifier que la colonne project existe
  if (projectColumnIndex >= headers.length) {
    throw new Error(
      `Project column index ${projectColumnIndex} is out of range. CSV has ${headers.length} columns.`
    );
  }

  // Trouver la ligne correspondant au projectCode
  let targetRow: string[] | null = null;
  let rowIndex = -1;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length > projectColumnIndex) {
      const code = row[projectColumnIndex]?.trim();
      if (code === projectCode && isValidUUID(code)) {
        targetRow = row;
        rowIndex = i;
        break;
      }
    }
  }

  if (!targetRow) {
    return null;
  }

  // Toujours extraire colonnes B à K (indices: 1-10)
  const columnIndices = Array.from({ length: 10 }, (_, i) => i + 1); // 1 à 10

  // Détecter bicolore via colonne D (index 3)
  const columnD = targetRow[3] || '';
  const isBicolor = detectClientBicolor(columnD);

  // Extraire les données
  const data: Record<string, string> = {};
  const extractedHeaders: string[] = [];

  columnIndices.forEach((colIndex) => {
    if (colIndex < headers.length) {
      const header = headers[colIndex] || `Column_${colIndex}`;
      const value = targetRow[colIndex] || '';
      data[header] = value;
      extractedHeaders.push(header);
    }
  });

  // Si bicolore, marquer la colonne G (index 6) comme spéciale
  if (isBicolor && columnIndices.includes(6)) {
    data['_specialColumnG'] = targetRow[6] || '';
  }

  return {
    projectCode,
    type: 'Client',
    isBicolor,
    headers: extractedHeaders,
    data,
    columnIndices,
    submitDate: null, // Pas disponible quand on cherche par projectCode directement
  };
}

/**
 * Extrait le numéro de requête depuis une chaîne
 * Supporte les formats: "2497", "PP_REQUEST_2497", "Client_1000", etc.
 */
function extractRequestNumber(str: string): number | null {
  if (!str) return null;
  
  // Essayer de parser directement comme nombre
  const directNumber = parseInt(str.trim(), 10);
  if (!isNaN(directNumber) && directNumber > 0) {
    return directNumber;
  }
  
  // Extraire tous les nombres de la chaîne
  const numbers = str.match(/\d+/g);
  if (numbers && numbers.length > 0) {
    // Prendre le plus grand nombre trouvé (probablement le numéro de requête)
    const maxNumber = Math.max(...numbers.map(n => parseInt(n, 10)));
    if (maxNumber > 0) {
      return maxNumber;
    }
  }
  
  return null;
}

/**
 * Normalise une date pour la comparaison
 * Convertit différentes formats de date en YYYY-MM-DD
 */
function normalizeDateForMatching(dateStr: string): string | null {
  if (!dateStr) return null;
  
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  
  // Format ISO déjà: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.substring(0, 10);
  }
  
  // Format DD/MM/YYYY
  const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Essayer de parser avec Date
  try {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {
    // Ignorer les erreurs
  }
  
  return null;
}

/**
 * Normalise un email pour la comparaison (minuscules, trim)
 */
function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

/**
 * Compare deux dates en tenant compte d'une tolérance (même jour)
 */
function datesMatch(date1: string | null, date2: string | null): boolean {
  if (!date1 || !date2) return false;
  return date1 === date2;
}

/**
 * Parse les données d'une request depuis le CSV PP par email client + date
 * 
 * @param csvPath - Chemin vers le fichier CSV PP
 * @param clientEmail - Email client à rechercher
 * @param submitDate - Date de soumission à rechercher (format YYYY-MM-DD)
 * @returns Données de la request ou null si non trouvée
 */
export function parsePPCSVRequestDataByEmailAndDate(
  csvPath: string,
  clientEmail: string,
  submitDate: string
): CSVRequestData | null {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSVContent(content);

  if (rows.length < 2) {
    throw new Error(`CSV file is empty or has no data rows: ${csvPath}`);
  }

  const headers = rows[0];
  const emailColumnIndex = 40; // Colonne AO
  const dateColumnIndex = 51; // Colonne AZ (Submit Date UTC)
  const projectColumnIndex = 45; // Colonne AT (Project Code)

  // Normaliser les valeurs de recherche
  const normalizedEmail = normalizeEmail(clientEmail);
  const normalizedDate = normalizeDateForMatching(submitDate);

  if (!normalizedEmail || !normalizedDate) {
    return null;
  }

  // Chercher la ligne correspondante
  let targetRow: string[] | null = null;
  let foundProjectCode: string | null = null;
  let foundSubmitDate: string | null = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    
    // Vérifier que la ligne a assez de colonnes
    if (row.length <= Math.max(emailColumnIndex, dateColumnIndex, projectColumnIndex)) {
      continue;
    }
    
    // Extraire et normaliser l'email et la date depuis le CSV
    const csvEmail = normalizeEmail(row[emailColumnIndex] || '');
    const csvDateRaw = row[dateColumnIndex] || '';
    const csvDate = normalizeDateForMatching(csvDateRaw);
    
    // Comparer email et date
    if (csvEmail === normalizedEmail && datesMatch(csvDate, normalizedDate)) {
      // Trouvé! Récupérer le projectCode et la date
      const code = row[projectColumnIndex]?.trim();
      if (code && isValidUUID(code)) {
        targetRow = row;
        foundProjectCode = code;
        foundSubmitDate = csvDateRaw; // Garder la date brute du CSV pour le thumbnail
        break;
      }
    }
  }

  if (!targetRow || !foundProjectCode) {
    return null;
  }

  // Détecter si monochrome ou bicolor
  const isBicolor = detectPPBicolor(targetRow, headers);

  // Extraire TOUTES les colonnes qui ont du contenu (pas seulement une liste prédéfinie)
  // On extrait toutes les colonnes de B (1) jusqu'à AH (33) ou jusqu'à la fin des headers
  const data: Record<string, string> = {};
  const extractedHeaders: string[] = [];
  const columnIndices: number[] = [];
  
  // Extraire toutes les colonnes de B (1) à AH (33) ou jusqu'à la fin
  const maxColumn = Math.min(33, headers.length - 1); // AH = 33, ou la dernière colonne disponible
  
  for (let colIndex = 1; colIndex <= maxColumn; colIndex++) {
    if (colIndex < headers.length) {
      const header = headers[colIndex] || `Column_${colIndex}`;
      const value = targetRow[colIndex] || '';
      
      // Extraire toutes les colonnes, même si vides (on filtrera après si nécessaire)
      // Mais on garde toutes les colonnes pour avoir le mapping complet
      data[header] = value;
      extractedHeaders.push(header);
      columnIndices.push(colIndex);
    }
  }

  return {
    projectCode: foundProjectCode,
    type: 'PP',
    isBicolor,
    headers: extractedHeaders,
    data,
    columnIndices,
  };
}

/**
 * Parse les données d'une request depuis le CSV PP par numéro de requête
 * 
 * @param csvPath - Chemin vers le fichier CSV PP
 * @param requestNumber - Numéro de requête à rechercher
 * @returns Données de la request ou null si non trouvée
 */
export function parsePPCSVRequestDataByNumber(
  csvPath: string,
  requestNumber: number
): CSVRequestData | null {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSVContent(content);

  if (rows.length < 2) {
    throw new Error(`CSV file is empty or has no data rows: ${csvPath}`);
  }

  const headers = rows[0];
  const projectColumnIndex = 45; // Colonne AT

  // Chercher dans toutes les colonnes pour le numéro de requête
  // On cherche dans toutes les colonnes pour trouver une correspondance
  
  let targetRow: string[] | null = null;
  let foundProjectCode: string | null = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    
    // Chercher le numéro de requête dans toutes les colonnes
    let foundNumber = false;
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const cellValue = row[colIndex]?.toString().trim() || '';
      const extractedNumber = extractRequestNumber(cellValue);
      
      if (extractedNumber === requestNumber) {
        foundNumber = true;
        break;
      }
    }
    
    // Si on a trouvé le numéro, récupérer le projectCode depuis la colonne AT
    if (foundNumber && row.length > projectColumnIndex) {
      const code = row[projectColumnIndex]?.trim();
      if (code && isValidUUID(code)) {
        targetRow = row;
        foundProjectCode = code;
        break;
      }
    }
  }

  if (!targetRow || !foundProjectCode) {
    return null;
  }

  // Détecter si monochrome ou bicolor
  const isBicolor = detectPPBicolor(targetRow, headers);

  // Extraire TOUTES les colonnes qui ont du contenu (pas seulement une liste prédéfinie)
  // On extrait toutes les colonnes de B (1) jusqu'à AH (33) ou jusqu'à la fin des headers
  const data: Record<string, string> = {};
  const extractedHeaders: string[] = [];
  const columnIndices: number[] = [];
  
  // Extraire toutes les colonnes de B (1) à AH (33) ou jusqu'à la fin
  const maxColumn = Math.min(33, headers.length - 1); // AH = 33, ou la dernière colonne disponible
  
  for (let colIndex = 1; colIndex <= maxColumn; colIndex++) {
    if (colIndex < headers.length) {
      const header = headers[colIndex] || `Column_${colIndex}`;
      const value = targetRow[colIndex] || '';
      
      // Extraire toutes les colonnes, même si vides (on filtrera après si nécessaire)
      // Mais on garde toutes les colonnes pour avoir le mapping complet
      data[header] = value;
      extractedHeaders.push(header);
      columnIndices.push(colIndex);
    }
  }

  return {
    projectCode: foundProjectCode,
    type: 'PP',
    isBicolor,
    headers: extractedHeaders,
    data,
    columnIndices,
    submitDate: null, // Pas disponible quand on cherche par numéro
  };
}

/**
 * Parse les données d'une request depuis le CSV Client par email client + date
 * 
 * @param csvPath - Chemin vers le fichier CSV Client
 * @param clientEmail - Email client à rechercher
 * @param submitDate - Date de soumission à rechercher (format YYYY-MM-DD)
 * @returns Données de la request ou null si non trouvée
 */
export function parseClientCSVRequestDataByEmailAndDate(
  csvPath: string,
  clientEmail: string,
  submitDate: string
): CSVRequestData | null {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSVContent(content);

  if (rows.length < 2) {
    throw new Error(`CSV file is empty or has no data rows: ${csvPath}`);
  }

  const headers = rows[0];
  // CSV Client: colonne S (index 18) = email, colonne 29 (index 29) = Submit Date UTC
  const emailColumnIndex = 18; // Colonne S
  const dateColumnIndex = 29; // Colonne Submit Date (UTC)
  const projectColumnIndex = 22; // Colonne W (Project Code)

  // Normaliser les valeurs de recherche
  const normalizedEmail = normalizeEmail(clientEmail);
  const normalizedDate = normalizeDateForMatching(submitDate);

  if (!normalizedEmail || !normalizedDate) {
    return null;
  }

  // Chercher la ligne correspondante
  let targetRow: string[] | null = null;
  let foundProjectCode: string | null = null;
  let foundSubmitDate: string | null = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    
    // Vérifier que la ligne a assez de colonnes
    if (row.length <= Math.max(emailColumnIndex, dateColumnIndex, projectColumnIndex)) {
      continue;
    }
    
    // Extraire et normaliser l'email et la date depuis le CSV
    const csvEmail = normalizeEmail(row[emailColumnIndex] || '');
    const csvDateRaw = row[dateColumnIndex] || '';
    const csvDate = normalizeDateForMatching(csvDateRaw);
    
    // Comparer email et date
    if (csvEmail === normalizedEmail && datesMatch(csvDate, normalizedDate)) {
      // Trouvé! Récupérer le projectCode et la date
      const code = row[projectColumnIndex]?.trim();
      if (code && isValidUUID(code)) {
        targetRow = row;
        foundProjectCode = code;
        foundSubmitDate = csvDateRaw; // Garder la date brute du CSV pour le thumbnail
        break;
      }
    }
  }

  if (!targetRow || !foundProjectCode) {
    return null;
  }

  // Toujours extraire colonnes B à K (indices: 1-10)
  const columnIndices = Array.from({ length: 10 }, (_, i) => i + 1); // 1 à 10

  // Détecter bicolore via colonne D (index 3)
  const columnD = targetRow[3] || '';
  const isBicolor = detectClientBicolor(columnD);

  // Extraire les données
  const data: Record<string, string> = {};
  const extractedHeaders: string[] = [];

  columnIndices.forEach((colIndex) => {
    if (colIndex < headers.length) {
      const header = headers[colIndex] || `Column_${colIndex}`;
      const value = targetRow[colIndex] || '';
      data[header] = value;
      extractedHeaders.push(header);
    }
  });

  // Si bicolore, marquer la colonne G (index 6) comme spéciale
  if (isBicolor && columnIndices.includes(6)) {
    data['_specialColumnG'] = targetRow[6] || '';
  }

  return {
    projectCode: foundProjectCode,
    type: 'Client',
    isBicolor,
    headers: extractedHeaders,
    data,
    columnIndices,
    submitDate: foundSubmitDate || null,
  };
}

/**
 * Parse les données d'une request depuis le CSV Client par numéro de requête
 * 
 * @param csvPath - Chemin vers le fichier CSV Client
 * @param requestNumber - Numéro de requête à rechercher
 * @returns Données de la request ou null si non trouvée
 */
export function parseClientCSVRequestDataByNumber(
  csvPath: string,
  requestNumber: number
): CSVRequestData | null {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSVContent(content);

  if (rows.length < 2) {
    throw new Error(`CSV file is empty or has no data rows: ${csvPath}`);
  }

  const headers = rows[0];
  const projectColumnIndex = 22; // Colonne W

  // Chercher dans toutes les colonnes pour le numéro de requête
  let targetRow: string[] | null = null;
  let foundProjectCode: string | null = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    
    // Chercher le numéro de requête dans toutes les colonnes
    let foundNumber = false;
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const cellValue = row[colIndex]?.toString().trim() || '';
      const extractedNumber = extractRequestNumber(cellValue);
      
      if (extractedNumber === requestNumber) {
        foundNumber = true;
        break;
      }
    }
    
    // Si on a trouvé le numéro, récupérer le projectCode depuis la colonne W
    if (foundNumber && row.length > projectColumnIndex) {
      const code = row[projectColumnIndex]?.trim();
      if (code && isValidUUID(code)) {
        targetRow = row;
        foundProjectCode = code;
        break;
      }
    }
  }

  if (!targetRow || !foundProjectCode) {
    return null;
  }

  // Toujours extraire colonnes B à K (indices: 1-10)
  const columnIndices = Array.from({ length: 10 }, (_, i) => i + 1); // 1 à 10

  // Détecter bicolore via colonne D (index 3)
  const columnD = targetRow[3] || '';
  const isBicolor = detectClientBicolor(columnD);

  // Extraire les données
  const data: Record<string, string> = {};
  const extractedHeaders: string[] = [];

  columnIndices.forEach((colIndex) => {
    if (colIndex < headers.length) {
      const header = headers[colIndex] || `Column_${colIndex}`;
      const value = targetRow[colIndex] || '';
      data[header] = value;
      extractedHeaders.push(header);
    }
  });

  // Si bicolore, marquer la colonne G (index 6) comme spéciale
  if (isBicolor && columnIndices.includes(6)) {
    data['_specialColumnG'] = targetRow[6] || '';
  }

  return {
    projectCode: foundProjectCode,
    type: 'Client',
    isBicolor,
    headers: extractedHeaders,
    data,
    columnIndices,
    submitDate: null, // Pas disponible quand on cherche par numéro
  };
}

/**
 * Trouve les fichiers CSV Typeform dans le dossier Downloads
 */
export function findTypeformCSVs(): { ppCsv?: string; clientCsv?: string } {
  const downloadsPath = path.join(process.env.HOME || '/Users/sou', 'Downloads');

  if (!fs.existsSync(downloadsPath)) {
    return {};
  }

  const files = fs.readdirSync(downloadsPath);

  // Chercher spécifiquement les fichiers avec les IDs connus
  const ppCsv = files.find((f) => f.includes('a25xCDxH'));
  const clientCsv = files.find((f) => f.includes('oIygOgih'));

  return {
    ppCsv: ppCsv ? path.join(downloadsPath, ppCsv) : undefined,
    clientCsv: clientCsv ? path.join(downloadsPath, clientCsv) : undefined,
  };
}

/**
 * Extrait toutes les données de matching (email + date -> projectCode) depuis les CSV
 * Utilisé pour matcher en masse avec les requêtes Google Sheets
 */
export function extractAllMatchingDataFromCSVs(): Map<string, { projectCode: string; type: 'PP' | 'Client' }> {
  const { ppCsv, clientCsv } = findTypeformCSVs();
  const matchingData = new Map<string, { projectCode: string; type: 'PP' | 'Client' }>();

  // Parser le CSV PP
  if (ppCsv && fs.existsSync(ppCsv)) {
    try {
      const content = fs.readFileSync(ppCsv, 'utf-8');
      const rows = parseCSVContent(content);

      if (rows.length >= 2) {
        const emailColumnIndex = 40; // Colonne AO
        const dateColumnIndex = 51; // Colonne AZ
        const projectColumnIndex = 45; // Colonne AT

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          
          if (row.length <= Math.max(emailColumnIndex, dateColumnIndex, projectColumnIndex)) {
            continue;
          }

          const email = normalizeEmail(row[emailColumnIndex] || '');
          const dateRaw = row[dateColumnIndex] || '';
          const date = normalizeDateForMatching(dateRaw);
          const projectCode = row[projectColumnIndex]?.trim();

          if (email && date && projectCode && isValidUUID(projectCode)) {
            // Clé de matching: email|date
            const key = `${email}|${date}`;
            matchingData.set(key, { projectCode, type: 'PP' });
          }
        }
      }
    } catch (error: any) {
      console.error('Error extracting matching data from PP CSV:', error.message);
    }
  }

  // Parser le CSV Client
  if (clientCsv && fs.existsSync(clientCsv)) {
    try {
      const content = fs.readFileSync(clientCsv, 'utf-8');
      const rows = parseCSVContent(content);

      if (rows.length >= 2) {
        // Pour Client: colonne S (index 18) = email, colonne 29 (index 29) = Submit Date, colonne W (index 22) = Project Code
        const emailColumnIndex = 18; // Colonne S pour Client
        const dateColumnIndex = 29; // Colonne 29 (Submit Date UTC) pour Client
        const projectColumnIndex = 22; // Colonne W pour Client

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          
          if (row.length <= Math.max(emailColumnIndex, dateColumnIndex, projectColumnIndex)) {
            continue;
          }

          const email = normalizeEmail(row[emailColumnIndex] || '');
          const dateRaw = row[dateColumnIndex] || '';
          const date = normalizeDateForMatching(dateRaw);
          const projectCode = row[projectColumnIndex]?.trim();

          if (email && date && projectCode && isValidUUID(projectCode)) {
            // Clé de matching: email|date
            const key = `${email}|${date}`;
            // Ne pas écraser si PP existe déjà (priorité PP)
            if (!matchingData.has(key)) {
              matchingData.set(key, { projectCode, type: 'Client' });
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error extracting matching data from Client CSV:', error.message);
    }
  }

  return matchingData;
}

