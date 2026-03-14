import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabaseService } from '@/services/supabaseService';
import { Category } from '@/services/types';
import { Plus, Pencil, Trash2, X, Loader2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { useTenantStore } from '@/store/tenantStore';

const categorySchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  active: z.boolean(),
});

type CategoryForm = z.infer<typeof categorySchema>;

export default function AdminCategories() {
  const restaurantId = useTenantStore((state) => state.restaurantId);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      active: true,
    }
  });

  const fetchCategories = async () => {
    if (!restaurantId) return;
    try {
      const data = await supabaseService.getCategories(restaurantId);
      setCategories(data);
    } catch (error) {
      toast.error('Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [restaurantId]);

  const handleOpenModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setValue('name', category.name);
      setValue('active', category.active);
    } else {
      setEditingCategory(null);
      reset();
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    reset();
  };

  const onSubmit = async (data: CategoryForm) => {
    if (!restaurantId) return;
    try {
      if (editingCategory) {
        await supabaseService.updateCategory(editingCategory.id, data);
        toast.success('Categoria atualizada');
      } else {
        await supabaseService.createCategory(data, restaurantId);
        toast.success('Categoria criada');
      }
      handleCloseModal();
      fetchCategories();
    } catch (error) {
      toast.error('Erro ao salvar categoria');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta categoria?')) {
      try {
        await supabaseService.deleteCategory(id);
        toast.success('Categoria excluída');
        fetchCategories();
      } catch (error) {
        toast.error('Erro ao excluir categoria');
      }
    }
  };

  const moveCategory = async (index: number, direction: 'up' | 'down') => {
    const newCategories = [...categories];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newCategories.length) return;

    // Swap
    [newCategories[index], newCategories[targetIndex]] = [newCategories[targetIndex], newCategories[index]];
    setCategories(newCategories);

    setReordering(true);
    try {
      await supabaseService.updateCategoryOrder(newCategories.map((c) => c.id));
    } catch (error) {
      toast.error('Erro ao salvar ordem');
      fetchCategories(); // revert on error
    } finally {
      setReordering(false);
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorias</h1>
          <p className="text-sm text-gray-500 mt-1">Use as setas para definir a ordem de exibição no cardápio</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-amazii-primary hover:bg-amazii-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova Categoria
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-4 py-4 w-10 text-center">#</th>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map((category, index) => (
                <tr key={category.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => moveCategory(index, 'up')}
                        disabled={index === 0 || reordering}
                        className="p-0.5 text-gray-300 hover:text-amazii-primary disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Mover para cima"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <GripVertical className="w-3.5 h-3.5 text-gray-300" />
                      <button
                        onClick={() => moveCategory(index, 'down')}
                        disabled={index === categories.length - 1 || reordering}
                        className="p-0.5 text-gray-300 hover:text-amazii-primary disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Mover para baixo"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="font-medium text-gray-900">{category.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${category.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {category.active ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleOpenModal(category)}
                        className="p-2 text-gray-400 hover:text-amazii-primary hover:bg-purple-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(category.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir"
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
        {categories.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Nenhuma categoria encontrada.
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input {...register('name')} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amazii-primary/20 outline-none" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('active')} className="w-4 h-4 text-amazii-primary rounded focus:ring-amazii-primary" />
                  <span className="text-sm font-medium text-gray-700">Ativa</span>
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
