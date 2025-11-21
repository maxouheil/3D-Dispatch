import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Request, Artist } from '@/lib/types';

const requestsPath = path.join(process.cwd(), 'data', 'requests.json');
const artistsPath = path.join(process.cwd(), 'data', 'artists.json');

/**
 * Route API pour synchroniser les données depuis Google Sheets
 * 
 * POST /api/sheets/sync - Synchronise les données depuis Google Sheets
 * GET /api/sheets/sync - Vérifie la configuration
 * 
 * Configuration requise:
 * - GOOGLE_SHEETS_ID dans .env.local
 * - GOOGLE_SERVICE_ACCOUNT_KEY dans .env.local (chemin vers le fichier JSON)
 *   OU GOOGLE_SERVICE_ACCOUNT_KEY_JSON (contenu JSON directement)
 * 
 * Usage:
 *   fetch('/api/sheets/sync', { method: 'POST' })
 */

async function syncFromGoogleSheets(fetchPrices: boolean = false) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_ID not configured');
  }

  // Essayer d'importer googleapis (peut ne pas être installé)
  let syncFunction;
  try {
    const googleSheets = await import('@/lib/google-sheets-impl');
    syncFunction = googleSheets.syncFromGoogleSheets;
  } catch (error) {
    // Si googleapis n'est pas installé, utiliser une version de fallback
    throw new Error(
      'googleapis package not installed. Run: npm install googleapis'
    );
  }

  const config: any = {
    spreadsheetId,
  };

  // Support pour chemin de fichier ou JSON direct
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    config.serviceAccountKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
    config.serviceAccountKeyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
  } else {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY_JSON must be configured'
    );
  }

  const { requests, artists, debug } = await syncFunction(config, fetchPrices);

  // Sauvegarder les données
  fs.writeFileSync(requestsPath, JSON.stringify(requests, null, 2));
  fs.writeFileSync(artistsPath, JSON.stringify(artists, null, 2));

  return { requests, artists, debug };
}

export async function POST(request: NextRequest) {
  try {
    // Vérifier si fetchPrices est demandé dans le body
    const body = await request.json().catch(() => ({}));
    const fetchPrices = body.fetchPrices === true;

    const { requests, artists, debug } = await syncFromGoogleSheets(fetchPrices);

    return NextResponse.json({
      success: true,
      message: 'Data synchronized successfully',
      requests: requests.length,
      artists: artists.length,
      ppRequests: requests.filter((r: Request) => r.type === 'PP').length,
      clientRequests: requests.filter((r: Request) => r.type === 'Client').length,
      pricesFetched: debug?.pricesFetched || 0,
      pricesTotal: debug?.pricesTotal || 0,
      debug: debug || {},
    });
  } catch (error: any) {
    console.error('Error syncing from Google Sheets:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to sync from Google Sheets',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Use POST method to sync data from Google Sheets',
    config: {
      spreadsheetId: process.env.GOOGLE_SHEETS_ID ? 'Configured' : 'Not configured',
      serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? 'Configured' : 'Not configured',
    },
  });
}

