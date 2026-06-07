import { api } from '@/lib/api';
import type { FieldPermissionUpdate, FormFieldDefinition, FormSchema, FormSchemaKey } from '@/types/form';

export async function getFormSchema(key: FormSchemaKey): Promise<FormSchema> {
  const res = await api.get<FormSchema>(`/settings/forms/${key}`);
  return res.data;
}

export async function updateFormSchema(
  key: FormSchemaKey,
  fields: FormFieldDefinition[],
): Promise<FormSchema> {
  const res = await api.put<FormSchema>(`/settings/forms/${key}`, { fields });
  return res.data;
}

export async function updateFieldPermissions(
  key: FormSchemaKey,
  permissions: FieldPermissionUpdate[],
): Promise<FormFieldDefinition[]> {
  const res = await api.put<FormFieldDefinition[]>(`/settings/forms/${key}/field-permissions`, {
    permissions,
  });
  return res.data;
}
