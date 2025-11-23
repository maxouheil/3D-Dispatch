/**
 * Project Mapping Module
 * 
 * Fonctions pour mapper les codes projets du CSV Typeform vers les requests existantes
 */

import { Request } from './types';
import { ProjectData } from './typeform-csv-parser';

export interface MappingResult {
  matched: Map<string, Request>; // projectCode -> Request
  unmatched: string[]; // Liste des codes projets non trouvés
  stats: {
    totalProjects: number;
    matched: number;
    unmatched: number;
  };
}

/**
 * Normalise un nom pour la comparaison (uppercase, retirer accents, etc.)
 */
function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Retirer caractères spéciaux
    .replace(/\s+/g, ' '); // Normaliser les espaces
}

/**
 * Normalise une date au format ISO (YYYY-MM-DD) pour la comparaison
 */
function normalizeDateForComparison(dateStr: string): string {
  if (!dateStr) return '';
  
  // Si c'est déjà au format ISO, extraire juste la date
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
    // Ignorer les erreurs
  }
  
  return '';
}


/**
 * Fait le mapping entre les codes projets et les requests existantes
 * 
 * Stratégies de matching (dans l'ordre):
 * 1. Par projectCode (si déjà présent dans les requests)
 * 2. Par clientEmail + date (correspondance exacte) - STRATÉGIE PRINCIPALE
 * 3. Par clientName + date (correspondance exacte) - Fallback
 * 
 * @param requests - Liste des requests existantes
 * @param projectData - Map des codes projets depuis le CSV Typeform
 * @returns Résultat du mapping avec les requests correspondantes
 */
export function mapProjectsToRequests(
  requests: Request[],
  projectData: Map<string, ProjectData>
): MappingResult {
  const matched = new Map<string, Request>();
  const unmatched: string[] = [];
  
  // Créer un index des requests par projectCode (si disponible)
  const requestsByProjectCode = new Map<string, Request>();
  requests.forEach(req => {
    if (req.projectCode) {
      requestsByProjectCode.set(req.projectCode, req);
    }
  });

  // Créer un index des requests par clientEmail + date (STRATÉGIE PRINCIPALE)
  // Format: "EMAIL|YYYY-MM-DD" -> Request[]
  const requestsByEmailAndDate = new Map<string, Request[]>();
  requests.forEach(req => {
    if (req.clientEmail) {
      const normalizedEmail = req.clientEmail.toLowerCase().trim();
      const normalizedDate = normalizeDateForComparison(req.date);
      if (normalizedEmail && normalizedDate) {
        const key = `${normalizedEmail}|${normalizedDate}`;
        if (!requestsByEmailAndDate.has(key)) {
          requestsByEmailAndDate.set(key, []);
        }
        requestsByEmailAndDate.get(key)!.push(req);
      }
    }
  });

  // Créer un index des requests par clientName + date (Fallback)
  // Format: "NORMALIZED_NAME|YYYY-MM-DD" -> Request[]
  const requestsByNameAndDate = new Map<string, Request[]>();
  requests.forEach(req => {
    const normalizedName = normalizeName(req.clientName);
    const normalizedDate = normalizeDateForComparison(req.date);
    if (normalizedName && normalizedDate) {
      const key = `${normalizedName}|${normalizedDate}`;
      if (!requestsByNameAndDate.has(key)) {
        requestsByNameAndDate.set(key, []);
      }
      requestsByNameAndDate.get(key)!.push(req);
    }
  });

  // Parcourir tous les codes projets
  projectData.forEach((data, projectCode) => {
    // Stratégie 1: Matching par projectCode
    if (requestsByProjectCode.has(projectCode)) {
      matched.set(projectCode, requestsByProjectCode.get(projectCode)!);
      return;
    }

    // Stratégie 2: Matching par clientEmail + date (STRATÉGIE PRINCIPALE)
    // CORRESPONDANCE EXACTE REQUISE - pas de tolérance
    if (data.clientEmail && data.submitDate) {
      const normalizedEmail = data.clientEmail.toLowerCase().trim();
      const normalizedDate = normalizeDateForComparison(data.submitDate);
      
      if (normalizedEmail && normalizedDate) {
        const exactKey = `${normalizedEmail}|${normalizedDate}`;
        const exactMatches = requestsByEmailAndDate.get(exactKey);
        
        if (exactMatches && exactMatches.length > 0) {
          // Filtrer par type si plusieurs correspondances
          const filtered = exactMatches.filter(req => req.type === data.type);
          if (filtered.length > 0) {
            // Prendre la première correspondance (ou la plus récente si plusieurs)
            const bestMatch = filtered.sort((a, b) => 
              new Date(b.date).getTime() - new Date(a.date).getTime()
            )[0];
            matched.set(projectCode, bestMatch);
            return;
          } else if (exactMatches.length === 1) {
            // Si une seule correspondance même si le type ne correspond pas exactement
            matched.set(projectCode, exactMatches[0]);
            return;
          }
        }
      }
    }

    // Stratégie 3: Matching par clientName + date (Fallback si pas d'email)
    if (!data.clientEmail && data.clientName && data.submitDate) {
      const normalizedName = normalizeName(data.clientName);
      const normalizedDate = normalizeDateForComparison(data.submitDate);
      
      if (normalizedName && normalizedDate) {
        const key = `${normalizedName}|${normalizedDate}`;
        const matchingRequests = requestsByNameAndDate.get(key);
        
        if (matchingRequests && matchingRequests.length > 0) {
          // Filtrer par type si plusieurs correspondances
          const filtered = matchingRequests.filter(req => req.type === data.type);
          if (filtered.length > 0) {
            // Prendre la première correspondance (ou la plus récente si plusieurs)
            const bestMatch = filtered.sort((a, b) => 
              new Date(b.date).getTime() - new Date(a.date).getTime()
            )[0];
            matched.set(projectCode, bestMatch);
            return;
          } else if (matchingRequests.length === 1) {
            // Si une seule correspondance même si le type ne correspond pas exactement
            matched.set(projectCode, matchingRequests[0]);
            return;
          }
        }
      }
    }
    
    // Si aucune correspondance trouvée, ajouter à unmatched
    unmatched.push(projectCode);
  });

  return {
    matched,
    unmatched,
    stats: {
      totalProjects: projectData.size,
      matched: matched.size,
      unmatched: unmatched.length,
    },
  };
}

