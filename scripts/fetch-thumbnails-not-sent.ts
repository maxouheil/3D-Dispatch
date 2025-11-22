/**
 * Script pour récupérer les thumbnails IKP uniquement pour les requêtes
 * qui ne sont pas "sent to client"
 * 
 * Usage: npx tsx scripts/fetch-thumbnails-not-sent.ts [--workers=5] [--batch-size=50]
 */

import fs from 'fs';
import { join } from 'path';
import { Request } from '../lib/types';
import { isSentStatus } from '../lib/utils';
import { loginToPlumLiving } from '../lib/price-fetcher';
import puppeteer from 'puppeteer';

const requestsPath = join(process.cwd(), 'data', 'requests.json');

function getRequests(): Request[] {
  try {
    const fileContents = fs.readFileSync(requestsPath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    return [];
  }
}

function saveRequests(requests: Request[]): void {
  try {
    fs.writeFileSync(requestsPath, JSON.stringify(requests, null, 2));
  } catch (error) {
    console.error('Error saving requests:', error);
  }
}

interface FetchResult {
  requestId: string;
  projectCode: string;
  thumbnail: string | null;
  success: boolean;
  error?: string;
  duration: number;
}

/**
 * Cherche un projet dans Plum Living/Plum Scanner par nom + date
 * Retourne le projectCode trouvé ou null
 */
async function findProjectCodeByNameAndDate(
  clientName: string,
  date: string,
  browser: any,
  isLoggedIn: { value: boolean }
): Promise<string | null> {
  const page = await browser.newPage();
  
  try {
    // Aller sur la page de recherche ou liste des projets
    // Note: Il faudra adapter selon l'interface de Plum Scanner
    const searchUrl = 'https://plum-living.com/fr/projects'; // À adapter selon l'URL réelle
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Vérifier si on est redirigé vers la page de connexion
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      if (!isLoggedIn.value) {
        console.log('  🔐 Logging in...');
        const loginSuccess = await loginToPlumLiving(page);
        if (!loginSuccess) {
          return null;
        }
        isLoggedIn.value = true;
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      } else {
        return null;
      }
    }

    await page.waitForTimeout(2000);

    // Chercher dans la liste des projets
    // Cette partie devra être adaptée selon la structure réelle de la page
    const projectCode = await page.evaluate((name: string, dateStr: string) => {
      // Chercher les liens vers les projets qui correspondent au nom et à la date
      const links = Array.from(document.querySelectorAll('a[href*="/project/"]'));
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const projectCodeMatch = href.match(/\/project\/([a-f0-9-]+)/);
        if (projectCodeMatch) {
          // Vérifier si le nom et la date correspondent (à adapter selon la structure)
          const linkText = link.textContent || '';
          if (linkText.includes(name)) {
            return projectCodeMatch[1];
          }
        }
      }
      return null;
    }, clientName, date);

    return projectCode;
  } catch (error) {
    console.error(`Error finding project for ${clientName}:`, error);
    return null;
  } finally {
    await page.close();
  }
}

