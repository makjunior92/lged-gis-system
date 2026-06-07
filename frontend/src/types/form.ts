export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'map_coords';

export type FormSchemaKey =
  | 'project_submission'
  | 'chairman_user_create'
  | 'pio_user_create'
  | 'uno_user_create'
  | 'pio_review'
  | 'uno_review';

export interface FormFieldDefinition {
  id?: number;
  schema_id?: number;
  field_key: string;
  label_en: string;
  label_bn?: string | null;
  field_type: FieldType;
  is_system: boolean;
  is_required: boolean;
  display_order: number;
  section?: string | null;
  options_json?: Array<{ value: string; label: string } | string> | null;
  validation_json?: Record<string, number | string> | null;
  visible_to_chairman: boolean;
  editable_by_pio: boolean;
  editable_by_uno: boolean;
  visible_to_uno: boolean;
}

export interface FormSchema {
  id: number;
  key: FormSchemaKey;
  version: number;
  updated_at: string;
  fields: FormFieldDefinition[];
}

export interface FieldPermissionUpdate {
  field_key: string;
  editable_by_pio: boolean;
  editable_by_uno?: boolean;
  visible_to_uno?: boolean;
}
