import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const WebhookTestPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [webhookUrl, setWebhookUrl] = useState('https://functions.poehali.dev/a923b457-57a6-4eb2-b566-9a9d65cb04e8?token=_fOwBMbizfAijMYjXbhrEWrH-czDvJ46thWGkuA50g0');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ status: number; body: string } | null>(null);

  const examplePayload = {
    "TerminalKey": "TBankTest",
    "Amount": 100000,
    "OrderId": "21050",
    "Success": true,
    "Status": "CONFIRMED",
    "PaymentId": 13660,
    "ErrorCode": "0",
    "Message": "Платеж успешно обработан",
    "Details": "Тестовая оплата",
    "Pan": "430000******0777",
    "ExpDate": "0229",
    "Token": "placeholder_will_be_calculated"
  };

  const [payload, setPayload] = useState(JSON.stringify(examplePayload, null, 2));

  const calculateToken = async (data: any, terminalPassword: string) => {
    const valuesToHash: string[] = [];
    
    for (const key of Object.keys(data).sort()) {
      if (key === 'Token') continue;
      
      const value = data[key];
      if (typeof value === 'object' && value !== null) continue;
      
      if (typeof value === 'boolean') {
        valuesToHash.push(value ? 'true' : 'false');
      } else {
        valuesToHash.push(String(value));
      }
    }
    
    valuesToHash.push(terminalPassword);
    
    const concatenated = valuesToHash.join('');
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(concatenated);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  };

  const sendWebhook = async () => {
    try {
      setLoading(true);
      setResponse(null);

      const parsedPayload = JSON.parse(payload);
      
      const terminalPassword = 'tzeq5ni4bf7shece';
      const calculatedToken = await calculateToken(parsedPayload, terminalPassword);
      parsedPayload.Token = calculatedToken;

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsedPayload),
      });

      const responseBody = await res.text();
      
      setResponse({
        status: res.status,
        body: responseBody
      });

      if (res.ok) {
        toast({
          title: 'Успешно!',
          description: `Вебхук отправлен. Статус: ${res.status}`,
        });
      } else {
        toast({
          title: 'Ошибка',
          description: `Статус: ${res.status}`,
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Ошибка отправки',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Тестирование вебхука</CardTitle>
            <CardDescription>
              Отправьте тестовый запрос на ваш приемник вебхуков
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">URL вебхука</Label>
              <Input
                id="webhook-url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://functions.poehali.dev/..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payload">Тело запроса (JSON)</Label>
              <Textarea
                id="payload"
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                className="font-mono text-sm min-h-[300px]"
                placeholder="Введите JSON"
              />
              <p className="text-xs text-muted-foreground">
                Поле Token будет автоматически рассчитано по алгоритму Тбанка
              </p>
            </div>

            <Button
              onClick={sendWebhook}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              <Send className="w-4 h-4 mr-2" />
              {loading ? 'Отправка...' : 'Отправить вебхук'}
            </Button>

            {response && (
              <Card className={response.status === 200 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Ответ: {response.status} {response.status === 200 ? '✅' : '❌'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm whitespace-pre-wrap break-words">
                    {response.body}
                  </pre>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WebhookTestPage;
