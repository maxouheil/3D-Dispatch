/**
 * Script d'estimation du temps de récupération des thumbnails
 */

import fs from 'fs';
import { join } from 'path';
import { Request } from '../lib/types';

const requestsPath = join(process.cwd(), 'data', 'requests.json');

function getRequests(): Request[] {
  try {
    const fileContents = fs.readFileSync(requestsPath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    return [];
  }
}

function estimateTime() {
  const requests = getRequests();
  
  // Filtrer les requêtes qui ont un projectCode
  const requestsWithProjectCode = requests.filter(
    (r) => r.projectCode && r.projectCode.trim()
  );
  
  // Filtrer celles qui n'ont pas déjà un thumbnail Plum Scanner
  const requestsNeedingThumbnail = requestsWithProjectCode.filter(
    (r) => !r.thumbnail || !r.thumbnail.includes('plumscannerfiles')
  );

  const totalRequests = requests.length;
  const withProjectCode = requestsWithProjectCode.length;
  const needingThumbnail = requestsNeedingThumbnail.length;

  console.log('📊 Analyse des requêtes:');
  console.log(`   Total: ${totalRequests}`);
  console.log(`   Avec projectCode: ${withProjectCode}`);
  console.log(`   Nécessitant un thumbnail: ${needingThumbnail}`);
  console.log('');

  if (needingThumbnail === 0) {
    console.log('✅ Toutes les requêtes ont déjà un thumbnail!');
    return;
  }

  // Estimation du temps par requête
  // Scraping avec Puppeteer:
  // - Lancement navigateur (une seule fois): 2-3s
  // - Navigation vers page: 3-5s
  // - Login (une seule fois): 3-5s
  // - Attente chargement: 3s
  // - Extraction thumbnail: 1s
  // - Fermeture: 0.5s
  // Total par requête (séquentiel): ~10-15s

  const timePerRequestSeconds = 12; // Moyenne conservatrice
  const timePerRequestMinutes = timePerRequestSeconds / 60;

  // Scénario 1: Séquentiel (1 requête à la fois)
  const sequentialTotalSeconds = needingThumbnail * timePerRequestSeconds;
  const sequentialTotalMinutes = sequentialTotalSeconds / 60;
  const sequentialTotalHours = sequentialTotalMinutes / 60;

  // Scénario 2: Parallélisation avec 5 workers (5 requêtes en parallèle)
  const parallelWorkers = 5;
  const parallelTotalSeconds = Math.ceil(needingThumbnail / parallelWorkers) * timePerRequestSeconds;
  const parallelTotalMinutes = parallelTotalSeconds / 60;
  const parallelTotalHours = parallelTotalMinutes / 60;

  // Scénario 3: Parallélisation avec 10 workers
  const parallelWorkers10 = 10;
  const parallelTotalSeconds10 = Math.ceil(needingThumbnail / parallelWorkers10) * timePerRequestSeconds;
  const parallelTotalMinutes10 = parallelTotalSeconds10 / 60;
  const parallelTotalHours10 = parallelTotalMinutes10 / 60;

  // Scénario 4: Optimisé (réutilisation navigateur + parallélisation)
  // Réutilisation du navigateur économise ~2-3s par requête
  const optimizedTimePerRequest = 9; // 12s - 3s économisés
  const optimizedWorkers = 5;
  const optimizedTotalSeconds = Math.ceil(needingThumbnail / optimizedWorkers) * optimizedTimePerRequest;
  const optimizedTotalMinutes = optimizedTotalSeconds / 60;
  const optimizedTotalHours = optimizedTotalMinutes / 60;

  console.log('⏱️  Estimation du temps de récupération:');
  console.log('');
  console.log('📌 Scénario 1: Séquentiel (1 requête à la fois)');
  console.log(`   Temps: ${sequentialTotalHours.toFixed(2)} heures (${sequentialTotalMinutes.toFixed(0)} minutes)`);
  console.log(`   Temps par requête: ~${timePerRequestSeconds}s`);
  console.log('');
  console.log('📌 Scénario 2: Parallélisation (5 workers)');
  console.log(`   Temps: ${parallelTotalHours.toFixed(2)} heures (${parallelTotalMinutes.toFixed(0)} minutes)`);
  console.log(`   Gain: ${((sequentialTotalHours - parallelTotalHours) / sequentialTotalHours * 100).toFixed(0)}% plus rapide`);
  console.log('');
  console.log('📌 Scénario 3: Parallélisation (10 workers)');
  console.log(`   Temps: ${parallelTotalHours10.toFixed(2)} heures (${parallelTotalMinutes10.toFixed(0)} minutes)`);
  console.log(`   Gain: ${((sequentialTotalHours - parallelTotalHours10) / sequentialTotalHours * 100).toFixed(0)}% plus rapide`);
  console.log('');
  console.log('📌 Scénario 4: Optimisé (réutilisation navigateur + 5 workers)');
  console.log(`   Temps: ${optimizedTotalHours.toFixed(2)} heures (${optimizedTotalMinutes.toFixed(0)} minutes)`);
  console.log(`   Gain: ${((sequentialTotalHours - optimizedTotalHours) / sequentialTotalHours * 100).toFixed(0)}% plus rapide`);
  console.log('');

  // Estimation avec gestion d'erreurs (10% d'échec)
  const failureRate = 0.1;
  const retriesPerFailure = 1;
  const adjustedNeedingThumbnail = Math.ceil(needingThumbnail * (1 + failureRate * retriesPerFailure));
  const adjustedSequentialSeconds = adjustedNeedingThumbnail * timePerRequestSeconds;
  const adjustedSequentialHours = adjustedSequentialSeconds / 3600;

  console.log('⚠️  Estimation avec gestion d\'erreurs (10% d\'échec, 1 retry):');
  console.log(`   Requêtes à traiter: ${adjustedNeedingThumbnail}`);
  console.log(`   Temps estimé (séquentiel): ${adjustedSequentialHours.toFixed(2)} heures`);
  console.log('');

  // Recommandations
  console.log('💡 Recommandations:');
  console.log('   1. Utiliser la parallélisation (5-10 workers)');
  console.log('   2. Réutiliser le navigateur Puppeteer entre requêtes');
  console.log('   3. Faire le login une seule fois au début');
  console.log('   4. Traiter par batch (ex: 100 requêtes à la fois)');
  console.log('   5. Sauvegarder progressivement (toutes les 50 requêtes)');
  console.log('   6. Ajouter un système de retry pour les échecs');
  console.log('   7. Utiliser un rate limiting pour éviter de surcharger le serveur');
  console.log('');

  // Exemple de temps pour différentes quantités
  console.log('📈 Exemples pour différentes quantités:');
  const examples = [100, 500, 1000, 2000, 3724];
  examples.forEach((count) => {
    const hours = (count * timePerRequestSeconds) / 3600;
    const hoursParallel5 = (Math.ceil(count / 5) * timePerRequestSeconds) / 3600;
    const hoursOptimized = (Math.ceil(count / 5) * optimizedTimePerRequest) / 3600;
    console.log(`   ${count} requêtes:`);
    console.log(`     - Séquentiel: ${hours.toFixed(2)}h`);
    console.log(`     - Parallèle (5): ${hoursParallel5.toFixed(2)}h`);
    console.log(`     - Optimisé (5): ${hoursOptimized.toFixed(2)}h`);
  });
}

estimateTime();


