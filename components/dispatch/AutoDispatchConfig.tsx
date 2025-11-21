'use client';

import { useState } from 'react';
import { DispatchConfig, defaultDispatchConfig } from '@/lib/dispatch-algorithm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AutoDispatchConfigProps {
  onDispatch?: () => void;
}

export function AutoDispatchConfig({ onDispatch }: AutoDispatchConfigProps) {
  const [config, setConfig] = useState<DispatchConfig>(defaultDispatchConfig);

  const handleConfigChange = (key: keyof DispatchConfig, value: number) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleAutoDispatch = async () => {
    try {
      // This would call an API endpoint to perform auto dispatch
      // For now, we'll just trigger a refresh
      if (onDispatch) {
        onDispatch();
      }
    } catch (error) {
      console.error('Error performing auto dispatch:', error);
    }
  };

  const totalWeight = config.backlogWeight + config.performanceWeight + config.targetWeight;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuration Dispatch Automatique</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Poids Backlog ({config.backlogWeight.toFixed(2)})
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={config.backlogWeight}
            onChange={(e) =>
              handleConfigChange('backlogWeight', parseFloat(e.target.value))
            }
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">
            Plus élevé = priorise les artistes avec moins de backlog
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Poids Performance ({config.performanceWeight.toFixed(2)})
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={config.performanceWeight}
            onChange={(e) =>
              handleConfigChange('performanceWeight', parseFloat(e.target.value))
            }
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">
            Plus élevé = priorise les artistes avec meilleure performance
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Poids Target/Week ({config.targetWeight.toFixed(2)})
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={config.targetWeight}
            onChange={(e) =>
              handleConfigChange('targetWeight', parseFloat(e.target.value))
            }
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">
            Plus élevé = priorise les artistes avec plus de capacité
          </p>
        </div>

        <div className="pt-4 border-t">
          <p className="text-sm text-gray-600 mb-2">
            Total des poids: {totalWeight.toFixed(2)}
            {totalWeight !== 1 && (
              <span className="text-orange-600 ml-2">
                (Recommandé: 1.00)
              </span>
            )}
          </p>
          <Button onClick={handleAutoDispatch} className="w-full">
            Exécuter Dispatch Automatique
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

