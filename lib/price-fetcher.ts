/**
 * Price Fetcher Module
 * 
 * Récupère les prix des projets depuis Google Drive et Plum Living
 * 
 * Processus:
 * 1. Ouvre le lien Google Drive (colonne L pour PP, colonne M pour clients)
 * 2. Trouve le Google Doc unique dans le dossier
 * 3. Extrait le code UUID depuis "### Project (hidden field)"
 * 4. Scrape le prix depuis https://plum-living.com/fr/project/{code}
 * 5. Retourne le prix
 */

import { google } from 'googleapis';

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  serviceAccountKeyPath?: string;
  serviceAccountKey?: object;
  serviceAccountKeyJson?: string;
}

/**
 * Initialise le client Google Drive avec les credentials
 */
async function getDriveClient(config: GoogleSheetsConfig) {
  let credentials: object;

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

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });

  const authClient = await auth.getClient();
  return google.drive({ version: 'v3', auth: authClient });
}

/**
 * Extrait l'ID du dossier depuis un lien Google Drive
 * Exemples:
 * - https://drive.google.com/drive/folders/1ABC123xyz → 1ABC123xyz
 * - https://drive.google.com/open?id=1ABC123xyz → 1ABC123xyz
 */
function extractFolderIdFromDriveLink(driveLink: string): string | null {
  if (!driveLink || !driveLink.trim()) {
    return null;
  }

  // Pattern 1: /folders/{id}
  let match = driveLink.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return match[1];
  }

  // Pattern 2: ?id={id}
  match = driveLink.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) {
    return match[1];
  }

  // Pattern 3: L'ID seul
  match = driveLink.match(/^([a-zA-Z0-9_-]{20,})$/);
  if (match) {
    return match[1];
  }

  return null;
}

/**
 * Liste les fichiers dans un dossier Google Drive et trouve le Google Doc
 */
