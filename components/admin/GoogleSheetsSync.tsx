'use client';

import { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function GoogleSheetsSync() {
  const [syncing, setSyncing] = useState(false);
  const [fetchPrices, setFetchPrices] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    requests?: number;
    artists?: number;
    ppRequests?: number;
    clientRequests?: number;
    pricesFetched?: number;
    pricesTotal?: number;
    debug?: any;
    error?: string;
  } | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);

    try {
      const response = await fetch('/api/sheets/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fetchPrices }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: data.message || 'Synchronisation réussie',
          requests: data.requests,
          artists: data.artists,
          ppRequests: data.ppRequests,
          clientRequests: data.clientRequests,
          pricesFetched: data.pricesFetched,
          pricesTotal: data.pricesTotal,
          debug: data.debug,
        });
        
        // Afficher les infos de debug dans la console
        if (data.debug) {
          console.log('🔍 Debug Info:', data.debug);
        }
        
        // Ne plus recharger automatiquement - l'utilisateur peut le faire manuellement
      } else {
        setResult({
          success: false,
          message: 'Erreur de synchronisation',
          error: data.error || 'Erreur inconnue',
        });
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: 'Erreur de connexion',
        error: error.message || 'Impossible de se connecter au serveur',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Synchronisation Google Sheets
          </h3>
          <p className="text-sm text-gray-600">
            Synchronise les données depuis votre Google Spreadsheet
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={fetchPrices}
              onChange={(e) => setFetchPrices(e.target.checked)}
              disabled={syncing}
              className="rounded border-gray-300"
            />
            <span>Récupérer les prix</span>
          </label>
          <Button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`}
            />
            {syncing ? 'Synchronisation...' : 'Synchroniser'}
          </Button>
        </div>
      </div>

      {result && (
        <div
          className={`mt-4 p-3 rounded-lg flex items-start gap-3 ${
            result.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {result.success ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p
              className={`font-medium ${
                result.success ? 'text-green-900' : 'text-red-900'
              }`}
            >
              {result.message}
            </p>
            {result.success && (
              <div className="text-sm text-green-700 mt-1 space-y-1">
                <div className="flex items-center justify-between">
                  <p>
                    {result.requests} requêtes ({result.ppRequests} PP, {result.clientRequests} Client) et {result.artists} artistes synchronisés
                    {result.pricesFetched !== undefined && (
                      <span className="ml-2">
                        • {result.pricesFetched}/{result.pricesTotal} prix récupérés
                      </span>
                    )}
                  </p>
                  <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                    size="sm"
                    className="ml-2"
                  >
                    Rafraîchir la page
                  </Button>
                </div>
                {result.debug && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                      🔍 Informations de debug (cliquez pour développer)
                    </summary>
                    <div className="mt-2 space-y-2">
                      <div className="p-2 bg-gray-100 rounded">
                        <p className="font-semibold mb-1">Onglets trouvés:</p>
                        <p>PP: {result.debug.ppSheetFound || 'Non trouvé'}</p>
                        <p>Client: {result.debug.clientSheetFound || 'Non trouvé'}</p>
                      </div>
                      {result.debug.ppRowsRead && (
                        <div className="p-2 bg-blue-50 rounded">
                          <p className="font-semibold mb-1">PP:</p>
                          <p>Lignes lues: {result.debug.ppRowsRead}</p>
                          <p>Requêtes parsées: {result.debug.ppRequestsParsed}</p>
                        </div>
                      )}
                      {result.debug.clientRowsRead !== undefined && (
                        <div className="p-2 bg-green-50 rounded">
                          <p className="font-semibold mb-1">Client:</p>
                          <p>Lignes lues: {result.debug.clientRowsRead}</p>
                          <p>Requêtes parsées: {result.debug.clientRequestsParsed}</p>
                          <p>Lignes ignorées: {result.debug.clientRowsSkipped || 0}</p>
                          {result.debug.clientFirstRow && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-gray-600">Voir structure des données</summary>
                              <div className="mt-1 text-xs">
                                <p>Header: {JSON.stringify(result.debug.clientFirstRow)}</p>
                                {result.debug.clientSecondRow && (
                                  <p>Row 2: {JSON.stringify(result.debug.clientSecondRow)}</p>
                                )}
                                {result.debug.clientThirdRow && (
                                  <p>Row 3: {JSON.stringify(result.debug.clientThirdRow)}</p>
                                )}
                              </div>
                            </details>
                          )}
                        </div>
                      )}
                      <details className="mt-2">
                        <summary className="cursor-pointer text-gray-600">Voir toutes les données de debug (JSON)</summary>
                        <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-60">
                          {JSON.stringify(result.debug, null, 2)}
                        </pre>
                      </details>
                    </div>
                  </details>
                )}
              </div>
            )}
            {result.error && (
              <p className="text-sm text-red-700 mt-1 font-mono text-xs">
                {result.error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

