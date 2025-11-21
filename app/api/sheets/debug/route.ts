import { NextRequest, NextResponse } from 'next/server';

/**
 * Route de débogage pour voir la structure réelle des onglets
 * GET /api/sheets/debug?sheet=FOLLOW UP PP
 */
export async function GET(request: NextRequest) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'GOOGLE_SHEETS_ID not configured' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const sheetName = searchParams.get('sheet') || 'FOLLOW UP PP';

    // Importer la fonction de lecture
    const googleSheets = await import('@/lib/google-sheets-impl');
    
    const config: any = {
      spreadsheetId,
    };

    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      config.serviceAccountKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
      config.serviceAccountKeyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
    } else {
      return NextResponse.json({ error: 'Credentials not configured' }, { status: 500 });
    }

    // Lister toutes les feuilles
    const sheets = await googleSheets.listSheets(config);
    
    // Trouver la feuille demandée
    const targetSheet = sheets.find(s => 
      s.title.toLowerCase().includes(sheetName.toLowerCase())
    );

    if (!targetSheet) {
      return NextResponse.json({
        error: `Sheet "${sheetName}" not found`,
        availableSheets: sheets.map(s => s.title),
      }, { status: 404 });
    }

    // Lire les données
    const rows = await googleSheets.readGoogleSheet(
      spreadsheetId,
      targetSheet.title,
      'A1:Z3000', // Lire jusqu'à 3000 lignes pour voir toutes les données
      config
    );

    // Extraire les headers et quelques lignes de données
    const headers = rows[0] || [];
    const sampleRows = rows.slice(1, 6); // 5 premières lignes de données

    return NextResponse.json({
      sheetName: targetSheet.title,
      headers: headers.map((h, i) => ({ column: String.fromCharCode(65 + i), name: h, index: i })),
      sampleRows: sampleRows.map((row, i) => ({
        rowNumber: i + 2,
        data: row.map((cell, j) => ({
          column: String.fromCharCode(65 + j),
          header: headers[j] || '',
          value: cell,
        })),
      })),
      totalRows: rows.length,
    });
  } catch (error: any) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to debug',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

