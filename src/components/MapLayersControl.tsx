import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Layers, Globe, Clock, Cloud, Users, Navigation2 } from 'lucide-react';

interface MapLayersControlProps {
  deviceType: 'phone' | 'tablet' | 'desktop' | null;
  layers: {
    borders: boolean;
    timezones: boolean;
    weather: boolean;
    traffic: boolean;
  };
  onLayerToggle: (layer: keyof MapLayersControlProps['layers']) => void;
}

const MapLayersControl = ({ deviceType, layers, onLayerToggle }: MapLayersControlProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const layerItems = [
    {
      id: 'borders' as const,
      label: 'Confini Politici',
      icon: Globe,
      description: 'Mostra i confini nazionali e regionali',
      color: 'text-blue-500'
    },
    {
      id: 'timezones' as const,
      label: 'Fusi Orari',
      icon: Clock,
      description: 'Visualizza i fusi orari mondiali',
      color: 'text-purple-500'
    },
    {
      id: 'weather' as const,
      label: 'Meteo',
      icon: Cloud,
      description: 'Temperatura e precipitazioni',
      color: 'text-cyan-500'
    },
    {
      id: 'traffic' as const,
      label: 'Traffico',
      icon: Navigation2,
      description: 'Densità del traffico stradale',
      color: 'text-orange-500'
    }
  ];

  const buttonSize = deviceType === 'desktop' ? 'w-14 h-14' : 'w-10 h-10';

  return (
    <div className="relative">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        size="icon"
        className={`${buttonSize} bg-background/95 backdrop-blur-sm shadow-lg z-[1000]`}
        title="Gestisci layer"
      >
        <Layers className={deviceType === 'desktop' ? 'h-6 w-6' : 'h-5 w-5'} />
      </Button>

      {isOpen && (
        <Card className="absolute top-full mt-2 right-0 w-80 p-4 bg-background/95 backdrop-blur-sm shadow-xl z-[1001]">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Layer Mappa
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>

            {layerItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className={`p-2 rounded-lg bg-accent ${item.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={item.id} className="font-medium cursor-pointer">
                      {item.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <Switch
                    id={item.id}
                    checked={layers[item.id]}
                    onCheckedChange={() => onLayerToggle(item.id)}
                  />
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

export default MapLayersControl;
