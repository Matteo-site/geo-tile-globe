import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Key, ExternalLink } from 'lucide-react';

interface ApiKeyInputProps {
  onApiKeySubmit: (key: string) => void;
}

const ApiKeyInput = ({ onApiKeySubmit }: ApiKeyInputProps) => {
  const [apiKey, setApiKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      onApiKeySubmit(apiKey.trim());
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/5 p-6">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Key className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Mapbox Access Token</CardTitle>
              <CardDescription>Inserisci il tuo token API per iniziare</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="pk.eyJ1..."
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Il token verrà salvato solo nella tua sessione locale
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={!apiKey.trim()}>
              Avvia Mappa
            </Button>
          </form>
          
          <div className="pt-4 border-t space-y-3">
            <p className="text-sm font-medium">Come ottenere il token:</p>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Crea un account su Mapbox</li>
              <li>Vai alla sezione Tokens</li>
              <li>Copia il token pubblico (default public token)</li>
            </ol>
            <Button
              variant="outline"
              className="w-full"
              asChild
            >
              <a
                href="https://account.mapbox.com/access-tokens/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Ottieni token Mapbox
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiKeyInput;