async function fetchThumbnailWithBrowser(
  projectCode: string,
  browser: any,
  isLoggedIn: { value: boolean }
): Promise<string | null> {
  const page = await browser.newPage();
  
  try {
    const url = `https://plum-living.com/fr/project/${projectCode}`;
    
    // Intercepter les requêtes réseau AVANT la navigation
    const thumbnailUrls: string[] = [];
    page.on('response', (response: any) => {
      const url = response.url();
      if (url.includes('plumscannerfiles.blob.core.windows.net') && 
          url.includes('thumbnail')) {
        thumbnailUrls.push(url);
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Vérifier si on est redirigé vers la page de connexion
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      if (!isLoggedIn.value) {
        console.log('  🔐 Logging in...');
        const loginSuccess = await loginToPlumLiving(page);
        if (!loginSuccess) {
          return null;
        }
        isLoggedIn.value = true;
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      } else {
        return null; // Échec de connexion
      }
    }

    await page.waitForTimeout(2000);

    // Vérifier les URLs interceptées
    if (thumbnailUrls.length > 0) {
      return thumbnailUrls[0];
    }

    // Chercher dans le DOM
    const thumbnailUrl = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      for (const img of images) {
        const src = img.src || img.getAttribute('src') || '';
        if (src.includes('plumscannerfiles.blob.core.windows.net') && 
            src.includes('thumbnail')) {
          return src;
        }
      }
      return null;
    });

    return thumbnailUrl;
  } finally {
    await page.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const workersArg = args.find(arg => arg.startsWith('--workers='));
  const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
  
  const workers = workersArg ? parseInt(workersArg.split('=')[1]) : 3;
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 50;

  console.log('🚀 Récupération des thumbnails IKP pour les requêtes non "sent to client"');
  console.log(`   Workers: ${workers}`);
  console.log(`   Batch size: ${batchSize}`);
  console.log('');

  const requests = getRequests();
  
  /**
   * Extrait le projectCode depuis le lien IKP
   * Format: https://kitchen.planner.ikea.com/fr/fr/planner/{UUID}/
   */
  function extractProjectCodeFromIkpLink(ikpLink: string): string | null {
    if (!ikpLink || !ikpLink.trim()) {
      return null;
    }
    
    // Pattern pour IKEA Kitchen Planner
    const ikeaPattern = /kitchen\.planner\.ikea\.com\/[^\/]+\/[^\/]+\/planner\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
    const ikeaMatch = ikpLink.match(ikeaPattern);
    if (ikeaMatch && ikeaMatch[1]) {
      return ikeaMatch[1];
    }
    
    // Pattern pour liens Google Drive (on ne peut pas extraire directement)
    // Mais on peut essayer de chercher un UUID dans le lien
    const uuidPattern = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
    const uuidMatch = ikpLink.match(uuidPattern);
    if (uuidMatch && uuidMatch[1]) {
      return uuidMatch[1];
    }
    
    return null;
  }

  // Filtrer les requêtes:
  // 1. Qui ne sont pas "sent to client"
  // 2. Qui ont un ikpLink (pour extraire le projectCode)
  // 3. Qui n'ont pas déjà un thumbnail Plum Scanner
  const requestsNeedingThumbnail = requests
    .filter((r) => {
      // Pas "sent to client"
      if (isSentStatus(r.status)) {
        return false;
      }
      
      // A un ikpLink
      if (!r.ikpLink || !r.ikpLink.trim()) {
        return false;
      }
      
      // N'a pas déjà un thumbnail Plum Scanner
      if (r.thumbnail && r.thumbnail.includes('plumscannerfiles')) {
        return false;
      }
      
      return true;
    })
    .map((r) => {
      // Extraire le projectCode depuis le ikpLink
      const projectCode = extractProjectCodeFromIkpLink(r.ikpLink) || r.projectCode;
      return { ...r, extractedProjectCode: projectCode };
    })
    .filter((r) => r.extractedProjectCode && r.extractedProjectCode.trim());

  console.log(`📊 Analyse:`);
  console.log(`   Total requests: ${requests.length}`);
  console.log(`   "Sent to client": ${requests.filter(r => isSentStatus(r.status)).length}`);
  console.log(`   Non "sent to client": ${requests.filter(r => !isSentStatus(r.status)).length}`);
  console.log(`   Avec ikpLink (non sent): ${requests.filter(r => !isSentStatus(r.status) && r.ikpLink && r.ikpLink.trim()).length}`);
  console.log(`   Nécessitant un thumbnail: ${requestsNeedingThumbnail.length}`);
  console.log('');

  if (requestsNeedingThumbnail.length === 0) {
    console.log('✅ Toutes les requêtes non "sent to client" ont déjà un thumbnail!');
    return;
  }

  // Estimation du temps
  const timePerRequest = 12; // secondes
  const estimatedMinutes = Math.ceil((requestsNeedingThumbnail.length / workers) * timePerRequest / 60);
  console.log(`⏱️  Temps estimé: ~${estimatedMinutes} minutes`);
  console.log('');

  // Créer un navigateur partagé pour chaque worker
  const browsers = await Promise.all(
    Array(workers).fill(0).map(() =>
      puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
    )
  );

  const isLoggedIn = { value: false };
  const allResults: FetchResult[] = [];
  const startTime = Date.now();

  try {
    // Traiter par batch
    for (let i = 0; i < requestsNeedingThumbnail.length; i += batchSize) {
      const batchStart = i;
      const batchEnd = Math.min(i + batchSize, requestsNeedingThumbnail.length);
      
      console.log(`\n📦 Batch ${Math.floor(i / batchSize) + 1}: Requêtes ${batchStart + 1}-${batchEnd}`);
      
      // Diviser le batch entre les workers
      const batch = requestsNeedingThumbnail.slice(batchStart, batchEnd);
      const chunkSize = Math.ceil(batch.length / workers);
      
      const batchResults = await Promise.all(
        Array(workers).fill(0).map((_, workerIndex) => {
          const chunkStart = workerIndex * chunkSize;
          const chunkEnd = Math.min(chunkStart + chunkSize, batch.length);
          const chunk = batch.slice(chunkStart, chunkEnd);
          
          if (chunk.length === 0) {
            return Promise.resolve([]);
          }
          
          return Promise.all(
            chunk.map(async (request: any) => {
              let projectCode = request.extractedProjectCode || request.projectCode;
              
              // Si pas de projectCode, essayer de le trouver par nom + date
              if (!projectCode) {
                console.log(`  🔍 Recherche projectCode pour ${request.clientName} (${request.date})...`);
                projectCode = await findProjectCodeByNameAndDate(
                  request.clientName,
                  request.date,
                  browsers[workerIndex],
                  isLoggedIn
                );
                
                if (!projectCode) {
                  return {
                    requestId: request.id,
                    projectCode: '',
                    thumbnail: null,
                    success: false,
                    error: 'No projectCode found (neither in ikpLink nor by name+date)',
                    duration: 0,
                  };
                }
                console.log(`  ✅ ProjectCode trouvé: ${projectCode}`);
              }

              const startTime = Date.now();
              try {
                const thumbnail = await fetchThumbnailWithBrowser(
                  projectCode,
                  browsers[workerIndex],
                  isLoggedIn
                );
                
                const duration = (Date.now() - startTime) / 1000;
                
                const result = {
                  requestId: request.id,
                  projectCode: projectCode,
                  thumbnail,
                  success: !!thumbnail,
                  duration,
                };
                
                if (thumbnail) {
                  console.log(`  ✅ ${request.id}: ${thumbnail.substring(0, 80)}... (${duration.toFixed(1)}s)`);
                } else {
                  console.log(`  ❌ ${request.id}: Thumbnail not found (${duration.toFixed(1)}s)`);
                }
                
                return result;
              } catch (error: any) {
                const duration = (Date.now() - startTime) / 1000;
                const result = {
                  requestId: request.id,
                  projectCode: projectCode,
                  thumbnail: null,
                  success: false,
                  error: error.message,
                  duration,
                };
                console.log(`  ❌ ${request.id}: Error - ${error.message} (${duration.toFixed(1)}s)`);
                return result;
              }
            })
          );
        })
      );
      
      const flatResults = batchResults.flat().flat();
      allResults.push(...flatResults);
      
      // Mettre à jour les requests avec les thumbnails trouvés
      const requestsMap = new Map(requests.map(r => [r.id, r]));
      let updated = 0;
      
      for (const result of flatResults) {
        if (result.success && result.thumbnail) {
          const request = requestsMap.get(result.requestId);
          if (request) {
            request.thumbnail = result.thumbnail;
            updated++;
          }
        }
      }
      
      // Sauvegarder progressivement
      if (updated > 0) {
        saveRequests(requests);
        console.log(`   💾 ${updated} thumbnails sauvegardés`);
      }
    }
  } finally {
    // Fermer tous les navigateurs
    await Promise.all(browsers.map(b => b.close()));
  }

  const totalTime = (Date.now() - startTime) / 1000;
  const successful = allResults.filter(r => r.success).length;
  const failed = allResults.filter(r => !r.success).length;
  const avgTime = allResults.length > 0 
    ? allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length 
    : 0;

  console.log('\n📊 Résumé:');
  console.log(`   Total traité: ${allResults.length}`);
  console.log(`   ✅ Réussis: ${successful}`);
  console.log(`   ❌ Échoués: ${failed}`);
  console.log(`   ⏱️  Temps total: ${(totalTime / 60).toFixed(1)} minutes`);
  if (avgTime > 0) {
    console.log(`   ⚡ Temps moyen par requête: ${avgTime.toFixed(1)}s`);
    console.log(`   📈 Débit: ${(allResults.length / totalTime * 60).toFixed(1)} requêtes/minute`);
  }
}

main().catch(console.error);

