'use client';

import { useState } from 'react';
import { Link2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CSVMatching() {
  const [matching, setMatching] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    stats?: {
      total?: number;
      matched?: number;
      alreadyHadProjectCode?: number;
      noEmailOrDate?: number;
      notFound?: number;
      requestsProcessed?: number;
      pricesFetched?: number;
    };
    results?: Array<{
      requestId: string;
      number: number;
      clientName: string;
      projectCode: string;
      price: number;
      success: boolean;
      error?: string;
    }>;
    debugLogs?: string[];
    error?: string;
  } | null>(null);

  const handleMatch = async () => {
    setMatching(true);
    setResult(null);

    try {
      const response = await fetch('/api/requests/match-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: data.message || 'Matching réussi',
          stats: data.stats,
          debugLogs: data.debugLogs,
        });
      } else {
        setResult({
          success: false,
          message: 'Erreur de matching',
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
      setMatching(false);
    }
  };


  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Matching CSV Typeform
          </h3>
          <p className="text-sm text-gray-600">
            Match les projets entre Google Sheets et les CSV Typeform (par email + date)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleMatch}
            disabled={matching}
            className="flex items-center gap-2"
          >
            <Link2
              className={`h-4 w-4 ${matching ? 'animate-spin' : ''}`}
            />
            {matching ? 'Matching...' : 'Matcher les projets'}
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
            {result.success && result.stats && (
              <div className="text-sm text-green-700 mt-2 space-y-1">
                {(result.stats as any).total !== undefined ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="font-semibold">Total:</span> {result.stats.total} requêtes
                    </div>
                    <div>
                      <span className="font-semibold">Matchés:</span>{' '}
                      <span className="text-green-600">{result.stats.matched}</span> nouveaux
                    </div>
                    <div>
                      <span className="font-semibold">Déjà avec projectCode:</span>{' '}
                      {result.stats.alreadyHadProjectCode}
                    </div>
                    <div>
                      <span className="font-semibold">Sans email/date:</span>{' '}
                      {result.stats.noEmailOrDate}
                    </div>
                    <div className="col-span-2">
                      <span className="font-semibold">Non trouvés:</span>{' '}
                      {result.stats.notFound}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="font-semibold">Requêtes traitées:</span>{' '}
                      {(result.stats as any).requestsProcessed || 0}
                    </div>
                    <div>
                      <span className="font-semibold">Prix récupérés:</span>{' '}
                      <span className="text-green-600">
                        {(result.stats as any).pricesFetched || 0}
                      </span>
                    </div>
                  </div>
                )}
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  Rafraîchir la page
                </Button>
                {result.debugLogs && result.debugLogs.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-gray-900">
                      📋 Voir les logs de debug ({result.debugLogs.length} lignes)
                    </summary>
                    <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200 max-h-96 overflow-y-auto">
                      <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap">
                        {result.debugLogs.join('\n')}
                      </pre>
                    </div>
                  </details>
                )}
                {result.results && result.results.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-green-200">
                    <p className="font-semibold mb-2">Détails par projet:</p>
                    <div className="space-y-2">
                      {result.results.map((r, idx) => (
                        <div
                          key={r.requestId}
                          className={`p-2 rounded text-xs ${
                            r.success
                              ? 'bg-green-100 border border-green-300'
                              : 'bg-yellow-50 border border-yellow-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">
                              #{r.number} - {r.clientName}
                            </span>
                            {r.success ? (
                              <span className="text-green-700 font-bold">
                                {r.price.toLocaleString('fr-FR')} €
                              </span>
                            ) : (
                              <span className="text-yellow-700">
                                {r.error || 'Échec'}
                              </span>
                            )}
                          </div>
                          {r.projectCode && (
                            <div className="text-gray-600 mt-1 font-mono text-xs">
                              {r.projectCode.substring(0, 40)}...
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
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

