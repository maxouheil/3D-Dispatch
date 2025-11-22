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

  // Déterminer les colonnes à extraire
  let columnIndices: number[];
  if (isBicolor) {
    // Bicolor: Colonnes B puis G à AG (indices: 1, puis 6-32)
    columnIndices = [1, ...Array.from({ length: 27 }, (_, i) => i + 6)]; // 6 à 32
  } else {
    // Monochrome: Colonnes B, D, E, F puis Z à AG (indices: 1, 3, 4, 5, puis 25-32)
    columnIndices = [1, 3, 4, 5, ...Array.from({ length: 8 }, (_, i) => i + 25)]; // 25 à 32
  }

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

  return {
    projectCode,
    type: 'PP',
    isBicolor,
    headers: extractedHeaders,
    data,
    columnIndices,
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

