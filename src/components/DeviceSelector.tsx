import { Smartphone, Tablet, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useDevice } from '@/contexts/DeviceContext';

const DeviceSelector = () => {
  const { setDeviceType } = useDevice();

  const devices = [
    {
      type: 'phone' as const,
      icon: Smartphone,
      title: 'Telefono',
      description: 'Interfaccia ottimizzata per smartphone',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      type: 'tablet' as const,
      icon: Tablet,
      title: 'Tablet',
      description: 'Interfaccia ottimizzata per tablet',
      color: 'from-purple-500 to-pink-500'
    },
    {
      type: 'desktop' as const,
      icon: Monitor,
      title: 'Computer / Auto',
      description: 'Interfaccia ottimizzata per desktop e schermi auto',
      color: 'from-orange-500 to-red-500'
    }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/95 to-primary/5 p-4">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Benvenuto su Geo Tile Globe
          </h1>
          <p className="text-lg text-muted-foreground">
            Seleziona il tipo di dispositivo per un'esperienza ottimizzata
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {devices.map((device) => {
            const Icon = device.icon;
            return (
              <Card
                key={device.type}
                className="relative overflow-hidden group hover:shadow-2xl transition-all duration-300 cursor-pointer border-2 hover:border-primary/50"
                onClick={() => setDeviceType(device.type)}
              >
                <div className="p-8 space-y-6">
                  <div className={`w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br ${device.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="h-10 w-10 text-white" />
                  </div>
                  
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold">{device.title}</h2>
                    <p className="text-sm text-muted-foreground">{device.description}</p>
                  </div>

                  <Button 
                    className="w-full"
                    size="lg"
                  >
                    Seleziona
                  </Button>
                </div>

                <div className={`absolute inset-0 bg-gradient-to-br ${device.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
              </Card>
            );
          })}
        </div>

        <div className="text-center mt-8">
          <p className="text-xs text-muted-foreground">
            Puoi modificare questa impostazione in qualsiasi momento dalle impostazioni
          </p>
        </div>
      </div>
    </div>
  );
};

export default DeviceSelector;
