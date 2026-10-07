import CrmMappingBlock from './CrmMappingBlock';
import { ActionTemplateOption, CorrectionSettings } from './automationConfig';

interface ScenarioCrmMappingProps {
  sourceIntegrationId: number | null;
  companyId: number | undefined;
  isBitrix: boolean;
  isAmo: boolean;
  isAgent: boolean;
  mapping: Record<string, unknown>;
  onChange: (mapping: Record<string, unknown>) => void;
  currentTemplate: ActionTemplateOption | undefined;
  cs: CorrectionSettings;
}

const ScenarioCrmMapping = ({
  sourceIntegrationId,
  companyId,
  isBitrix,
  isAmo,
  isAgent,
  mapping,
  onChange,
  currentTemplate,
  cs
}: ScenarioCrmMappingProps) =>
  !sourceIntegrationId ? (
    <p className="text-xs text-muted-foreground">Выберите интеграцию-источник — подгрузим её поля</p>
  ) : isBitrix && companyId ? (
    <>
      <p className="text-xs text-muted-foreground">Поля загружены из вашего {isAmo ? 'AmoCRM' : 'Битрикс24'}, включая пользовательские</p>
      <CrmMappingBlock
        provider={isAmo ? 'amocrm' : 'bitrix24'}
        companyId={companyId}
        integrationId={sourceIntegrationId}
        mapping={mapping}
        onChange={onChange}
        agentReceipt={isAgent}
        agentTemplate={currentTemplate?.agent_settings || {}}
        agentScenario={cs.agent || {}}
        templateVat={currentTemplate?.vat}
      />
    </>
  ) : (
    <p className="text-xs text-muted-foreground">Загрузка полей доступна для Битрикс24 и AmoCRM</p>
  );

export default ScenarioCrmMapping;
