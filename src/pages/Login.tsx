import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import functionUrls from '../../backend/func2url.json';

type MessengerType = 'whatsapp' | 'telegram' | 'max' | null;

const Login = () => {
  const [step, setStep] = useState<'phone' | 'code' | 'blocked'>('phone');
  const [phone, setPhone] = useState('+7');
  const [selectedMessenger, setSelectedMessenger] = useState<MessengerType>(null);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sentCode, setSentCode] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [blockTime, setBlockTime] = useState(0);
  const { toast } = useToast();

  const MAX_ATTEMPTS = 3;
  const BLOCK_DURATION = 300;

  const messengers = [
    { id: 'whatsapp' as MessengerType, icon: 'MessageCircle', label: 'WhatsApp', color: 'hover:bg-green-500/10' },
    { id: 'telegram' as MessengerType, icon: 'Send', label: 'Telegram', color: 'hover:bg-blue-500/10' },
    { id: 'max' as MessengerType, icon: 'Mail', label: 'Max', color: 'hover:bg-purple-500/10' }
  ];

  const handleSendCode = async () => {
    if (phone.length >= 12 && selectedMessenger) {
      setIsLoading(true);
      
      const providerMap: Record<string, string> = {
        'whatsapp': 'ek_wa',
        'telegram': 'ek_tg',
        'max': 'ek_max'
      };
      
      const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
      setSentCode(generatedCode);
      
      try {
        const response = await fetch(functionUrls['send-message'], {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider: providerMap[selectedMessenger],
            recipient: phone.replace(/\D/g, ''),
            message: `Ваш код для входа в FinSync: ${generatedCode}`
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          toast({
            title: 'Код отправлен',
            description: `Проверьте ${selectedMessenger === 'whatsapp' ? 'WhatsApp' : selectedMessenger === 'telegram' ? 'Telegram' : 'Max'}`,
          });
          setStep('code');
        } else {
          toast({
            title: 'Ошибка отправки',
            description: data.error || 'Не удалось отправить код',
            variant: 'destructive'
          });
        }
      } catch (error) {
        toast({
          title: 'Ошибка',
          description: 'Проблема с подключением к серверу',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleVerifyCode = () => {
    if (code.length === 6) {
      if (code === sentCode) {
        setAttempts(0);
        window.location.href = '/';
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        if (newAttempts >= MAX_ATTEMPTS) {
          setStep('blocked');
          setBlockTime(BLOCK_DURATION);
          
          const timer = setInterval(() => {
            setBlockTime((prev) => {
              if (prev <= 1) {
                clearInterval(timer);
                setStep('phone');
                setAttempts(0);
                setCode('');
                setSentCode('');
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
          
          toast({
            title: 'Превышен лимит попыток',
            description: `Попробуйте снова через ${Math.floor(BLOCK_DURATION / 60)} минут`,
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'Неверный код',
            description: `Осталось попыток: ${MAX_ATTEMPTS - newAttempts}`,
            variant: 'destructive'
          });
        }
        
        setCode('');
      }
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.startsWith('7')) {
      let formatted = '+7';
      if (digits.length > 1) {
        formatted += ' (' + digits.slice(1, 4);
      }
      if (digits.length >= 5) {
        formatted += ') ' + digits.slice(4, 7);
      }
      if (digits.length >= 8) {
        formatted += '-' + digits.slice(7, 9);
      }
      if (digits.length >= 10) {
        formatted += '-' + digits.slice(9, 11);
      }
      return formatted;
    }
    return value;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length < phone.length) {
      setPhone(value);
    } else {
      const formatted = formatPhone(value);
      if (formatted.replace(/\D/g, '').length <= 11) {
        setPhone(formatted);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Icon name="Zap" size={32} className="text-primary" />
            <h1 className="text-3xl font-display font-bold text-foreground">FinSync</h1>
          </div>
          <p className="text-sm text-muted-foreground">Автоматизация платежей</p>
        </div>

        <Card className="shadow-2xl border-0 animate-scale-in">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-display">
              {step === 'phone' ? 'Введите номер телефона или почту' : 'Введите код'}
            </CardTitle>
            <CardDescription className="text-base">
              {step === 'phone' 
                ? 'Чтобы войти или зарегистрироваться'
                : `Код отправлен в ${selectedMessenger === 'whatsapp' ? 'WhatsApp' : selectedMessenger === 'telegram' ? 'Telegram' : 'Max'}`
              }
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {step === 'phone' ? (
              <>
                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                      <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-red-500">
                        <span className="text-white text-xs font-bold">🇷🇺</span>
                      </div>
                    </div>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={handlePhoneChange}
                      placeholder="+7 (___) ___-__-__"
                      className="pl-14 h-14 text-lg border-2 focus:border-primary transition-all"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Icon name="Phone" size={18} className="text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Icon name="Mail" size={18} className="text-muted-foreground" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Получить код в:</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {messengers.map((messenger) => (
                        <button
                          key={messenger.id}
                          onClick={() => setSelectedMessenger(messenger.id)}
                          className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                            selectedMessenger === messenger.id
                              ? 'border-primary bg-primary/5 scale-105'
                              : 'border-border hover:border-primary/50'
                          } ${messenger.color}`}
                        >
                          <Icon name={messenger.icon as any} size={24} className={
                            selectedMessenger === messenger.id ? 'text-primary' : 'text-muted-foreground'
                          } />
                          <span className={`text-xs font-medium ${
                            selectedMessenger === messenger.id ? 'text-primary' : 'text-muted-foreground'
                          }`}>
                            {messenger.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleSendCode}
                  disabled={phone.replace(/\D/g, '').length < 11 || !selectedMessenger || isLoading}
                  className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 transition-all"
                >
                  {isLoading ? (
                    <>
                      <Icon name="Loader2" size={20} className="mr-2 animate-spin" />
                      Отправка...
                    </>
                  ) : 'Войти'}
                </Button>

                <p className="text-xs text-center text-muted-foreground px-4">
                  Нажимая «Войти», вы принимаете пользовательское соглашение и политику конфиденциальности
                </p>
              </>
            ) : (
              <>
                <div className="space-y-6">
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={code}
                      onChange={(value) => setCode(value)}
                    >
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

                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Не пришёл код?
                    </p>
                    <Button 
                      variant="link" 
                      onClick={handleSendCode}
                      disabled={isLoading}
                      className="text-primary"
                    >
                      {isLoading ? 'Отправка...' : 'Отправить повторно'}
                    </Button>
                  </div>
                </div>

                <Button 
                  onClick={handleVerifyCode}
                  disabled={code.length !== 6}
                  className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 transition-all"
                >
                  Подтвердить
                </Button>

                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setStep('phone');
                    setCode('');
                    setSentCode('');
                    setAttempts(0);
                  }}
                  className="w-full"
                >
                  <Icon name="ArrowLeft" size={16} className="mr-2" />
                  Изменить номер
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-6">
                  <div className="flex justify-center">
                    <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
                      <Icon name="Ban" size={48} className="text-red-500" />
                    </div>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-semibold text-foreground">
                      Слишком много попыток
                    </h3>
                    <p className="text-muted-foreground">
                      Вы ввели неверный код 3 раза.
                      <br />
                      Попробуйте снова через:
                    </p>
                    <div className="text-4xl font-display font-bold text-red-500 mt-4">
                      {Math.floor(blockTime / 60)}:{String(blockTime % 60).padStart(2, '0')}
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;