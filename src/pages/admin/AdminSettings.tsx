import React, { useState, useEffect, ChangeEvent } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabaseService } from '@/services/supabaseService';
import { StoreSettings } from '@/services/types';
import { Loader2, Save, AlertTriangle, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';
import { useTenantStore } from '@/store/tenantStore';

const settingsSchema = z.object({
  storeName: z.string().min(1, 'Nome obrigatório'),
  storeLogo: z.string().nullable().optional(),
  storeAddress: z.string().nullable().optional(),
  
  adminEmail: z.string().email('Email inválido').or(z.literal('')),
  adminPassword: z.string().min(6, 'Senha deve ter 6+ caracteres').or(z.literal('')),
  
  deliveryFeeBase: z.coerce.number().min(0),
  deliveryFeesByNeighborhood: z.array(z.object({
    neighborhood: z.string().min(1),
    fee: z.coerce.number().min(0)
  })),
  
  minOrderValue: z.coerce.number().min(0),
  
  whatsappNumber: z.string().min(10),
  whatsappPrefix: z.string(),
  
  deliveryTimeMin: z.coerce.number().min(1),
  deliveryTimeMax: z.coerce.number().min(1),
  allowPickup: z.boolean(),
  
  emergencyClosed: z.boolean(),
  openingHours: z.record(z.string(), z.object({
    open: z.string(),
    close: z.string(),
    active: z.boolean()
  })),

  primaryColor: z.string().nullable().optional(),
  secondaryColor: z.string().nullable().optional(),
  catalogTitle: z.string().nullable().optional(),
  catalogSubtitle: z.string().nullable().optional(),
  banners: z.array(z.object({
    id: z.string(),
    imageUrlMobile: z.string().min(1, 'URL da foto mobile obrigatória'),
    imageUrlDesktop: z.string().min(1, 'URL da foto PC obrigatória'),
    link: z.string().optional(),
    active: z.boolean()
  })).optional(),

  socialLinks: z.object({
    instagram: z.string().nullable().optional(),
    facebook: z.string().nullable().optional(),
    tiktok: z.string().nullable().optional(),
  }).nullable().optional(),

  creditCardFeeEnabled: z.boolean().optional(),
  creditCardFeeType: z.enum(['percent', 'fixed']).optional(),
  creditCardFeePercent: z.coerce.number().min(0).optional(),
  debitCardFeeEnabled: z.boolean().optional(),
  debitCardFeeType: z.enum(['percent', 'fixed']).optional(),
  debitCardFeePercent: z.coerce.number().min(0).optional(),
  printerWidth: z.enum(['80mm', '58mm', 'A4']).optional(),
  paymentPixEnabled: z.boolean().optional(),
  paymentCashEnabled: z.boolean().optional(),
  paymentCreditCardEnabled: z.boolean().optional(),
  paymentDebitCardEnabled: z.boolean().optional()
});

const FileInput = ({ label, onChange, value, id }: { label: string, onChange: (url: string) => void, value?: string, id: string }) => {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await supabaseService.uploadFile(file);
      onChange(url);
      toast.success('Foto enviada com sucesso');
    } catch (error) {
      toast.error('Erro ao enviar foto');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={value || ''}
            readOnly
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 text-sm outline-none"
            placeholder="Nenhuma foto selecionada"
          />
          <label className="cursor-pointer bg-amazii-primary hover:bg-amazii-dark text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Selecionar'}
            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={uploading} />
          </label>
        </div>
        {value && (
          <div className="relative w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-white">
            <img src={value} alt="Preview" className="w-full h-full object-contain" />
          </div>
        )}
      </div>
    </div>
  );
};

type SettingsForm = z.infer<typeof settingsSchema>;

