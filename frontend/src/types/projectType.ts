export interface ProjectType {
  id: number;
  code: string;
  name_en: string;
  name_bn?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface ProjectTypeCreatePayload {
  code: string;
  name_en: string;
  name_bn?: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface ProjectTypeUpdatePayload {
  code?: string;
  name_en?: string;
  name_bn?: string;
  is_active?: boolean;
  sort_order?: number;
}
