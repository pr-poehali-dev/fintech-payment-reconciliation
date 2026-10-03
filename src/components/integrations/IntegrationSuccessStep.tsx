import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { Provider, acceptsIncomingWebhook, suggestsReceiptScenario } from './providerFieldsConfig';

interface IntegrationSuccessStepProps {
  selectedProvider: Provider;
  webhookUrl: string;
  onCopyWebhookUrl: () => void;
  onFinish: () => void;
  onSetupReceipts?: () => void;
}

const IntegrationSuccessStep = ({
  selectedProvider,
  webhookUrl,
  onCopyWebhookUrl,
  onFinish,
  onSetupReceipts
}: IntegrationSuccessStepProps) => {
  const offerReceipts = !!onSetupReceipts && suggestsReceiptScenario(selectedProvider.slug);
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
                {selectedProvider.slug === 'tochka_acquiring' ? (
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Вебхук в Точке создаётся через API (метод Create Webhook) с этим URL</li>
                    <li>Событие — acquiringInternetPayment (оплаты по платёжным ссылкам)</li>
                    <li>Для чеков передавайте товары (Items) при создании платёжной ссылки</li>
                    <li>Подпись каждого вебхука проверяем ключом Точки автоматически</li>
                  </ol>
                ) : selectedProvider.slug === 'alfabank' ? (
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Напишите в поддержку интернет-эквайринга Альфа-Банка</li>
                    <li>Попросите включить callback-уведомления и пришлите им этот URL</li>
                    <li>Метод GET или POST — подойдёт любой</li>
                    <li>Нужны операции: deposited (оплата), approved, reversed, refunded — для карт и СБП они одинаковые</li>
                    <li>Для чеков магазин должен передавать корзину (orderBundle) при регистрации заказа</li>
                  </ol>
                ) : (
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Откройте личный кабинет сервиса</li>
                    <li>Перейдите в раздел уведомлений / вебхуков</li>
                    <li>Вставьте скопированный URL в поле "URL для уведомлений"</li>
                    <li>Выберите метод: POST</li>
                    <li>Сохраните настройки</li>
                  </ol>
                )}
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

      {offerReceipts && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-1">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Icon name="Receipt" size={18} className="text-primary" />
            Чеки сами не пробиваются
          </div>
          <p className="text-sm text-muted-foreground">
            Платежи и корзины будут сохраняться, но чтобы по каждой оплате пробивался чек в кассе,
            нужен сценарий в «Автоматизации». Мы заполним его за вас — останется выбрать кассу и запустить.
          </p>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {offerReceipts ? (
          <>
            <Button variant="outline" onClick={onFinish}>
              Позже
            </Button>
            <Button onClick={onSetupReceipts}>
              <Icon name="Receipt" size={16} className="mr-2" />
              Настроить чеки
            </Button>
          </>
        ) : (
          <Button onClick={onFinish}>
            Готово
          </Button>
        )}
      </div>
    </div>
  );
};

export default IntegrationSuccessStep;