const DAYS = [
  { key: 'monday', label: 'Segunda' },
  { key: 'tuesday', label: 'Terça' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday', label: 'Quinta' },
  { key: 'friday', label: 'Sexta' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

export default function AdminSettings() {
  const restaurantId = useTenantStore((state) => state.restaurantId);
  const { refreshSettings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const { register, control, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema) as any,
    defaultValues: {
      storeName: '',
      adminEmail: '',
      adminPassword: '',
      deliveryFeeBase: 0,
      deliveryFeesByNeighborhood: [],
      minOrderValue: 0,
      whatsappNumber: '',
      whatsappPrefix: '',
      deliveryTimeMin: 30,
      deliveryTimeMax: 60,
      allowPickup: false,
      emergencyClosed: false,
      openingHours: {
        monday:    { open: '09:00', close: '22:00', active: true  },
        tuesday:   { open: '09:00', close: '22:00', active: true  },
        wednesday: { open: '09:00', close: '22:00', active: true  },
        thursday:  { open: '09:00', close: '22:00', active: true  },
        friday:    { open: '09:00', close: '22:00', active: true  },
        saturday:  { open: '10:00', close: '22:00', active: true  },
        sunday:    { open: '10:00', close: '20:00', active: false },
      },
      primaryColor: '#7c3aed',
      secondaryColor: '#a78bfa',
      banners: [],
      socialLinks: { instagram: '', facebook: '', tiktok: '' },
      creditCardFeeEnabled: false,
      creditCardFeeType: 'percent',
      creditCardFeePercent: 0,
      debitCardFeeEnabled: false,
      debitCardFeeType: 'percent',
      debitCardFeePercent: 0,
      printerWidth: '80mm',
      paymentPixEnabled: true,
      paymentCashEnabled: true,
      paymentCreditCardEnabled: true,
      paymentDebitCardEnabled: true,
    }
  });

  const { fields: feeFields, append: appendFee, remove: removeFee } = useFieldArray({
    control,
    name: "deliveryFeesByNeighborhood"
  });

  const { fields: bannerFields, append: appendBanner, remove: removeBanner } = useFieldArray({
    control,
    name: "banners"
  });

  const emergencyClosed = watch('emergencyClosed');
  const primaryColor = watch('primaryColor');
  const secondaryColor = watch('secondaryColor');

  useEffect(() => {
    const fetchSettings = async () => {
      if (!restaurantId) { setLoading(false); return; }
      try {
        const data = await supabaseService.getSettings(restaurantId);
        if (data) {
          // Merge loaded values onto form preserving defaults for missing fields
          Object.entries(data).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
              setValue(key as any, value);
            }
          });
        }
        // If data is null (new restaurant), the form defaultValues are already set — just mark loaded
      } catch (error) {
        toast.error('Erro ao carregar configurações');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [setValue, restaurantId]);

  const onSubmit = async (data: SettingsForm) => {
    if (!restaurantId) {
      toast.error('Restaurante não identificado. Faça login novamente.');
      return;
    }
    try {
      await supabaseService.updateSettings(data, restaurantId);
      await refreshSettings();
      toast.success('Configurações salvas com sucesso!');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error(`Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const onFormError = (errors: any) => {
    console.log('Form validation errors:', errors);
    toast.error('Por favor, corrija os erros no formulário antes de salvar.');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-amazii-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <h1 className="text-2xl font-bold text-gray-900">Configurações da Loja</h1>

      <form onSubmit={handleSubmit(onSubmit, onFormError)} className="space-y-8">
        
        {/* Emergency Control (remains same) */}
        <div className={`p-6 rounded-2xl border-2 transition-colors ${
          emergencyClosed ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
        }`}>
          {/* ... (content remains same) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full ${emergencyClosed ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className={`font-bold text-lg ${emergencyClosed ? 'text-red-700' : 'text-gray-900'}`}>
                  Controle de Emergência
                </h3>
                <p className="text-sm text-gray-500">
                  Force o fechamento imediato da loja, ignorando horários programados.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" {...register('emergencyClosed')} className="sr-only peer" />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>
        </div>

        {/* General Info */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          <h3 className="font-bold text-lg border-b border-gray-100 pb-2">Identidade e Acesso</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Loja</label>
              <input {...register('storeName')} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none" />
            </div>
            <FileInput 
              label="Logo da Loja" 
              value={watch('storeLogo')} 
              onChange={(url) => setValue('storeLogo', url)} 
              id="storeLogo"
            />
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Endereço Completo</label>
              <input {...register('storeAddress')} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none" placeholder="Rua Exemplo, 123 - Bairro" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Admin</label>
              <input {...register('adminEmail')} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha Admin</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  {...register('adminPassword')} 
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none pr-10" 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.adminPassword && <p className="text-red-500 text-xs mt-1">{errors.adminPassword.message}</p>}
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          <h3 className="font-bold text-lg border-b border-gray-100 pb-2">Redes Sociais</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instagram (URL)</label>
              <input {...register('socialLinks.instagram')} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none" placeholder="https://instagram.com/sua_loja" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Facebook (URL)</label>
              <input {...register('socialLinks.facebook')} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none" placeholder="https://facebook.com/sua_loja" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TikTok (URL)</label>
              <input {...register('socialLinks.tiktok')} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none" placeholder="https://tiktok.com/@sua_loja" />
            </div>
          </div>
        </div>

        {/* Catalog Customization */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          <h3 className="font-bold text-lg border-b border-gray-100 pb-2">Personalização do Catálogo</h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cor Primária</label>
              <div className="flex gap-2">
                <input 
                  type="color" 
                  value={watch('primaryColor') || '#7c3aed'} 
                  onChange={(e) => setValue('primaryColor', e.target.value)}
                  className="h-10 w-10 rounded cursor-pointer border-0 p-0 overflow-hidden" 
                />
                <input 
                  {...register('primaryColor')} 
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none uppercase" 
                  placeholder="#7C3AED" 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cor Secundária</label>
              <div className="flex gap-2">
                <input 
                  type="color" 
                  value={watch('secondaryColor') || '#a78bfa'} 
                  onChange={(e) => setValue('secondaryColor', e.target.value)}
                  className="h-10 w-10 rounded cursor-pointer border-0 p-0 overflow-hidden" 
                />
                <input 
                  {...register('secondaryColor')} 
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none uppercase" 
                  placeholder="#A78BFA" 
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Título do Catálogo</label>
              <input {...register('catalogTitle')} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none" placeholder="O melhor açaí da cidade" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo do Catálogo</label>
              <input {...register('catalogSubtitle')} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none" placeholder="Peça agora e receba no conforto da sua casa." />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Banners Promocionais</label>
            {errors.banners && <p className="text-red-500 text-sm mb-2">Erro nos banners: Verifique se todas as fotos foram selecionadas.</p>}
            <div className="space-y-4">
              {bannerFields.map((field, index) => (
                <div key={field.id} className="p-4 border border-gray-100 rounded-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Banner {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeBanner(index)}
                      className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FileInput 
                      label="Foto Mobile (750x400)" 
                      value={watch(`banners.${index}.imageUrlMobile`)} 
                      onChange={(url) => setValue(`banners.${index}.imageUrlMobile`, url)} 
                      id={`banners.${index}.imageUrlMobile`}
                    />
                    <FileInput 
                      label="Foto PC (1920x600)" 
                      value={watch(`banners.${index}.imageUrlDesktop`)} 
                      onChange={(url) => setValue(`banners.${index}.imageUrlDesktop`, url)} 
                      id={`banners.${index}.imageUrlDesktop`}
                    />
                  </div>
                  <input 
                    {...register(`banners.${index}.link` as const)} 
                    placeholder="Link de destino (Opcional)"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amazii-primary/20"
                  />
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" {...register(`banners.${index}.active` as const)} className="w-4 h-4 text-amazii-primary rounded focus:ring-amazii-primary" />
                      <span className="text-sm text-gray-600">Ativo</span>
                    </label>
                  </div>
                </div>
              ))}
              <button 
                type="button" 
                onClick={() => appendBanner({ id: crypto.randomUUID(), imageUrlMobile: '', imageUrlDesktop: '', active: true })}
                className="text-sm text-amazii-primary font-medium hover:underline flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Adicionar Banner
              </button>
            </div>
          </div>
        </div>

        {/* WhatsApp Integration (remains same) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          {/* ... (content remains same) */}
          <h3 className="font-bold text-lg border-b border-gray-100 pb-2">Integração WhatsApp</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número (com DDI e DDD)</label>
              <input {...register('whatsappNumber')} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none" placeholder="5588994365241" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prefixo da Mensagem</label>
              <input {...register('whatsappPrefix')} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none" />
            </div>
          </div>
        </div>

        {/* Delivery & Fees (remains same) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          {/* ... (content remains same) */}
          <h3 className="font-bold text-lg border-b border-gray-100 pb-2">Entrega e Taxas</h3>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Taxa Base (R$)</label>
              <input type="number" step="0.50" {...register('deliveryFeeBase')} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tempo Mín (min)</label>
              <input type="number" {...register('deliveryTimeMin')} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tempo Máx (min)</label>
              <input type="number" {...register('deliveryTimeMax')} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none" />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <input type="checkbox" {...register('allowPickup')} className="w-4 h-4 text-amazii-primary rounded focus:ring-amazii-primary" />
              <span className="text-sm font-medium text-gray-700">Permitir Retirada na Loja</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Taxas por Bairro</label>
            <div className="space-y-3">
              {feeFields.map((field, index) => (
                <div key={field.id} className="flex gap-3">
                  <input 
                    {...register(`deliveryFeesByNeighborhood.${index}.neighborhood` as any)} 
                    placeholder="Bairro"
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none"
                  />
                  <input 
                    type="number" 
                    step="0.50"
                    {...register(`deliveryFeesByNeighborhood.${index}.fee` as any)} 
                    placeholder="Valor"
                    className="w-32 px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none"
                  />
                  <button type="button" onClick={() => removeFee(index)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
              <button 
                type="button" 
                onClick={() => appendFee({ neighborhood: '', fee: 0 })}
                className="text-sm text-amazii-primary font-medium hover:underline flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Adicionar Bairro
              </button>
            </div>
          </div>
        </div>

        {/* Payment & Fees */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          <h3 className="font-bold text-lg border-b border-gray-100 pb-2">Formas de Pagamento</h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Generic Methods */}
            <div className="md:col-span-2 grid md:grid-cols-2 gap-6">
              <div className="p-4 border border-gray-200 rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input type="checkbox" {...register('paymentPixEnabled')} className="w-4 h-4 text-amazii-primary rounded" />
                  <span>Aceitar Pix?</span>
                </label>
              </div>
              <div className="p-4 border border-gray-200 rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input type="checkbox" {...register('paymentCashEnabled')} className="w-4 h-4 text-amazii-primary rounded" />
                  <span>Aceitar Dinheiro?</span>
                </label>
              </div>
            </div>

            {/* Credit Card */}
            <div className="p-4 border border-gray-200 rounded-xl space-y-4">
              <label className="flex items-center gap-2 cursor-pointer font-bold">
                <input type="checkbox" {...register('paymentCreditCardEnabled')} className="w-4 h-4 text-amazii-primary rounded" />
                <span>Aceitar Cartão de Crédito?</span>
              </label>
              <div className={watch('paymentCreditCardEnabled') ? 'opacity-100' : 'opacity-50 pointer-events-none'}>
                <label className="flex items-center gap-2 cursor-pointer font-medium mb-2 text-sm">
                  <input type="checkbox" {...register('creditCardFeeEnabled')} className="w-4 h-4 text-amazii-primary rounded" />
                  <span>Cobrar Taxa de Crédito?</span>
                </label>
                <div className="flex gap-2">
                  <select {...register('creditCardFeeType')} className="flex-1 px-4 py-2 rounded-lg border border-gray-200">
                    <option value="percent">Porcentagem (%)</option>
                    <option value="fixed">Valor Fixo (R$)</option>
                  </select>
                  <input type="number" step="0.01" {...register('creditCardFeePercent')} className="flex-1 px-4 py-2 rounded-lg border border-gray-200" placeholder="0.00" />
                </div>
              </div>
            </div>

            {/* Debit Card */}
            <div className="p-4 border border-gray-200 rounded-xl space-y-4">
              <label className="flex items-center gap-2 cursor-pointer font-bold">
                <input type="checkbox" {...register('paymentDebitCardEnabled')} className="w-4 h-4 text-amazii-primary rounded" />
                <span>Aceitar Cartão de Débito?</span>
              </label>
              <div className={watch('paymentDebitCardEnabled') ? 'opacity-100' : 'opacity-50 pointer-events-none'}>
                <label className="flex items-center gap-2 cursor-pointer font-medium mb-2 text-sm">
                  <input type="checkbox" {...register('debitCardFeeEnabled')} className="w-4 h-4 text-amazii-primary rounded" />
                  <span>Cobrar Taxa de Débito?</span>
                </label>
                <div className="flex gap-2">
                  <select {...register('debitCardFeeType')} className="flex-1 px-4 py-2 rounded-lg border border-gray-200">
                    <option value="percent">Porcentagem (%)</option>
                    <option value="fixed">Valor Fixo (R$)</option>
                  </select>
                  <input type="number" step="0.01" {...register('debitCardFeePercent')} className="flex-1 px-4 py-2 rounded-lg border border-gray-200" placeholder="0.00" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Printer Configuration */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          <h3 className="font-bold text-lg border-b border-gray-100 pb-2">Configurações de Impressão</h3>
          <div className="md:w-1/2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tamanho da Impressora Térmica</label>
            <select {...register('printerWidth')} className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none">
              <option value="80mm">80mm (Bobina Padrão Grande)</option>
              <option value="58mm">58mm (Bobina Pequena Menorzinha)</option>
              <option value="A4">A4 (Folha Comum)</option>
            </select>
            <p className="text-xs text-gray-500 mt-2">Isso ajustará a nota na hora de imprimir os pedidos.</p>
          </div>
        </div>

        {/* Opening Hours (remains same) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          {/* ... (content remains same) */}
          <h3 className="font-bold text-lg border-b border-gray-100 pb-2">Horário de Funcionamento</h3>
          <div className="space-y-4">
            {DAYS.map((day) => (
              <div key={day.key} className="flex items-center gap-4">
                <div className="w-24 font-medium text-gray-700">{day.label}</div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" {...register(`openingHours.${day.key}.active` as any)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amazii-primary"></div>
                </label>
                <input 
                  type="time" 
                  {...register(`openingHours.${day.key}.open` as any)}
                  className="px-3 py-1 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none"
                />
                <span className="text-gray-400">até</span>
                <input 
                  type="time" 
                  {...register(`openingHours.${day.key}.close` as any)}
                  className="px-3 py-1 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Save Button (remains same) */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 md:relative md:bg-transparent md:border-none md:p-0 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full md:w-auto bg-amazii-primary hover:bg-amazii-dark text-white px-8 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-70 shadow-lg shadow-purple-200"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Salvar Configurações
          </button>
        </div>
      </form>
    </div>
  );
}

