import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabaseService } from '@/services/supabaseService';
import { Coupon, CouponType } from '@/services/types';
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTenantStore } from '@/store/tenantStore';

const couponSchema = z.object({
  code: z.string().min(3, 'Código deve ter pelo menos 3 caracteres').toUpperCase(),
  type: z.enum(['percentage', 'fixed', 'free_shipping']),
  value: z.coerce.number().min(0, 'Valor inválido'),
  active: z.boolean(),
  firstPurchaseOnly: z.boolean().optional(),
});

type CouponForm = z.infer<typeof couponSchema>;

export default function AdminCoupons() {
  const restaurantId = useTenantStore((state) => state.restaurantId);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CouponForm>({
    resolver: zodResolver(couponSchema) as any,
    defaultValues: {
      active: true,
      type: 'percentage',
      firstPurchaseOnly: false,
    }
  });

  const type = watch('type');

  const fetchCoupons = async () => {
    if (!restaurantId) return;
    try {
      const data = await supabaseService.getCoupons(restaurantId);
      setCoupons(data);
    } catch (error) {
      toast.error('Erro ao carregar cupons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, [restaurantId]);

  const handleOpenModal = (coupon?: Coupon) => {
    if (coupon) {
      setEditingCoupon(coupon);
      setValue('code', coupon.code);
      setValue('type', coupon.type);
      setValue('value', coupon.value);
      setValue('active', coupon.active);
      setValue('firstPurchaseOnly', coupon.firstPurchaseOnly);
    } else {
      setEditingCoupon(null);
      reset({
        active: true,
        type: 'percentage',
        firstPurchaseOnly: false,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCoupon(null);
    reset();
  };

  const onSubmit = async (data: CouponForm) => {
    if (!restaurantId) return;
    try {
      if (editingCoupon) {
        await supabaseService.updateCoupon(editingCoupon.id, data);
        toast.success('Cupom atualizado');
      } else {
        await supabaseService.createCoupon(data, restaurantId);
        toast.success('Cupom criado');
      }
      handleCloseModal();
      fetchCoupons();
    } catch (error) {
      toast.error('Erro ao salvar cupom');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este cupom?')) {
      try {
        await supabaseService.deleteCoupon(id);
        toast.success('Cupom excluído');
        fetchCoupons();
      } catch (error) {
        toast.error('Erro ao excluir cupom');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-amazii-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Cupons</h1>
        <button
          onClick={() => handleOpenModal()}
          className="bg-amazii-primary hover:bg-amazii-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Cupom
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Código</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Usos</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-gray-900">{coupon.code}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {coupon.type === 'percentage' && 'Porcentagem'}
                    {coupon.type === 'fixed' && 'Valor Fixo'}
                    {coupon.type === 'free_shipping' && 'Frete Grátis'}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {coupon.type === 'percentage' ? `${coupon.value}%` : `R$ ${coupon.value.toFixed(2)}`}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{coupon.usageCount}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${coupon.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {coupon.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleOpenModal(coupon)}
                        className="p-2 text-gray-400 hover:text-amazii-primary hover:bg-purple-50 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(coupon.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {coupons.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Nenhum cupom encontrado.
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCoupon ? 'Editar Cupom' : 'Novo Cupom'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                <input {...register('code')} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none uppercase" placeholder="EX: DESCONTO10" />
                {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select {...register('type')} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none bg-white">
                  <option value="percentage">Porcentagem</option>
                  <option value="fixed">Valor Fixo</option>
                  <option value="free_shipping">Frete Grátis</option>
                </select>
              </div>

              {type !== 'free_shipping' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
                  <input type="number" step="0.01" {...register('value')} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none" />
                  {errors.value && <p className="text-red-500 text-xs mt-1">{errors.value.message}</p>}
                </div>
              )}

              <div className="pt-2 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('active')} className="w-4 h-4 text-amazii-primary rounded focus:ring-amazii-primary" />
                  <span className="text-sm font-medium text-gray-700">Ativo</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('firstPurchaseOnly')} className="w-4 h-4 text-amazii-primary rounded focus:ring-amazii-primary" />
                  <span className="text-sm font-medium text-gray-700">Apenas Primeira Compra</span>
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-amazii-primary text-white rounded-lg hover:bg-amazii-dark font-medium"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

