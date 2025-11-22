/**
 * Script optimisé pour récupérer tous les thumbnails en parallèle
 * 
 * Usage: npx tsx scripts/fetch-all-thumbnails.ts [--workers=5] [--batch-size=100]
 */

import fs from 'fs';
import { join } from 'path';
import { Request } from '../lib/types';
import { fetchThumbnailFromPlumLiving } from '../lib/thumbnail-fetcher';
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
        console.log('  Logging in...');
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

async function fetchThumbnailsBatch(
  requests: Request[],
  browser: any,
  isLoggedIn: { value: boolean },
  startIndex: number,
  batchSize: number
): Promise<FetchResult[]> {
  const endIndex = Math.min(startIndex + batchSize, requests.length);
  const batch = requests.slice(startIndex, endIndex);
  
  const results: FetchResult[] = [];
  
  for (const request of batch) {
    if (!request.projectCode) {
      results.push({
        requestId: request.id,
        projectCode: '',
        thumbnail: null,
        success: false,
        error: 'No projectCode',
        duration: 0,
      });
      continue;
    }

    const startTime = Date.now();
    try {
      const thumbnail = await fetchThumbnailWithBrowser(
        request.projectCode,
        browser,
        isLoggedIn
      );
      
      const duration = (Date.now() - startTime) / 1000;
      
      results.push({
        requestId: request.id,
        projectCode: request.projectCode,
        thumbnail,
        success: !!thumbnail,
        duration,
      });
      
      if (thumbnail) {
        console.log(`  ✅ ${request.id}: ${thumbnail.substring(0, 80)}... (${duration.toFixed(1)}s)`);
      } else {
        console.log(`  ❌ ${request.id}: Thumbnail not found (${duration.toFixed(1)}s)`);
      }
    } catch (error: any) {
      const duration = (Date.now() - startTime) / 1000;
      results.push({
        requestId: request.id,
        projectCode: request.projectCode,
        thumbnail: null,
        success: false,
        error: error.message,
        duration,
      });
      console.log(`  ❌ ${request.id}: Error - ${error.message} (${duration.toFixed(1)}s)`);
    }
  }
  
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const workersArg = args.find(arg => arg.startsWith('--workers='));
  const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
  
  const workers = workersArg ? parseInt(workersArg.split('=')[1]) : 5;
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 100;

  console.log('🚀 Récupération des thumbnails en parallèle');
  console.log(`   Workers: ${workers}`);
  console.log(`   Batch size: ${batchSize}`);
  console.log('');

  const requests = getRequests();
  const requestsNeedingThumbnail = requests.filter(
    (r) => r.projectCode && 
           r.projectCode.trim() && 
           (!r.thumbnail || !r.thumbnail.includes('plumscannerfiles'))
  );

  console.log(`📊 ${requestsNeedingThumbnail.length} requêtes nécessitent un thumbnail`);
  console.log('');

  if (requestsNeedingThumbnail.length === 0) {
    console.log('✅ Toutes les requêtes ont déjà un thumbnail!');
    return;
  }

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
          
          return fetchThumbnailsBatch(
            chunk,
            browsers[workerIndex],
            isLoggedIn,
            0,
            chunk.length
          );
        })
      );
      
      const flatResults = batchResults.flat();
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
  const avgTime = allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length;

  console.log('\n📊 Résumé:');
  console.log(`   Total traité: ${allResults.length}`);
  console.log(`   ✅ Réussis: ${successful}`);
  console.log(`   ❌ Échoués: ${failed}`);
  console.log(`   ⏱️  Temps total: ${(totalTime / 60).toFixed(1)} minutes`);
  console.log(`   ⚡ Temps moyen par requête: ${avgTime.toFixed(1)}s`);
  console.log(`   📈 Débit: ${(allResults.length / totalTime * 60).toFixed(1)} requêtes/minute`);
}

main().catch(console.error);


