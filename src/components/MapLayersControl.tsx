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

  const buttonSize = deviceType === 'desktop' ? 'w-14 h-14' : deviceType === 'tablet' ? 'w-10 h-10' : 'w-9 h-9';

  return (
    <div className="relative">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        size="icon"
        className={`${buttonSize} bg-background/95 backdrop-blur-sm shadow-lg z-[1000]`}
        title="Gestisci layer"
      >
        <Layers className={deviceType === 'desktop' ? 'h-6 w-6' : deviceType === 'tablet' ? 'h-5 w-5' : 'h-4 w-4'} />
      </Button>

      {isOpen && (
        <Card className={`absolute top-full right-0 bg-background/95 backdrop-blur-sm shadow-xl z-[1001] ${
          deviceType === 'phone' ? 'mt-1 w-64 p-2' : 'mt-2 w-80 p-4'
        }`}>
          <div className={deviceType === 'phone' ? 'space-y-2' : 'space-y-4'}>
            <div className={`flex items-center justify-between border-b ${
              deviceType === 'phone' ? 'pb-1' : 'pb-2'
            }`}>
              <h3 className={`font-semibold flex items-center gap-2 ${
                deviceType === 'phone' ? 'text-xs' : ''
              }`}>
                <Layers className={deviceType === 'phone' ? 'h-4 w-4' : 'h-5 w-5'} />
                Layer Mappa
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className={deviceType === 'phone' ? 'h-5 w-5 p-0 text-xs' : 'h-6 w-6 p-0'}
              >
                ×
              </Button>
            </div>

            {layerItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className={`flex items-start rounded-lg hover:bg-accent/50 transition-colors ${
                  deviceType === 'phone' ? 'gap-2 p-1' : 'gap-3 p-2'
                }`}>
                  <div className={`rounded-lg bg-accent ${item.color} ${
                    deviceType === 'phone' ? 'p-1' : 'p-2'
                  }`}>
                    <Icon className={deviceType === 'phone' ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
                  </div>
                  <div className={deviceType === 'phone' ? 'flex-1 space-y-0' : 'flex-1 space-y-1'}>
                    <Label htmlFor={item.id} className={`font-medium cursor-pointer ${
                      deviceType === 'phone' ? 'text-xs' : ''
                    }`}>
                      {item.label}
                    </Label>
                    {deviceType !== 'phone' && (
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <Switch
                    id={item.id}
                    checked={layers[item.id]}
                    onCheckedChange={() => onLayerToggle(item.id)}
                    className={deviceType === 'phone' ? 'scale-75' : ''}
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