async function findGoogleDocInFolder(
  folderId: string,
  config: GoogleSheetsConfig
): Promise<string | null> {
  try {
    const drive = await getDriveClient(config);

    // Lister les fichiers dans le dossier
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`,
      fields: 'files(id, name)',
    });

    const files = response.data.files || [];

    if (files.length === 0) {
      // Essayer de lister tous les fichiers pour voir ce qu'il y a dans le dossier
      const allFilesResponse = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType)',
        pageSize: 10,
      });
      
      const allFiles = allFilesResponse.data.files || [];
      if (allFiles.length > 0) {
        console.warn(`No Google Doc found in folder ${folderId}, but found ${allFiles.length} other files:`);
        allFiles.forEach((file: any) => {
          console.warn(`  - ${file.name} (${file.mimeType})`);
        });
      } else {
        console.warn(`No files found in folder ${folderId} - service account may not have access`);
      }
      return null;
    }

    if (files.length > 1) {
      console.warn(
        `Multiple Google Docs found in folder ${folderId}, using the first one: ${files[0].name}`
      );
    }

    console.log(`Found Google Doc: ${files[0].name} (${files[0].id})`);
    return files[0].id || null;
  } catch (error: any) {
    console.error(`Error finding Google Doc in folder ${folderId}:`, error.message);
    if (error.code === 403) {
      console.error(`  → Service account may not have access to this folder. Share the folder with: ${config.serviceAccountKeyPath ? 'the service account email' : 'service account'}`);
    }
    return null;
  }
}

/**
 * Extrait le contenu d'un Google Doc et trouve le code UUID dans "### Project (hidden field)"
 */
async function extractProjectCodeFromDoc(
  docId: string,
  config: GoogleSheetsConfig
): Promise<string | null> {
  try {
    const drive = await getDriveClient(config);

    // Exporter le document en texte brut
    const response = await drive.files.export(
      {
        fileId: docId,
        mimeType: 'text/plain',
      },
      { responseType: 'text' }
    );

    const content = response.data as string;

    // Chercher le pattern "### Project (hidden field)" suivi du code UUID
    // Format attendu: ### Project (hidden field)\n{f31279c6-afcc-407a-b36d-3949185b2f7b}
    const uuidPattern =
      /###\s*Project\s*\(hidden\s*field\)\s*\n?\s*([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;

    const match = content.match(uuidPattern);
    if (match && match[1]) {
      return match[1];
    }

    // Essayer un pattern plus flexible
    const flexiblePattern =
      /Project.*hidden.*field.*\n?\s*([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
    const flexibleMatch = content.match(flexiblePattern);
    if (flexibleMatch && flexibleMatch[1]) {
      return flexibleMatch[1];
    }

    // Chercher n'importe quel UUID dans le document (dernier recours)
    const anyUuidPattern =
      /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
    const anyMatch = content.match(anyUuidPattern);
    if (anyMatch && anyMatch[1]) {
      console.warn(
        `Found UUID in doc but not in "Project (hidden field)" format: ${anyMatch[1]}`
      );
      return anyMatch[1];
    }

    console.warn(`No UUID found in Google Doc ${docId}`);
    return null;
  } catch (error) {
    console.error(`Error extracting project code from doc ${docId}:`, error);
    return null;
  }
}

/**
 * Scrape le prix depuis la page Plum Living
 * Utilise Puppeteer pour gérer le JavaScript côté client
 */
async function fetchPriceFromPlumLiving(projectCode: string): Promise<number> {
  try {
    // Vérifier si puppeteer est disponible
    let puppeteer: any;
    try {
      puppeteer = await import('puppeteer');
    } catch (error) {
      console.error(
        'Puppeteer not installed. Install it with: npm install puppeteer'
      );
      return 0;
    }

    const url = `https://plum-living.com/fr/project/${projectCode}`;
    console.log(`Fetching price from: ${url}`);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Attendre que la page soit chargée
      await page.waitForTimeout(2000);

      // Chercher l'élément avec la classe spécifiée
      // Note: Les classes CSS dynamiques peuvent varier, on essaie plusieurs sélecteurs
      const altSelectors = [
        '.mantine-Text-root.css-lludu6.mantine-nzjykg',
        '.mantine-Text-root.mantine-nzjykg',
        '[class*="mantine-Text-root"][class*="mantine-nzjykg"]',
        '.mantine-nzjykg',
        '[class*="mantine-nzjykg"]',
      ];

      let priceElement = null;
      for (const selector of altSelectors) {
        priceElement = await page.$(selector);
        if (priceElement) {
          console.log(`Found price element using selector: ${selector}`);
          break;
        }
      }

      if (!priceElement) {
        // Si toujours rien, chercher tous les éléments avec "mantine-Text-root"
        const allTextElements = await page.$$('.mantine-Text-root');
        for (const element of allTextElements) {
          const text = await page.evaluate((el) => el.textContent, element);
          const price = parsePriceFromText(text || '');
          if (price > 0) {
            console.log(`Found price in text element: ${text}`);
            return price;
          }
        }

        // Dernier recours: chercher tous les éléments avec "mantine-nzjykg"
        const allNzjykgElements = await page.$$('[class*="mantine-nzjykg"]');
        for (const element of allNzjykgElements) {
          const text = await page.evaluate((el) => el.textContent, element);
          const price = parsePriceFromText(text || '');
          if (price > 0) {
            console.log(`Found price in nzjykg element: ${text}`);
            return price;
          }
        }

        console.warn(`Price element not found on page ${url}`);
        return 0;
      }

      const priceText = await page.evaluate(
        (el) => el.textContent,
        priceElement
      );
      const price = parsePriceFromText(priceText || '');

      if (price > 0) {
        console.log(`Found price: ${price} from text: ${priceText}`);
        return price;
      }

      console.warn(`Could not parse price from text: ${priceText}`);
      return 0;
    } finally {
      await browser.close();
    }
  } catch (error: any) {
    console.error(`Error fetching price from Plum Living for ${projectCode}:`, error.message);
    return 0;
  }
}

