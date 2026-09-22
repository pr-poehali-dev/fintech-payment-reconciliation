import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import functionUrls from '../../../backend/func2url.json';

interface TbankAccount {
  account_number: string;
  currency: string;
  balance: number | null;
}

interface TbankAccountPickerProps {
  companyId: number;
  accountNumber: string;
  onAccountNumberChange: (value: string) => void;
}

const TbankAccountPicker = ({ companyId, accountNumber, onAccountNumberChange }: TbankAccountPickerProps) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [isSandbox, setIsSandbox] = useState(false);
  const [accounts, setAccounts] = useState<TbankAccount[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      const response = await fetch(`${functionUrls['tbank-accounts-list']}?company_id=${companyId}`);
      const data = await response.json();

      if (response.ok) {
        setIsConnected(!!data.is_connected);
        setCompanyName(data.company_name || '');
        setIsSandbox(!!data.sandbox);
        setAccounts(data.accounts || []);
      }
    } catch {
      setIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch(
        `${functionUrls['tbank-oauth-callback']}?action=authorize_url&company_id=${companyId}&redirect_uri=${encodeURIComponent(window.location.href)}`
      );
      const data = await response.json();

      if (data.sandbox) {
        await checkConnection();
      } else if (data.authorize_url) {
        window.location.href = data.authorize_url;
      }
    } finally {
      setIsConnecting(false);
    }
  };

  if (isChecking) {
    return (
      <div>
        <Label>Номер расчётного счёта</Label>
        <div className="h-10 flex items-center text-sm text-muted-foreground">
          <Icon name="Loader2" size={14} className="animate-spin mr-2" />
          Проверяем подтверждение через Т-Бизнес...
        </div>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="space-y-2">
        <Label>Номер расчётного счёта</Label>
        <div className="flex items-center gap-2 text-xs text-success mb-1">
          <Icon name="ShieldCheck" size={14} />
          {isSandbox
            ? `Демо-режим песочницы — счета ${companyName || 'компании'} подтягиваются автоматически`
            : `Доступ подтверждён через Т-Бизнес (${companyName})`}
        </div>
        <Select value={accountNumber} onValueChange={onAccountNumberChange}>
          <SelectTrigger>
            <SelectValue placeholder="Выберите счёт из списка" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((acc) => (
              <SelectItem key={acc.account_number} value={acc.account_number}>
                {acc.account_number} {acc.balance !== null ? `· ${acc.balance.toLocaleString('ru-RU')} ₽` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="account_number">Номер расчётного счёта</Label>
        <Input
          id="account_number"
          placeholder="40702810110011000000"
          value={accountNumber}
          onChange={(e) => onAccountNumberChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Введите вручную или подключите доступ через Т-Бизнес — тогда счета подтянутся автоматически
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={handleConnect} disabled={isConnecting}>
        {isConnecting ? (
          <Icon name="Loader2" size={14} className="animate-spin mr-2" />
        ) : (
          <Icon name="Link" size={14} className="mr-2" />
        )}
        Подключить через Т-Бизнес
      </Button>
    </div>
  );
};

export default TbankAccountPicker;
