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
 * 2. Par clientName + date (correspondance exacte)
 * 3. Par email + date (si disponible)
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

  // Créer un index des requests par clientName + date
  // Format: "NORMALIZED_NAME|YYYY-MM-DD" -> Request
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

    // Stratégie 2: Matching par clientName + date
    if (data.clientName && data.submitDate) {
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

    // Stratégie 3: Matching par email + date (si clientName non disponible)
    if (!data.clientName && data.email && data.submitDate) {
      // Extraire le nom depuis l'email (ex: "jean.dupont@gmail.com" -> "DUPONT")
      const emailParts = data.email.split('@')[0].split('.');
      const possibleNames = emailParts.map(part => part.toUpperCase());
      const normalizedDate = normalizeDateForComparison(data.submitDate);
      
      if (normalizedDate) {
        // Chercher dans les requests avec la même date
        for (const request of requests) {
          if (request.type === data.type) {
            const requestDate = normalizeDateForComparison(request.date);
            if (requestDate === normalizedDate) {
              const requestNameUpper = normalizeName(request.clientName);
              // Vérifier si une partie de l'email correspond au nom du client
              if (possibleNames.some(name => 
                requestNameUpper.includes(name) || 
                name.includes(requestNameUpper) ||
                requestNameUpper.includes(name.substring(0, 3)) // Correspondance partielle
              )) {
                matched.set(projectCode, request);
                return;
              }
            }
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
 * IMPORTANT: Cette fonction préserve les prix existants. Elle ne met à jour que:
 * - Les requests qui ont un projectCode ET qui sont dans projectData (avec un nouveau prix si disponible)
 * - Les requests qui sont dans le mapping (même sans projectCode préalable)
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
      // Mettre à jour le prix seulement si on en a un nouveau (price > 0)
      if (price !== undefined && price > 0) {
        updated = { ...updated, price };
        shouldUpdate = true;
      }
    }
    
    // Cas 2: Request est dans le mapping (nouveau matching) ET le projectCode est dans projectData
    // (c'est-à-dire qu'on vient de matcher cette request avec un projet et on a récupéré son prix)
    const projectCodeForRequest = Array.from(requestIdByProjectCode.entries())
      .find(([_, requestId]) => requestId === request.id)?.[0];
    
    if (projectCodeForRequest && projectData.has(projectCodeForRequest)) {
      const price = prices.get(projectCodeForRequest);
      if (price !== undefined && price > 0) {
        updated = { ...updated, price };
        shouldUpdate = true;
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

