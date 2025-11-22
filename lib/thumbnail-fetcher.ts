/**
 * Thumbnail Fetcher Module
 * 
 * Récupère les thumbnails des projets IKP depuis Plum Living/Plum Scanner
 * 
 * Les thumbnails sont stockés sur Azure Blob Storage avec le pattern:
 * https://plumscannerfiles.blob.core.windows.net/qstransfer/{date}-{projectCode}-thumbnail.jpeg
 * 
 * Exemple:
 * https://plumscannerfiles.blob.core.windows.net/qstransfer/2025-07-31T08%3A27%3A10-4996EBE2-98E6-4D03-A777-9EC4BDBB1C26-thumbnail.jpeg
 */

/**
 * Extrait l'URL du thumbnail depuis la page Plum Living
 * @param projectCode - Code UUID du projet (ex: 4996EBE2-98E6-4D03-A777-9EC4BDBB1C26)
 * @returns URL du thumbnail ou null si non trouvé
 */
export async function fetchThumbnailFromPlumLiving(projectCode: string): Promise<string | null> {
  try {
    // Vérifier si puppeteer est disponible
    let puppeteer: any;
    try {
      puppeteer = await import('puppeteer');
    } catch (error) {
      console.error(
        'Puppeteer not installed. Install it with: npm install puppeteer'
      );
      return null;
    }

    const url = `https://plum-living.com/fr/project/${projectCode}`;
    console.log(`Fetching thumbnail from: ${url}`);

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
        const { loginToPlumLiving } = await import('./price-fetcher');
        const loginSuccess = await loginToPlumLiving(page);
        if (!loginSuccess) {
          console.warn('Failed to log in, cannot fetch thumbnail');
          return null;
        }
        // Après connexion, retourner à la page du projet
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      }

      // Attendre que la page soit chargée
      await page.waitForTimeout(3000);

      // Intercepter les requêtes réseau pour trouver les URLs de thumbnails
      const thumbnailUrls: string[] = [];
      
      page.on('response', (response: any) => {
        const url = response.url();
        if (url.includes('plumscannerfiles.blob.core.windows.net') && 
            url.includes('thumbnail')) {
          thumbnailUrls.push(url);
        }
      });

      // Chercher les images thumbnail dans la page
      // Les thumbnails peuvent être dans:
      // 1. Des balises <img> avec src contenant "plumscannerfiles.blob.core.windows.net"
      // 2. Des balises <img> avec src contenant "thumbnail"
      // 3. Des éléments avec background-image contenant ces URLs
      // 4. Dans les requêtes réseau interceptées
      
      const thumbnailUrl = await page.evaluate((projectCode) => {
        // Chercher toutes les images
        const images = Array.from(document.querySelectorAll('img'));
        
        // Chercher d'abord les images avec plumscannerfiles
        for (const img of images) {
          const src = img.src || img.getAttribute('src') || '';
          if (src.includes('plumscannerfiles.blob.core.windows.net') && 
              src.includes('thumbnail')) {
            return src;
          }
        }

        // Chercher dans les styles background-image
        const allElements = Array.from(document.querySelectorAll('*'));
        for (const el of allElements) {
          const style = window.getComputedStyle(el);
          const bgImage = style.backgroundImage;
          if (bgImage && bgImage.includes('plumscannerfiles.blob.core.windows.net') &&
              bgImage.includes('thumbnail')) {
            // Extraire l'URL du background-image
            const match = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
            if (match && match[1]) {
              return match[1];
            }
          }
        }

        // Chercher dans les données JSON ou les attributs data-*
        for (const el of allElements) {
          for (const attr of el.attributes) {
            if (attr.value && 
                attr.value.includes('plumscannerfiles.blob.core.windows.net') &&
                attr.value.includes('thumbnail')) {
              // Essayer d'extraire l'URL
              const urlMatch = attr.value.match(/https?:\/\/[^\s"']+thumbnail[^\s"']*/);
              if (urlMatch && urlMatch[0]) {
                return urlMatch[0];
              }
            }
          }
        }

        // Chercher dans le HTML source pour des URLs
        const htmlContent = document.documentElement.outerHTML;
        const urlPattern = /https?:\/\/plumscannerfiles\.blob\.core\.windows\.net\/[^\s"']*thumbnail[^\s"']*\.(jpg|jpeg|png)/gi;
        const matches = htmlContent.match(urlPattern);
        if (matches && matches.length > 0) {
          return matches[0];
        }

        return null;
      }, projectCode);

      // Attendre un peu pour que les requêtes réseau se chargent
      await page.waitForTimeout(2000);

      // Vérifier les URLs interceptées depuis les requêtes réseau
      if (thumbnailUrls.length > 0) {
        console.log(`Found thumbnail URL from network: ${thumbnailUrls[0]}`);
        return thumbnailUrls[0];
      }

      if (thumbnailUrl) {
        console.log(`Found thumbnail URL: ${thumbnailUrl}`);
        return thumbnailUrl;
      }

      // Si pas trouvé, essayer de construire l'URL selon le pattern connu
      // Pattern: https://plumscannerfiles.blob.core.windows.net/qstransfer/{date}-{projectCode}-thumbnail.jpeg
      console.log('Thumbnail not found in DOM or network, trying to construct URL...');
      
      // On ne peut pas vérifier si l'URL construite existe sans faire une requête HTTP
      // Mais on peut retourner l'URL construite et laisser l'appelant vérifier
      return null;
    } finally {
      await browser.close();
    }
  } catch (error: any) {
    console.error(`Error fetching thumbnail from Plum Living for ${projectCode}:`, error.message);
    return null;
  }
}

/**
 * Construit l'URL du thumbnail selon le pattern connu
 * @param projectCode - Code UUID du projet
 * @param date - Date optionnelle (format ISO: 2025-07-31T08:27:10)
 * @returns URL construite du thumbnail
 */
export function buildThumbnailUrl(projectCode: string, date?: string): string {
  const baseUrl = 'https://plumscannerfiles.blob.core.windows.net/qstransfer/';
  
  // Si pas de date fournie, utiliser la date actuelle
  const dateStr = date || new Date().toISOString().replace(/:/g, '%3A').split('.')[0];
  
  // Encoder la date pour l'URL (les : deviennent %3A)
  const encodedDate = dateStr.replace(/:/g, '%3A');
  
  return `${baseUrl}${encodedDate}-${projectCode}-thumbnail.jpeg`;
}

/**
 * Récupère le thumbnail depuis Plum Scanner en essayant plusieurs méthodes
 * @param projectCode - Code UUID du projet
 * @returns URL du thumbnail ou null
 */
export async function fetchThumbnail(projectCode: string): Promise<string | null> {
  // Méthode 1: Scraper depuis la page Plum Living
  const thumbnailFromPage = await fetchThumbnailFromPlumLiving(projectCode);
  if (thumbnailFromPage) {
    return thumbnailFromPage;
  }

  // Méthode 2: Construire l'URL selon le pattern (avec date actuelle)
  // Note: Cette méthode peut ne pas fonctionner si la date est incorrecte
  // Mais on peut essayer avec différentes dates récentes
  const possibleDates = [
    new Date().toISOString().replace(/:/g, '%3A').split('.')[0],
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().replace(/:/g, '%3A').split('.')[0], // Hier
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().replace(/:/g, '%3A').split('.')[0], // Il y a 7 jours
  ];

  // On ne peut pas vérifier si l'URL existe sans faire une requête HTTP
  // Donc on retourne null pour l'instant
  // L'utilisateur devra utiliser fetchThumbnailFromPlumLiving pour obtenir l'URL réelle
  
  return null;
}

