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
 * Se connecte à Plum Living avec les credentials fournis
 */
export async function loginToPlumLiving(page: any): Promise<boolean> {
  try {
    const loginUrl = 'https://plum-living.com/fr/login';
    await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Attendre que le formulaire de connexion soit chargé
    await page.waitForTimeout(2000);

    // Remplir le formulaire de connexion
    const email = process.env.PLUM_LIVING_EMAIL || 'souheil@plum-living.com';
    const password = process.env.PLUM_LIVING_PASSWORD || 'Lbooycz7';

    // Trouver et remplir le champ email (essayer plusieurs sélecteurs)
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[id*="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="Email" i]',
    ];

    let emailFilled = false;
    for (const selector of emailSelectors) {
      try {
        const emailInput = await page.$(selector);
        if (emailInput) {
          await emailInput.click({ clickCount: 3 }); // Sélectionner tout le texte existant
          await emailInput.type(email, { delay: 100 });
          emailFilled = true;
          console.log(`Filled email using selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue avec le prochain sélecteur
      }
    }

    if (!emailFilled) {
      console.warn('Could not find email input field');
      return false;
    }

    // Trouver et remplir le champ password
    await page.waitForTimeout(500);
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[id*="password"]',
      'input[placeholder*="password" i]',
      'input[placeholder*="Password" i]',
      'input[placeholder*="mot de passe" i]',
    ];

    let passwordFilled = false;
    for (const selector of passwordSelectors) {
      try {
        const passwordInput = await page.$(selector);
        if (passwordInput) {
          await passwordInput.click({ clickCount: 3 });
          await passwordInput.type(password, { delay: 100 });
          passwordFilled = true;
          console.log(`Filled password using selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue avec le prochain sélecteur
      }
    }

    if (!passwordFilled) {
      console.warn('Could not find password input field');
      return false;
    }

    // Attendre un peu avant de cliquer
    await page.waitForTimeout(1000);

    // Cliquer sur le bouton de connexion
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Se connecter")',
      'button:has-text("Connexion")',
      'button:has-text("Login")',
      'form button',
      'button[class*="submit"]',
    ];

    let buttonClicked = false;
    for (const selector of submitSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          buttonClicked = true;
          console.log(`Clicked submit button using selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue avec le prochain sélecteur
      }
    }

    if (!buttonClicked) {
      // Essayer d'appuyer sur Enter comme dernier recours
      console.log('Trying Enter key as fallback');
      await page.keyboard.press('Enter');
    }

    // Attendre la redirection après connexion
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {
      // Si pas de navigation immédiate, attendre un peu
      console.log('Waiting for navigation...');
    });

    await page.waitForTimeout(2000);

    // Vérifier si la connexion a réussi (on ne devrait plus être sur /login)
    const currentUrl = page.url();
    console.log(`After login, current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/login')) {
      // Vérifier s'il y a un message d'erreur
      const errorText = await page.evaluate(() => {
        const body = document.body.textContent || '';
        return body.includes('erreur') || body.includes('error') || body.includes('incorrect');
      });
      
      if (errorText) {
        console.warn('Login failed: error message detected on page');
        return false;
      }
      
      console.warn('Still on login page, but no error detected. May need more time.');
      // Attendre encore un peu
      await page.waitForTimeout(3000);
      const finalUrl = page.url();
      if (finalUrl.includes('/login')) {
        return false;
      }
    }

    console.log('Successfully logged in to Plum Living');
    return true;
  } catch (error: any) {
    console.error(`Error logging in to Plum Living: ${error.message}`);
    return false;
  }
}

/**
 * Scrape le prix depuis la page Plum Living
 * Utilise Puppeteer pour gérer le JavaScript côté client
 * Se connecte automatiquement si nécessaire
 */
export async function fetchPriceFromPlumLiving(projectCode: string): Promise<number> {
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
      
      // Essayer d'accéder directement à la page du projet
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Vérifier si on est redirigé vers la page de connexion
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        console.log('Redirected to login page, attempting to log in...');
        const loginSuccess = await loginToPlumLiving(page);
        if (!loginSuccess) {
          console.warn('Failed to log in, cannot fetch price');
          return 0;
        }
        // Après connexion, retourner à la page du projet
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      }

      // Vérifier si on est sur la bonne page (pas une page de connexion ou d'erreur)
      const pageTitle = await page.title();
      const pageUrl = page.url();
      console.log(`Page title: ${pageTitle}, URL: ${pageUrl}`);
      
      // Vérifier si la page contient des indicateurs qu'on est sur une page de projet
      const pageContent = await page.evaluate(() => document.body.textContent || '');
      if (pageContent.includes('Se connecter') && !pageContent.includes('Articles Plum Living') && !pageContent.includes('Articles Ikea')) {
        console.warn(`Page appears to be a login/error page, not a project page`);
        // Prendre un screenshot pour debug
        await page.screenshot({ path: `/tmp/plum-living-login-${projectCode}.png` }).catch(() => {});
        return 0;
      }

      // Attendre que la page soit chargée et que les éléments dynamiques soient rendus
      await page.waitForTimeout(4000);

      // D'après le screenshot, le prix total est dans un conteneur avec mantine-Stack-root
      // Chercher d'abord dans ce conteneur spécifique
      let price = 0;
      let priceText = '';

      // Stratégie 1: Chercher le prix total dans la section de résumé
      // D'après le screenshot, le prix total "5 938 €" est dans un élément avec mantine-nzjykg
      // C'est généralement le plus grand nombre formaté avec espaces dans la section de résumé
      const priceSummarySelectors = [
        '[class*="mantine-nzjykg"]', // Classe spécifique du prix total d'après le screenshot
      ];

      const allPotentialPrices: Array<{ text: string; price: number; element: any }> = [];

      for (const selector of priceSummarySelectors) {
        try {
          const elements = await page.$$(selector);
          console.log(`  Found ${elements.length} elements with selector: ${selector}`);
          
          for (const element of elements) {
            const text = await page.evaluate((el) => el.textContent?.trim(), element);
            if (text && text.includes('€')) {
              // Le prix total devrait être formaté avec des espaces comme séparateurs de milliers (ex: "5 938 €")
              const parsedPrice = parsePriceFromText(text);
              if (parsedPrice > 1000 && parsedPrice < 1000000) {
                // Vérifier si c'est bien formaté avec espaces (indicateur de prix total)
                // Le prix total a généralement le format "X XXX €" ou "X XXX€"
                const hasSpaceFormat = text.match(/\d+\s+\d{3}\s*€/);
                allPotentialPrices.push({ text, price: parsedPrice, element });
                console.log(`  Found potential price: ${parsedPrice} from "${text}" (has space format: ${!!hasSpaceFormat})`);
              }
            }
          }
        } catch (e) {
          // Continue avec le prochain sélecteur
        }
      }

      // Trier par prix décroissant et prendre le plus élevé (probablement le total)
      if (allPotentialPrices.length > 0) {
        allPotentialPrices.sort((a, b) => b.price - a.price);
        // Le prix total est généralement le plus grand nombre
        const totalPrice = allPotentialPrices[0];
        console.log(`Found total price: ${totalPrice.price} from "${totalPrice.text}"`);
        return totalPrice.price;
      }

      // Stratégie 2: Chercher dans le conteneur Stack et trouver le plus grand nombre raisonnable
      const stackContainers = await page.$$('[class*="mantine-Stack-root"]');
      console.log(`Found ${stackContainers.length} Stack containers`);
      
      const allPrices: Array<{ text: string; price: number }> = [];
      
      for (const container of stackContainers) {
        // Chercher tous les éléments texte dans ce conteneur
        const allTextElements = await container.$$('[class*="mantine-Text-root"]');
        
        for (const textEl of allTextElements) {
          const text = await page.evaluate((el) => el.textContent?.trim(), textEl);
          if (text && text.includes('€')) {
            const parsedPrice = parsePriceFromText(text);
            // Filtrer les prix raisonnables (entre 1000 et 1000000)
            if (parsedPrice > 1000 && parsedPrice < 1000000) {
              allPrices.push({ text, price: parsedPrice });
            }
          }
        }
      }

      // Trier par prix décroissant et prendre le plus élevé (probablement le total)
      if (allPrices.length > 0) {
        allPrices.sort((a, b) => b.price - a.price);
        const bestMatch = allPrices[0];
        console.log(`Found total price from Stack container: ${bestMatch.price} from "${bestMatch.text.substring(0, 50)}"`);
        return bestMatch.price;
      }

      if (price > 0) {
        console.log(`Found price in Stack container: ${price} from text: "${priceText}"`);
        return price;
      }

      // Stratégie 2: Chercher directement les éléments avec mantine-nzjykg (classe du prix total)
      const altSelectors = [
        '[class*="mantine-nzjykg"]',
        '.mantine-Text-root[class*="mantine-nzjykg"]',
        '[class*="mantine-Text-root"][class*="mantine-nzjykg"]',
      ];

      for (const selector of altSelectors) {
        try {
          const elements = await page.$$(selector);
          console.log(`Found ${elements.length} elements with selector: ${selector}`);
          
          for (const element of elements) {
            const text = await page.evaluate((el) => el.textContent, element);
            const parsedPrice = parsePriceFromText(text || '');
            // Le prix total devrait être le plus grand nombre trouvé (généralement > 1000)
            if (parsedPrice > price && parsedPrice > 1000) {
              price = parsedPrice;
              priceText = text || '';
              console.log(`Found price with selector ${selector}: ${price} from text: "${text}"`);
            }
          }
        } catch (e) {
          // Continue avec le prochain sélecteur
        }
      }

      if (price > 0) {
        return price;
      }

      // Stratégie 3: Chercher tous les éléments avec mantine-Text-root contenant "€" et trouver le plus grand nombre raisonnable
      const allTextElements = await page.$$('[class*="mantine-Text-root"]');
      console.log(`Found ${allTextElements.length} elements with mantine-Text-root class`);
      
      const textPrices: Array<{ text: string; price: number }> = [];
      
      for (const element of allTextElements) {
        const text = await page.evaluate((el) => el.textContent?.trim(), element);
        if (text && text.includes('€')) {
          const parsedPrice = parsePriceFromText(text);
          // Filtrer les prix raisonnables (entre 1000 et 1000000)
          if (parsedPrice > 1000 && parsedPrice < 1000000) {
            textPrices.push({ text, price: parsedPrice });
          }
        }
      }

      if (textPrices.length > 0) {
        // Trier par prix décroissant et prendre le plus élevé (probablement le total)
        textPrices.sort((a, b) => b.price - a.price);
        const bestMatch = textPrices[0];
        console.log(`Found total price in text element: ${bestMatch.price} from text: "${bestMatch.text.substring(0, 50)}"`);
        return bestMatch.price;
      }

      console.warn(`Price element not found on page ${url}`);
      // Prendre un screenshot pour debug
      await page.screenshot({ path: `/tmp/plum-living-debug-${projectCode}.png` }).catch(() => {});
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
 * Supporte les formats: "€100", "100€", "100", "$100", "5 938 €", etc.
 */
function parsePriceFromText(text: string): number {
  if (!text) return 0;

  // Retirer tous les caractères sauf chiffres, points, virgules et espaces
  // Les prix peuvent avoir des espaces comme séparateurs de milliers (ex: "5 938 €")
  const cleaned = text.replace(/[^\d.,\s]/g, '');
  
  // Retirer les espaces (séparateurs de milliers)
  const withoutSpaces = cleaned.replace(/\s/g, '');
  
  // Remplacer la virgule par un point pour le parsing (si c'est un séparateur décimal)
  // Note: En français, la virgule est le séparateur décimal, mais ici on assume que c'est un point
  // Si le nombre a une virgule et un point, garder le point comme séparateur décimal
  let normalized = withoutSpaces;
  if (withoutSpaces.includes(',') && !withoutSpaces.includes('.')) {
    // Seulement une virgule, probablement un séparateur décimal
    normalized = withoutSpaces.replace(',', '.');
  } else if (withoutSpaces.includes(',') && withoutSpaces.includes('.')) {
    // Les deux présents, retirer la virgule (probablement séparateur de milliers)
    normalized = withoutSpaces.replace(/,/g, '');
  }
  
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

/**
 * Récupère les prix depuis les codes projets du CSV Typeform
 * 
 * @param projectCodes - Map des codes projets vers leurs données (depuis parseTypeformCSV)
 * @param maxConcurrent - Nombre maximum de requêtes simultanées (défaut: 5)
 * @param useExistingPrices - Si true, utilise les prix existants du CSV comme fallback (défaut: false)
 * @returns Map des codes projets vers leurs prix
 */
export async function fetchPricesFromTypeformCSV(
  projectCodes: Map<string, { type: 'PP' | 'Client'; price?: number; email?: string }>,
  maxConcurrent: number = 5,
  useExistingPrices: boolean = false
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  const projectCodesArray = Array.from(projectCodes.entries());

  console.log(
    `Fetching prices for ${projectCodesArray.length} project codes (max ${maxConcurrent} concurrent)`
  );

  // Traiter par batch pour limiter la concurrence
  for (let i = 0; i < projectCodesArray.length; i += maxConcurrent) {
    const batch = projectCodesArray.slice(i, i + maxConcurrent);
    
    const batchPromises = batch.map(async ([projectCode, data]) => {
      // Si useExistingPrices est true et qu'on a déjà un prix, l'utiliser
      if (useExistingPrices && data.price !== undefined && data.price > 0) {
        console.log(`Using existing price ${data.price} for project ${projectCode}`);
        return { projectCode, price: data.price };
      }

      // Sinon, scraper depuis Plum Living
      const price = await fetchPriceFromPlumLiving(projectCode);
      return { projectCode, price };
    });

    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach(({ projectCode, price }) => {
      if (price > 0) {
        results.set(projectCode, price);
      }
    });

    // Délai entre les batches pour éviter le rate limiting
    if (i + maxConcurrent < projectCodesArray.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const successCount = Array.from(results.values()).filter(p => p > 0).length;
  console.log(`Fetched prices for ${successCount} out of ${projectCodesArray.length} project codes`);
  return results;
}

