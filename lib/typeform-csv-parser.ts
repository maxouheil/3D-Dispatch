/**
 * Typeform CSV Parser Module
 * 
 * Parse les CSV Typeform pour extraire les codes projets
 * 
 * Structure:
 * - CSV PP: colonne AT (index 45) contient le code projet
 * - CSV Client: colonne W (index 22) contient le code projet
 */

import fs from 'fs';
import path from 'path';

export interface ProjectData {
  projectCode: string;
  type: 'PP' | 'Client';
  price?: number; // Prix existant dans le CSV (Client uniquement)
  email?: string;
  submitDate?: string; // Date de soumission (Submit Date UTC)
  clientName?: string; // Nom du client si disponible dans le CSV
  [key: string]: any; // Autres données du CSV
}

export interface ParseResult {
  projects: Map<string, ProjectData>;
  stats: {
    total: number;
    pp: number;
    client: number;
    withPrice: number;
  };
}

/**
 * Détecte le type de CSV Typeform selon le nom du fichier ou le nombre de colonnes
 */
function detectCSVType(csvPath: string, headers: string[]): 'PP' | 'Client' {
  const filename = path.basename(csvPath);
  
  // Détection par nom de fichier (priorité)
  if (filename.includes('a25xCDxH')) {
    return 'PP';
  }
  if (filename.includes('oIygOgih')) {
    return 'Client';
  }
  
  // Détection par nombre de colonnes
  if (headers.length >= 50) {
    return 'PP'; // CSV PP a 55 colonnes
  }
  if (headers.length >= 30 && headers.length < 50) {
    return 'Client'; // CSV Client a 33 colonnes
  }
  
  // Par défaut, essayer de trouver la colonne "project"
  const projectIndex = headers.findIndex(h => h.toLowerCase() === 'project');
  if (projectIndex === 45) {
    return 'PP';
  }
  if (projectIndex === 22) {
    return 'Client';
  }
  
  // Fallback: supposer Client si moins de 50 colonnes
  return headers.length < 50 ? 'Client' : 'PP';
}

/**
 * Parse un CSV Typeform et extrait les codes projets
 * 
 * @param csvPath - Chemin vers le fichier CSV
 * @param type - Type de CSV ('PP' ou 'Client'), auto-détecté si non fourni
 * @returns Map des codes projets vers leurs données
 */
export function parseTypeformCSV(
  csvPath: string,
  type?: 'PP' | 'Client'
): ParseResult {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  
  // Parser le CSV complet en tenant compte des retours à la ligne dans les valeurs entre guillemets
  const rows = parseCSVContent(content);
  
  if (rows.length < 2) {
    throw new Error(`CSV file is empty or has no data rows: ${csvPath}`);
  }

  // Parser les headers
  const headers = rows[0];
  
  // Détecter le type si non fourni
  const csvType = type || detectCSVType(csvPath, headers);
  
  // Déterminer l'index de la colonne project selon le type
  let projectColumnIndex: number;
  let priceColumnIndex: number | null = null;
  
  if (csvType === 'PP') {
    projectColumnIndex = 45; // Colonne AT
  } else {
    projectColumnIndex = 22; // Colonne W
    // Chercher la colonne Price pour Client
    priceColumnIndex = headers.findIndex(h => h.toLowerCase() === 'price');
  }
  
  // Debug: vérifier que le type détecté correspond au nombre de colonnes
  if (process.env.NODE_ENV === 'development') {
    console.log(`Parsing CSV: ${path.basename(csvPath)}`);
    console.log(`  Type: ${csvType} (provided: ${type || 'auto-detected'})`);
    console.log(`  Columns: ${headers.length}`);
    console.log(`  Project column index: ${projectColumnIndex}`);
  }
  
  // Vérifier que la colonne project existe
  if (projectColumnIndex >= headers.length) {
    throw new Error(
      `Project column index ${projectColumnIndex} is out of range. CSV has ${headers.length} columns. Type detected: ${csvType}, file: ${path.basename(csvPath)}`
    );
  }
  
  // Chercher l'index de la colonne email si disponible
  const emailColumnIndex = headers.findIndex(h => 
    h.toLowerCase() === 'email' || h.toLowerCase() === 'pp_email'
  );

  // Chercher l'index de la colonne Submit Date (UTC)
  // CSV PP: colonne 51 (index 51), CSV Client: colonne 29 (index 29)
  let submitDateColumnIndex: number;
  if (csvType === 'PP') {
    submitDateColumnIndex = 51; // Colonne Submit Date (UTC) pour PP
  } else {
    submitDateColumnIndex = 29; // Colonne Submit Date (UTC) pour Client
  }

  // Chercher aussi par nom de colonne au cas où
  const submitDateHeaderIndex = headers.findIndex(h => 
    h.toLowerCase().includes('submit date') || h.toLowerCase().includes('submitdate')
  );
  if (submitDateHeaderIndex >= 0) {
    submitDateColumnIndex = submitDateHeaderIndex;
  }

  // Chercher l'index de la colonne client name si disponible
  const clientNameColumnIndex = headers.findIndex(h => 
    h.toLowerCase().includes('client name') || 
    h.toLowerCase().includes('name') ||
    h.toLowerCase().includes('lastname')
  );

  const projects = new Map<string, ProjectData>();
  let ppCount = 0;
  let clientCount = 0;
  let withPriceCount = 0;

  // Parser les lignes de données (skip header)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    try {
      
      // Extraire le code projet
      if (row.length <= projectColumnIndex) {
        console.warn(`Row ${i + 1} has insufficient columns (${row.length}), skipping`);
        continue;
      }
      
      const projectCode = row[projectColumnIndex]?.trim();
      if (!projectCode || !isValidUUID(projectCode)) {
        // Skip les lignes sans code projet valide
        continue;
      }

      // Extraire le prix si disponible (Client uniquement)
      let price: number | undefined;
      if (csvType === 'Client' && priceColumnIndex !== null && priceColumnIndex >= 0) {
        const priceStr = row[priceColumnIndex]?.trim();
        if (priceStr) {
          const parsedPrice = parsePrice(priceStr);
          if (parsedPrice > 0) {
            price = parsedPrice;
            withPriceCount++;
          }
        }
      }

      // Extraire l'email si disponible
      let email: string | undefined;
      if (emailColumnIndex >= 0 && emailColumnIndex < row.length) {
        email = row[emailColumnIndex]?.trim() || undefined;
      }

      // Extraire la date de soumission si disponible
      let submitDate: string | undefined;
      if (submitDateColumnIndex >= 0 && submitDateColumnIndex < row.length) {
        const dateStr = row[submitDateColumnIndex]?.trim();
        if (dateStr) {
          // Normaliser la date au format ISO (YYYY-MM-DD)
          submitDate = normalizeDate(dateStr);
        }
      }

      // Extraire le nom du client si disponible
      let clientName: string | undefined;
      if (clientNameColumnIndex >= 0 && clientNameColumnIndex < row.length) {
        clientName = row[clientNameColumnIndex]?.trim() || undefined;
      }

      // Créer l'objet de données du projet
      const projectData: ProjectData = {
        projectCode,
        type: csvType,
        ...(price !== undefined && { price }),
        ...(email && { email }),
        ...(submitDate && { submitDate }),
        ...(clientName && { clientName }),
      };

      projects.set(projectCode, projectData);

      if (csvType === 'PP') {
        ppCount++;
      } else {
        clientCount++;
      }
    } catch (error) {
      console.error(`Error parsing row ${i + 1}:`, error);
      continue;
    }
  }

  return {
    projects,
    stats: {
      total: projects.size,
      pp: ppCount,
      client: clientCount,
      withPrice: withPriceCount,
    },
  };
}

