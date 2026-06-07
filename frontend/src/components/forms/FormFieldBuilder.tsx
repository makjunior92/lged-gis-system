import { Plus, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useT } from '@/contexts/I18nContext';
import type { FieldType, FormFieldDefinition } from '@/types/form';

const FIELD_TYPES: FieldType[] = ['text', 'textarea', 'number', 'date', 'select', 'map_coords'];

interface Props {
  fields: FormFieldDefinition[];
  onChange: (fields: FormFieldDefinition[]) => void;
  systemFieldKeys: Set<string>;
  showPioOptions?: boolean;
  showUnoOptions?: boolean;
}

export default function FormFieldBuilder({
  fields,
  onChange,
  systemFieldKeys,
  showPioOptions = false,
  showUnoOptions = false,
}: Props) {
  const { t } = useT();

  function updateField(index: number, patch: Partial<FormFieldDefinition>) {
    const next = fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    onChange(next);
  }

  function removeField(index: number) {
    const field = fields[index];
    if (systemFieldKeys.has(field.field_key)) return;
    onChange(fields.filter((_, i) => i !== index));
  }

  function addField() {
    onChange([
      ...fields,
      {
        field_key: `custom_${Date.now()}`,
        label_en: 'New Field',
        field_type: 'text',
        is_system: false,
        is_required: false,
        display_order: fields.length,
        visible_to_chairman: !showUnoOptions,
        editable_by_pio: false,
        editable_by_uno: showUnoOptions,
        visible_to_uno: showUnoOptions || true,
      },
    ]);
  }

  return (
    <div className="space-y-4">
      {fields.map((field, index) => (
        <div
          key={`${field.field_key}-${index}`}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              {field.label_en}
              {field.is_system && (
                <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                  {t('settings.systemField')}
                </span>
              )}
            </span>
            {!systemFieldKeys.has(field.field_key) && (
              <button
                type="button"
                onClick={() => removeField(index)}
                className="text-red-500 hover:text-red-700"
                aria-label={t('common.delete')}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              label={t('settings.fieldKey')}
              value={field.field_key}
              disabled={field.is_system}
              onChange={(e) => updateField(index, { field_key: e.target.value })}
            />
            <Input
              label={t('settings.labelEn')}
              value={field.label_en}
              onChange={(e) => updateField(index, { label_en: e.target.value })}
            />
            <Input
              label={t('settings.labelBn')}
              value={field.label_bn ?? ''}
              onChange={(e) => updateField(index, { label_bn: e.target.value })}
            />
            <Select
              label={t('settings.fieldType')}
              value={field.field_type}
              disabled={
                field.is_system &&
                ['project_type_id', 'location_id', 'latitude', 'longitude', 'district'].includes(
                  field.field_key,
                )
              }
              onChange={(e) => updateField(index, { field_type: e.target.value as FieldType })}
            >
              {FIELD_TYPES.map((ft) => (
                <option key={ft} value={ft}>
                  {ft}
                </option>
              ))}
            </Select>
            <Input
              label={t('settings.section')}
              value={field.section ?? ''}
              onChange={(e) => updateField(index, { section: e.target.value })}
            />
            <Input
              type="number"
              label={t('settings.order')}
              value={field.display_order}
              onChange={(e) => updateField(index, { display_order: Number(e.target.value) })}
            />
          </div>

          {field.field_type === 'select' && (
            <div className="mt-3">
              <label className="text-sm font-medium text-slate-700">{t('settings.selectOptions')}</label>
              <textarea
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
                rows={3}
                placeholder={'value1:Label 1\nvalue2:Label 2'}
                value={(field.options_json ?? [])
                  .map((o) =>
                    typeof o === 'object' ? `${o.value}:${o.label}` : String(o),
                  )
                  .join('\n')}
                onChange={(e) => {
                  const options = e.target.value
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line) => {
                      const [value, ...rest] = line.split(':');
                      return { value: value.trim(), label: (rest.join(':') || value).trim() };
                    });
                  updateField(index, { options_json: options });
                }}
              />
              <p className="mt-1 text-xs text-slate-500">{t('settings.selectOptionsHint')}</p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={field.is_required}
                disabled={field.is_system && systemFieldKeys.has(field.field_key)}
                onChange={(e) => updateField(index, { is_required: e.target.checked })}
              />
              {t('common.required')}
            </label>
            {!showUnoOptions && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={field.visible_to_chairman}
                  onChange={(e) => updateField(index, { visible_to_chairman: e.target.checked })}
                />
                {t('settings.visibleChairman')}
              </label>
            )}
            {showPioOptions && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={field.editable_by_pio}
                  onChange={(e) => updateField(index, { editable_by_pio: e.target.checked })}
                />
                {t('settings.pioEditable')}
              </label>
            )}
            {showUnoOptions && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={field.editable_by_uno}
                  disabled={field.field_key === 'uno_decision'}
                  onChange={(e) => updateField(index, { editable_by_uno: e.target.checked })}
                />
                {t('settings.unoEditable')}
              </label>
            )}
          </div>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={addField}>
        <Plus size={16} className="mr-1" />
        {t('settings.addField')}
      </Button>
    </div>
  );
}