/**
 * Met à jour les requests avec les codes projets et les prix
 * 
 * IMPORTANT: Cette fonction préserve les prix existants. Elle met à jour:
 * - Les requests qui ont un projectCode ET qui sont dans projectData (avec un nouveau prix si disponible)
 * - Les requests qui sont dans le mapping (même sans projectCode préalable) - ASSIGNE LE PRIX ET LE PROJECTCODE
 * 
 * Les requests qui ne sont pas dans projectData (projets filtrés par date par exemple)
 * conservent leurs prix existants.
 * 
 * @param requests - Liste des requests à mettre à jour
 * @param projectData - Map des codes projets depuis le CSV Typeform (peut être filtré par date)
 * @param prices - Map des codes projets vers leurs prix (depuis fetchPricesFromTypeformCSV)
 * @param mapping - Mapping optionnel entre projectCode et Request (pour les nouveaux matchings)
 * @returns Liste des requests mises à jour
 */
export function updateRequestsWithProjectData(
  requests: Request[],
  projectData: Map<string, ProjectData>,
  prices: Map<string, number>,
  mapping?: Map<string, Request>
): Request[] {
  // Créer un index des requests par ID
  const requestsById = new Map<string, Request>();
  requests.forEach(req => {
    requestsById.set(req.id, req);
  });

  // Créer un index inversé: projectCode -> Request ID (depuis le mapping)
  const requestIdByProjectCode = new Map<string, string>();
  if (mapping) {
    mapping.forEach((request, projectCode) => {
      requestIdByProjectCode.set(projectCode, request.id);
    });
  }

  // Mettre à jour les requests
  const updatedRequests = requests.map(request => {
    let updated = { ...request };
    let shouldUpdate = false;

    // Cas 1: Request a déjà un projectCode ET ce projectCode est dans projectData
    // (c'est-à-dire qu'on a récupéré un nouveau prix pour ce projet)
    if (request.projectCode && projectData.has(request.projectCode)) {
      const price = prices.get(request.projectCode);
      // Mettre à jour le prix si:
      // - On a un prix > 0 (prix valide récupéré)
      // - OU le prix actuel est 20€ (valeur suspecte par défaut) et on a tenté de récupérer (même si 0)
      if (price !== undefined) {
        if (price > 0 || (request.price === 20 && price === 0)) {
          updated = { ...updated, price };
          shouldUpdate = true;
        }
      }
    }
    
    // Cas 2: Request est dans le mapping (nouveau matching) ET le projectCode est dans projectData
    // (c'est-à-dire qu'on vient de matcher cette request avec un projet et on a récupéré son prix)
    // IMPORTANT: On assigne à la fois le prix ET le projectCode
    const projectCodeForRequest = Array.from(requestIdByProjectCode.entries())
      .find(([_, requestId]) => requestId === request.id)?.[0];
    
    if (projectCodeForRequest && projectData.has(projectCodeForRequest)) {
      const price = prices.get(projectCodeForRequest);
      if (price !== undefined) {
        // Mettre à jour si prix > 0 OU si prix actuel est 20€ (valeur suspecte)
        if (price > 0 || request.price === 20) {
          updated = { 
            ...updated, 
            price,
            projectCode: projectCodeForRequest // Assigner aussi le projectCode
          };
          shouldUpdate = true;
        }
      }
    }

    // Si aucune mise à jour nécessaire, retourner la request originale (préserve les prix existants)
    return shouldUpdate ? updated : request;
  });

  return updatedRequests;
}

/**
 * Assigne les codes projets aux requests en fonction du mapping
 * 
 * @param requests - Liste des requests
 * @param mapping - Résultat du mapping (projectCode -> Request)
 * @returns Liste des requests avec projectCode assigné
 */
export function assignProjectCodesToRequests(
  requests: Request[],
  mapping: Map<string, Request>
): Request[] {
  // Créer un index des requests par ID
  const requestsById = new Map<string, Request>();
  requests.forEach(req => {
    requestsById.set(req.id, req);
  });

  // Créer un index inversé: Request ID -> projectCode
  const projectCodeByRequestId = new Map<string, string>();
  mapping.forEach((request, projectCode) => {
    projectCodeByRequestId.set(request.id, projectCode);
  });

  // Mettre à jour les requests avec les projectCodes
  return requests.map(request => {
    const projectCode = projectCodeByRequestId.get(request.id);
    if (projectCode) {
      return {
        ...request,
        projectCode,
      };
    }
    return request;
  });
}