/**
 * Parse le contenu CSV complet en tenant compte des retours à la ligne dans les valeurs entre guillemets
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
        // Double guillemet = guillemet échappé
        current += '"';
        i++; // Skip le prochain guillemet
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Fin de colonne
      currentRow.push(current);
      current = '';
    } else if ((char === '\n' || (char === '\r' && nextChar !== '\n')) && !inQuotes) {
      // Fin de ligne (seulement si pas dans les guillemets)
      currentRow.push(current);
      if (currentRow.length > 0 && currentRow.some(c => c.trim())) {
        rows.push(currentRow);
      }
      currentRow = [];
      current = '';
    } else if (char !== '\r') {
      // Ignorer \r seul (gérer \r\n comme une seule nouvelle ligne)
      current += char;
    }
  }

  // Ajouter la dernière ligne si elle existe
  if (current.trim() || currentRow.length > 0) {
    currentRow.push(current);
    if (currentRow.length > 0 && currentRow.some(c => c.trim())) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parse une ligne CSV simple (pour compatibilité)
 */
function parseCSVLine(line: string): string[] {
  return parseCSVContent(line + '\n')[0] || [];
}

/**
 * Vérifie si une chaîne est un UUID valide
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Parse un prix depuis une chaîne
 * Supporte les formats: "€100", "100€", "100", "$100", etc.
 */
function parsePrice(priceStr: string): number {
  if (!priceStr) return 0;

  // Retirer tous les caractères sauf chiffres, points et virgules
  const cleaned = priceStr.replace(/[^\d.,]/g, '');
  
  // Remplacer la virgule par un point pour le parsing
  const normalized = cleaned.replace(',', '.');
  
  const price = parseFloat(normalized);
  return isNaN(price) ? 0 : price;
}

/**
 * Normalise une date au format ISO (YYYY-MM-DD)
 * Supporte les formats: "2025-11-22 11:13:39", "2025-11-22", etc.
 */
function normalizeDate(dateStr: string): string {
  if (!dateStr) return '';

  // Format: "2025-11-22 11:13:39" -> "2025-11-22"
  const dateMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    return dateMatch[1];
  }

  // Essayer de parser avec Date
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {
    // Ignorer les erreurs de parsing
  }

  return '';
}

/**
 * Parse les deux CSV Typeform (PP et Client) et retourne les résultats combinés
 */
export function parseBothTypeformCSVs(
  ppCsvPath?: string,
  clientCsvPath?: string
): ParseResult {
  const allProjects = new Map<string, ProjectData>();
  let totalPP = 0;
  let totalClient = 0;
  let totalWithPrice = 0;

  // Parser le CSV PP si fourni
  if (ppCsvPath && fs.existsSync(ppCsvPath)) {
    const ppResult = parseTypeformCSV(ppCsvPath, 'PP');
    ppResult.projects.forEach((data, code) => {
      allProjects.set(code, data);
    });
    totalPP = ppResult.stats.pp;
  }

  // Parser le CSV Client si fourni
  if (clientCsvPath && fs.existsSync(clientCsvPath)) {
    const clientResult = parseTypeformCSV(clientCsvPath, 'Client');
    clientResult.projects.forEach((data, code) => {
      // Si le code existe déjà (peu probable), préférer les données Client
      allProjects.set(code, data);
    });
    totalClient = clientResult.stats.client;
    totalWithPrice = clientResult.stats.withPrice;
  }

  return {
    projects: allProjects,
    stats: {
      total: allProjects.size,
      pp: totalPP,
      client: totalClient,
      withPrice: totalWithPrice,
    },
  };
}

