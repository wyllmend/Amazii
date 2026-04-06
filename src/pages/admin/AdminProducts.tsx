import React, { useState, useEffect, ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabaseService } from '@/services/supabaseService';
import { Product, Category, ProductOptionGroup } from '@/services/types';
import { formatCurrency } from '@/lib/utils';
import { Plus, Edit, Trash2, Search, Loader2, X, Image as ImageIcon, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { useTenantStore } from '@/store/tenantStore';
import ProductOptionManager from '@/components/admin/ProductOptionManager';

const optionSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Nome é obrigatório'),
  price: z.coerce.number().min(0, 'Preço inválido'),
  available: z.boolean().default(true),
  active: z.boolean().default(true)
});

const optionGroupSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Título é obrigatório'),
  min: z.coerce.number().min(0),
  max: z.coerce.number().min(1),
  required: z.boolean(),
  available: z.boolean().default(true),
  active: z.boolean().default(true),
  options: z.array(optionSchema)
});

const productSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  description: z.string().nullable().optional(),
  price: z.coerce.number().min(0, 'Preço inválido'),
  image: z.string().nullable().optional(),
  categoryId: z.string().min(1, 'Selecione uma categoria'),
  featured: z.boolean(),
  active: z.boolean(),
  available: z.boolean().default(true),
  optionGroups: z.array(optionGroupSchema).default([])
});

const FileInput = ({ label, onChange, value }: { label: string, onChange: (url: string) => void, value?: string }) => {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
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

type ProductForm = z.infer<typeof productSchema>;

export default function AdminProducts() {
  const restaurantId = useTenantStore((state) => state.restaurantId);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      featured: false,
      active: true,
      optionGroups: []
    }
  });

  useEffect(() => {
    fetchData();
  }, [restaurantId]);

  const fetchData = async () => {
    if (!restaurantId) return;
    try {
      const [prods, cats] = await Promise.all([
        supabaseService.getProducts(restaurantId),
        supabaseService.getCategories(restaurantId),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: ProductForm) => {
    if (!restaurantId) return;
    try {
      const productData = {
        name: data.name,
        description: data.description,
        price: data.price,
        image: data.image,
        categoryId: data.categoryId,
        featured: data.featured,
        active: data.active,
        available: data.available,
        optionGroups: data.optionGroups
      };

      if (editingProduct) {
        await supabaseService.updateProduct(editingProduct.id, productData);
        toast.success('Produto atualizado com sucesso');
      } else {
        await supabaseService.createProduct(productData, restaurantId);
        toast.success('Produto criado com sucesso');
      }
      
      setIsModalOpen(false);
      reset();
      setEditingProduct(null);
      fetchData();
    } catch (error) {
      toast.error('Erro ao salvar produto');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setValue('name', product.name);
    setValue('description', product.description);
    setValue('price', product.price);
    setValue('image', product.image);
    setValue('categoryId', product.categoryId);
    setValue('featured', product.featured);
    setValue('active', product.active);
    setValue('available', product.available !== undefined ? product.available : true);
    setValue('optionGroups', (product.optionGroups || []).map(group => ({
      ...group,
      available: group.available !== undefined ? group.available : true,
      active: group.active !== undefined ? group.active : true,
      options: group.options.map(opt => ({
        ...opt,
        available: opt.available !== undefined ? opt.available : true,
        active: opt.active !== undefined ? opt.active : true
      }))
    })));
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
      try {
        await supabaseService.deleteProduct(id);
        toast.success('Produto excluído');
        fetchData();
      } catch (error) {
        toast.error('Erro ao excluir produto');
      }
    }
  };

  const openNewModal = () => {
    setEditingProduct(null);
    reset({
      featured: false,
      active: true,
      available: true,
      optionGroups: []
    });
    setIsModalOpen(true);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Gerenciar Produtos</h1>
        <button
          onClick={openNewModal}
          className="bg-amazii-primary hover:bg-amazii-dark text-white px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Novo Produto
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar produto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amazii-primary/20"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-amazii-primary" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
              <div className="aspect-video bg-gray-100 relative overflow-hidden">
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                {!product.active && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase">Inativo</span>
                  </div>
                )}
                {product.featured && (
                  <div className="absolute top-2 right-2">
                    <span className="bg-yellow-400 text-yellow-900 px-2 py-1 rounded-lg text-xs font-bold uppercase shadow-sm">Destaque</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-gray-900 line-clamp-1">{product.name}</h3>
                    <p className="text-sm text-gray-500">{categories.find(c => c.id === product.categoryId)?.name}</p>
                  </div>
                  <span className="font-bold text-amazii-primary">{formatCurrency(product.price)}</span>
                </div>
                <p className="text-sm text-gray-500 line-clamp-2 mb-4 h-10">
                  {product.description}
                </p>
                
                {product.optionGroups && product.optionGroups.length > 0 && (
                  <div className="mb-4 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                    <Layers className="w-4 h-4" />
                    {product.optionGroups.length} grupos de adicionais
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button 
                    onClick={() => handleEdit(product)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Edit className="w-4 h-4" /> Editar
                  </button>
                  <button 
                    onClick={() => handleDelete(product.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                    <input {...register('name')} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amazii-primary/20" />
                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$)</label>
                    <input type="number" step="0.01" {...register('price')} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amazii-primary/20" />
                    {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                    <select {...register('categoryId')} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amazii-primary/20 bg-white">
                      <option value="">Selecione...</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {errors.categoryId && <p className="text-red-500 text-xs mt-1">{errors.categoryId.message}</p>}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <FileInput 
                      label="Foto do Produto" 
                      value={watch('image')} 
                      onChange={(url) => setValue('image', url)} 
                    />
                    {errors.image && <p className="text-red-500 text-xs mt-1">{errors.image.message}</p>}
                  </div>

                  <div className="flex gap-4 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" {...register('featured')} className="w-4 h-4 text-amazii-primary rounded focus:ring-amazii-primary" />
                      <span className="text-sm font-medium text-gray-700">Destaque</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" {...register('active')} className="w-4 h-4 text-amazii-primary rounded focus:ring-amazii-primary" />
                      <span className="text-sm font-medium text-gray-700">Ativo</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" {...register('available')} className="w-4 h-4 text-amazii-primary rounded focus:ring-amazii-primary" />
                      <span className="text-sm font-medium text-gray-700">Disponível</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea {...register('description')} rows={3} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amazii-primary/20" />
                {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
              </div>

              <ProductOptionManager control={control} register={register} errors={errors} />

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-amazii-primary hover:bg-amazii-dark text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