/**
 * Parse un prix depuis un texte
 * Supporte les formats: "€100", "100€", "100", "$100", etc.
 */
function parsePriceFromText(text: string): number {
  if (!text) return 0;

  // Retirer tous les caractères sauf chiffres, points et virgules
  const cleaned = text.replace(/[^\d.,]/g, '');
  
  // Remplacer la virgule par un point pour le parsing
  const normalized = cleaned.replace(',', '.');
  
  const price = parseFloat(normalized);
  return isNaN(price) ? 0 : price;
}

/**
 * Récupère le prix depuis un lien Google Drive
 * 
 * @param driveLink - Lien Google Drive (colonne L pour PP, colonne M pour clients)
 * @param type - Type de request ('PP' ou 'Client')
 * @param config - Configuration Google Sheets/Drive
 * @returns Prix du projet ou 0 si erreur
 */
export async function fetchPriceFromDriveLink(
  driveLink: string,
  type: 'PP' | 'Client',
  config: GoogleSheetsConfig
): Promise<number> {
  if (!driveLink || !driveLink.trim()) {
    console.warn(`Empty drive link for ${type} request`);
    return 0;
  }

  try {
    // 1. Extraire l'ID du dossier depuis le lien
    const folderId = extractFolderIdFromDriveLink(driveLink);
    if (!folderId) {
      console.warn(`Could not extract folder ID from drive link: ${driveLink}`);
      return 0;
    }

    // 2. Trouver le Google Doc dans le dossier
    const docId = await findGoogleDocInFolder(folderId, config);
    if (!docId) {
      console.warn(`No Google Doc found in folder ${folderId}`);
      return 0;
    }

    // 3. Extraire le code UUID depuis le document
    const projectCode = await extractProjectCodeFromDoc(docId, config);
    if (!projectCode) {
      console.warn(`Could not extract project code from doc ${docId}`);
      return 0;
    }

    // 4. Scraper le prix depuis Plum Living
    const price = await fetchPriceFromPlumLiving(projectCode);
    return price;
  } catch (error: any) {
    console.error(
      `Error fetching price from drive link ${driveLink}:`,
      error.message
    );
    return 0;
  }
}

/**
 * Récupère les prix pour plusieurs requests en parallèle (avec limite)
 * 
 * @param requests - Liste des requests avec ikpLink
 * @param config - Configuration Google Sheets/Drive
 * @param maxConcurrent - Nombre maximum de requêtes simultanées (défaut: 5)
 * @returns Map des IDs de requests vers leurs prix
 */
export async function fetchPricesForRequests(
  requests: Array<{ id: string; ikpLink: string; type: 'PP' | 'Client' }>,
  config: GoogleSheetsConfig,
  maxConcurrent: number = 5
): Promise<Map<string, number>> {
  const results = new Map<string, number>();

  // Filtrer les requests qui ont un ikpLink
  const requestsWithLinks = requests.filter((r) => r.ikpLink && r.ikpLink.trim());

  console.log(
    `Fetching prices for ${requestsWithLinks.length} requests (max ${maxConcurrent} concurrent)`
  );

  // Traiter par batch pour limiter la concurrence
  for (let i = 0; i < requestsWithLinks.length; i += maxConcurrent) {
    const batch = requestsWithLinks.slice(i, i + maxConcurrent);
    
    const batchPromises = batch.map(async (request) => {
      const price = await fetchPriceFromDriveLink(
        request.ikpLink,
        request.type,
        config
      );
      return { id: request.id, price };
    });

    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach(({ id, price }) => {
      results.set(id, price);
    });

    // Délai entre les batches pour éviter le rate limiting
    if (i + maxConcurrent < requestsWithLinks.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`Fetched prices for ${results.size} requests`);
  return results;
}

