import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { Provider, acceptsIncomingWebhook } from './providerFieldsConfig';

interface IntegrationSuccessStepProps {
  selectedProvider: Provider;
  webhookUrl: string;
  onCopyWebhookUrl: () => void;
  onFinish: () => void;
}

const IntegrationSuccessStep = ({
  selectedProvider,
  webhookUrl,
  onCopyWebhookUrl,
  onFinish
}: IntegrationSuccessStepProps) => {
  return (
    <div className="space-y-4">
      <div className="bg-success/10 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="CheckCircle" className="text-success" size={20} />
          <span className="font-semibold text-success">
            Интеграция создана!
          </span>
        </div>
      </div>

      {acceptsIncomingWebhook(selectedProvider.slug) ? (
        <>
          <div>
            <Label>Ваш уникальный URL для вебхуков</Label>
            <div className="flex gap-2 mt-1">
              <Input value={webhookUrl} readOnly className="font-mono text-sm" />
              <Button onClick={onCopyWebhookUrl} variant="outline" size="icon">
                <Icon name="Copy" size={16} />
              </Button>
            </div>
          </div>

          <div className="bg-info/10 p-4 rounded-lg space-y-3">
            <div className="flex items-start gap-2">
              <Icon name="Info" className="text-info mt-0.5" size={18} />
              <div className="text-sm">
                <p className="font-semibold text-foreground mb-2">
                  Инструкция по настройке:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Откройте личный кабинет сервиса</li>
                  <li>Перейдите в раздел уведомлений / вебхуков</li>
                  <li>Вставьте скопированный URL в поле "URL для уведомлений"</li>
                  <li>Выберите метод: POST</li>
                  <li>Сохраните настройки</li>
                </ol>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-info/10 p-4 rounded-lg space-y-2">
          <div className="flex items-start gap-2">
            <Icon name="Info" className="text-info mt-0.5" size={18} />
            <p className="text-sm text-muted-foreground">
              Интеграция подключена и начнёт синхронизацию данных автоматически.
              Дополнительных действий на вашей стороне не требуется.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={onFinish}>
          Готово
        </Button>
      </div>
    </div>
  );
};

export default IntegrationSuccessStep;
