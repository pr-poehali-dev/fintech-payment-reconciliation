import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import functionUrls from '../../backend/func2url.json';
import { formatPhoneNumber, isValidPhone } from '@/lib/formatters';

interface InviteInfo {
  company_name: string;
  role_name: string;
  role_color: string;
  phone: string;
  full_name: string | null;
  expires_at: string;
}

const InvitePage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loginWithPhone, setCurrentCompanyId, refreshCompanies } = useAuth();

  const [isLoadingInfo, setIsLoadingInfo] = useState(true);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [phone, setPhone] = useState('+7');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [code, setCode] = useState('');
  const [sentCode, setSentCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    const loadInvite = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${functionUrls['invite-accept']}?token=${token}`);
        const data = await res.json();

        if (res.ok && data.success) {
          setInvite(data);
          setPhone(formatPhoneNumber(data.phone.length === 11 ? '+' + data.phone : data.phone));
        } else {
          setLoadError(data.error || 'Приглашение не найдено');
        }
      } catch {
        setLoadError('Не удалось загрузить приглашение');
      } finally {
        setIsLoadingInfo(false);
      }
    };
    loadInvite();
  }, [token]);

  const acceptInvite = async (userId: number, userPhone: string) => {
    if (!token) return;
    setIsAccepting(true);
    try {
      const res = await fetch(functionUrls['invite-accept'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, user_id: userId, phone: userPhone })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        await refreshCompanies();
        setCurrentCompanyId(data.company_id);
        toast({ title: 'Добро пожаловать!', description: `Вы присоединились к компании «${invite?.company_name}»` });
        navigate('/app', { replace: true });
      } else {
        toast({ title: 'Не удалось принять приглашение', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка подключения', variant: 'destructive' });
    } finally {
      setIsAccepting(false);
    }
  };

  useEffect(() => {
    if (user && invite && !isLoadingInfo) {
      const userPhoneDigits = user.phone.replace(/\D/g, '');
      const invitePhoneDigits = invite.phone.replace(/\D/g, '');
      if (userPhoneDigits === invitePhoneDigits) {
        acceptInvite(user.user_id, invitePhoneDigits);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, invite, isLoadingInfo]);

  const handleSendCode = async () => {
    if (!isValidPhone(phone)) return;
    setIsSending(true);
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    setSentCode(generatedCode);

    try {
      const res = await fetch(functionUrls['send-message'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'ek_tg',
          recipient: phone.replace(/\D/g, ''),
          message: `Ваш код для подтверждения приглашения: ${generatedCode}`
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setStep('code');
        toast({ title: 'Код отправлен' });
      } else {
        toast({ title: 'Ошибка отправки', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка подключения', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6 || code !== sentCode) {
      toast({ title: 'Неверный код', variant: 'destructive' });
      setCode('');
      return;
    }

    try {
      const authUser = await loginWithPhone(phone);
      await acceptInvite(authUser.user_id, phone.replace(/\D/g, ''));
    } catch (error: any) {
      toast({ title: 'Ошибка входа', description: error.message, variant: 'destructive' });
    }
  };

  if (isLoadingInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Icon name="Loader2" className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (loadError || !invite) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <Icon name="XCircle" size={32} className="text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Приглашение недоступно</h3>
              <p className="text-sm text-muted-foreground">{loadError}</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/')} className="w-full">
              На главную
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user) {
    const userPhoneDigits = user.phone.replace(/\D/g, '');
    const invitePhoneDigits = invite.phone.replace(/\D/g, '');

    if (userPhoneDigits !== invitePhoneDigits) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-0">
            <CardContent className="pt-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <Icon name="UserX" size={32} className="text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Другой аккаунт</h3>
                <p className="text-sm text-muted-foreground">
                  Приглашение отправлено на другой номер телефона. Выйдите из текущего аккаунта и повторите переход по ссылке.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Icon name="Loader2" className="animate-spin text-primary mx-auto mb-2" size={32} />
          <p className="text-muted-foreground">Присоединяем к компании...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center animate-fade-in">
          <Icon name="Zap" size={32} className="text-primary mx-auto mb-2" />
          <h1 className="text-3xl font-display font-bold text-foreground">Сверка</h1>
        </div>

        <Card className="shadow-2xl border-0 animate-scale-in">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-display">Приглашение в компанию</CardTitle>
            <CardDescription className="text-base">
              «{invite.company_name}» приглашает вас присоединиться
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex items-center justify-center gap-2">
              <Badge className={`${invite.role_color} text-white`}>{invite.role_name}</Badge>
            </div>

            {step === 'phone' ? (
              <>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Подтвердите номер телефона {invite.phone}
                  </Label>
                  <Input
                    type="tel"
                    value={phone}
                    disabled
                    className="h-12 text-center"
                  />
                </div>

                <Button
                  onClick={handleSendCode}
                  disabled={isSending}
                  className="w-full h-12 text-base font-semibold"
                >
                  {isSending ? (
                    <>
                      <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                      Отправка...
                    </>
                  ) : 'Получить код в Telegram'}
                </Button>
              </>
            ) : (
              <>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={code} onChange={setCode}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="w-12 h-14 text-xl" />
                      <InputOTPSlot index={1} className="w-12 h-14 text-xl" />
                      <InputOTPSlot index={2} className="w-12 h-14 text-xl" />
                      <InputOTPSlot index={3} className="w-12 h-14 text-xl" />
                      <InputOTPSlot index={4} className="w-12 h-14 text-xl" />
                      <InputOTPSlot index={5} className="w-12 h-14 text-xl" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <Button
                  onClick={handleVerifyCode}
                  disabled={code.length !== 6 || isAccepting}
                  className="w-full h-12 text-base font-semibold"
                >
                  {isAccepting ? (
                    <>
                      <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                      Вступаем...
                    </>
                  ) : 'Подтвердить и вступить'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InvitePage;
