import { FC } from 'react';
import { useFieldArray, Control, UseFormRegister, useWatch } from 'react-hook-form';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { ProductOptionGroup } from '@/services/types';

interface ProductOptionManagerProps {
  control: Control<any>;
  register: UseFormRegister<any>;
  errors: any;
}

interface OptionItemProps {
  control: Control<any>;
  register: UseFormRegister<any>;
  groupIndex: number;
  optionIndex: number;
  remove: () => void;
}

const OptionItem: FC<OptionItemProps> = ({ 
  control, 
  register, 
  groupIndex, 
  optionIndex, 
  remove 
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center mb-2 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
      <div className="flex-1 w-full sm:w-auto">
        <input
          {...register(`optionGroups.${groupIndex}.options.${optionIndex}.name` as const)}
          placeholder="Nome da opção (ex: Morango)"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amazii-primary/20"
        />
      </div>
      <div className="w-full sm:w-24">
        <input
          type="number"
          step="0.01"
          {...register(`optionGroups.${groupIndex}.options.${optionIndex}.price` as const)}
          placeholder="Preço"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amazii-primary/20"
        />
      </div>
      
      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
        <label className="flex items-center gap-2 cursor-pointer" title="Disponível para venda">
          <input
            type="checkbox"
            {...register(`optionGroups.${groupIndex}.options.${optionIndex}.available` as const)}
            className="w-4 h-4 text-amazii-primary rounded focus:ring-amazii-primary"
          />
          <span className="text-xs text-gray-600 sm:hidden">Disponível</span>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer" title="Ativo no sistema">
          <input
            type="checkbox"
            {...register(`optionGroups.${groupIndex}.options.${optionIndex}.active` as const)}
            className="w-4 h-4 text-amazii-primary rounded focus:ring-amazii-primary"
          />
          <span className="text-xs text-gray-600 sm:hidden">Ativo</span>
        </label>

        <button
          type="button"
          onClick={remove}
          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-auto sm:ml-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

interface OptionGroupProps {
  control: Control<any>;
  register: UseFormRegister<any>;
  groupIndex: number;
  removeGroup: () => void;
  errors: any;
}

const OptionGroup: FC<OptionGroupProps> = ({ 
  control, 
  register, 
  groupIndex, 
  removeGroup, 
  errors 
}) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `optionGroups.${groupIndex}.options`
  });

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 mb-4">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Título do Grupo</label>
            <input
              {...register(`optionGroups.${groupIndex}.title` as const)}
              placeholder="Ex: Escolha o Tamanho"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amazii-primary/20"
            />
            {errors?.optionGroups?.[groupIndex]?.title && (
              <p className="text-red-500 text-xs mt-1">{errors.optionGroups[groupIndex].title.message}</p>
            )}
          </div>
          
          <div className="flex gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mínimo</label>
              <input
                type="number"
                {...register(`optionGroups.${groupIndex}.min` as const)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amazii-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Máximo</label>
              <input
                type="number"
                {...register(`optionGroups.${groupIndex}.max` as const)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amazii-primary/20"
              />
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register(`optionGroups.${groupIndex}.required` as const)}
              className="w-4 h-4 text-amazii-primary rounded focus:ring-amazii-primary"
            />
            <span className="text-xs font-medium text-gray-700">Obrigatório</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register(`optionGroups.${groupIndex}.available` as const)}
              defaultChecked={true}
              className="w-4 h-4 text-amazii-primary rounded focus:ring-amazii-primary"
            />
            <span className="text-xs font-medium text-gray-700">Disponível</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register(`optionGroups.${groupIndex}.active` as const)}
              defaultChecked={true}
              className="w-4 h-4 text-amazii-primary rounded focus:ring-amazii-primary"
            />
            <span className="text-xs font-medium text-gray-700">Ativo</span>
          </label>
          <button
            type="button"
            onClick={removeGroup}
            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-2"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700 mb-1">Opções</label>
        {fields.map((field, index) => (
          <OptionItem
            key={field.id}
            control={control}
            register={register}
            groupIndex={groupIndex}
            optionIndex={index}
            remove={() => remove(index)}
          />
        ))}
        
        <button
          type="button"
          onClick={() => append({ id: crypto.randomUUID(), name: '', price: 0, available: true, active: true })}
          className="text-sm text-amazii-primary hover:text-amazii-dark font-medium flex items-center gap-1 mt-2"
        >
          <Plus className="w-4 h-4" /> Adicionar Opção
        </button>
      </div>
    </div>
  );
};

export default function ProductOptionManager({ control, register, errors }: ProductOptionManagerProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "optionGroups"
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <label className="block text-sm font-medium text-gray-700">Grupos de Adicionais/Opções</label>
        <button
          type="button"
          onClick={() => append({
            id: crypto.randomUUID(),
            title: '',
            min: 0,
            max: 1,
            required: false,
            available: true,
            active: true,
            options: []
          })}
          className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Novo Grupo
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500 text-sm">
          Nenhum grupo de opções configurado.
        </div>
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <OptionGroup
              key={field.id}
              control={control}
              register={register}
              groupIndex={index}
              removeGroup={() => remove(index)}
              errors={errors}
            />
          ))}
        </div>
      )}
    </div>
  );
}

