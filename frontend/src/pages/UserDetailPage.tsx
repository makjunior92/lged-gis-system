import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { ArrowLeft, Pencil, RotateCcw, Trash2 } from 'lucide-react';

import { getFormSchema } from '@/api/formSettings';
import { listAllLocations } from '@/api/locations';
import {
  deleteUser,
  getUser,
  resetUserPassword,
  updateUser,
} from '@/api/users';
import DynamicFormRenderer from '@/components/forms/DynamicFormRenderer';
import LocationCascadeSelect from '@/components/forms/LocationCascadeSelect';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Spinner from '@/components/ui/Spinner';
import { useT } from '@/contexts/I18nContext';
import { extractErrorMessage } from '@/lib/api';
import { normalizeNid } from '@/lib/nid';
import { formatDateTime } from '@/lib/utils';
import { isChairmanRole, isStaffRole } from '@/lib/userRole';
import { ROLES, type Role, type User } from '@/types/user';

const CHAIRMAN_SYSTEM_KEYS = new Set(['username', 'nid_number', 'assigned_region', 'address']);
const PIO_UNO_SYSTEM_KEYS = new Set(['username', 'employee_id', 'designation', 'assigned_upazila_key']);

const editSchema = z.object({
  username: z.string().min(3, 'Min 3 chars').max(50),
  full_name: z.string().min(1, 'Required').max(100),
  full_name_bn: z.string().max(150).optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  employee_id: z.string().max(40).optional().or(z.literal('')),
  designation: z.string().max(120).optional().or(z.literal('')),
  role: z.enum(ROLES),
  nid_number: z.string().max(20).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  assigned_region: z.coerce.number().optional().or(z.literal('')),
  assigned_upazila_key: z.string().max(120).optional().or(z.literal('')),
  is_active: z.boolean(),
});
type EditValues = z.input<typeof editSchema>;

function roleTone(role: Role): 'red' | 'amber' | 'blue' | 'green' | 'gray' {
  switch (role) {
    case 'Super Admin': return 'red';
    case 'Admin': return 'amber';
    case 'Chairman': return 'green';
    case 'PIO': return 'blue';
    case 'UNO': return 'gray';
  }
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 sm:grid-cols-3">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800 sm:col-span-2">{value ?? '—'}</dd>
    </div>
  );
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const { t, tRole, locale } = useT();
  const [editing, setEditing] = useState(searchParams.get('edit') === '1');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const userQuery = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUser(userId),
    enabled: Number.isFinite(userId),
  });

  const locationsQuery = useQuery({
    queryKey: ['locations', 'all'],
    queryFn: listAllLocations,
  });

  useEffect(() => {
    setEditing(searchParams.get('edit') === '1');
  }, [searchParams]);

  const resetMut = useMutation({
    mutationFn: () => resetUserPassword(userId),
    onSuccess: (data) => {
      setShowResetConfirm(false);
      toast.success(t('users.tempPwdToast', { user: data.username, pwd: data.temporary_password }), { duration: 10000 });
    },
    onError: (err) => toast.error(extractErrorMessage(err, t('users.resetFailed'))),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteUser(userId),
    onSuccess: () => {
      setShowDeleteConfirm(false);
      toast.success(t('users.deletedToast'));
      qc.invalidateQueries({ queryKey: ['users'] });
      navigate('/users');
    },
    onError: (err) => toast.error(extractErrorMessage(err, t('users.deleteFailed'))),
  });

  if (userQuery.isLoading) {
    return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  }
  if (userQuery.isError || !userQuery.data) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center text-red-700">
        {t('users.notFound')}
        <div className="mt-4">
          <Link to="/users"><Button variant="outline">{t('common.back')}</Button></Link>
        </div>
      </div>
    );
  }

  const user = userQuery.data;
  const displayName = locale === 'bn' && user.full_name_bn ? user.full_name_bn : user.full_name;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/users" className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{displayName}</h1>
            <p className="text-sm text-slate-500">@{user.username}</p>
          </div>
          <Badge tone={roleTone(user.role)}>{tRole(user.role)}</Badge>
          {user.is_active
            ? <Badge tone="green">{t('common.active')}</Badge>
            : <Badge tone="red">{t('common.inactive')}</Badge>}
        </div>
        {!editing && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setSearchParams({ edit: '1' })}>
              <Pencil size={16} />
              {t('common.edit')}
            </Button>
            <Button variant="outline" onClick={() => setShowResetConfirm(true)}>
              <RotateCcw size={16} />
              {t('users.resetPwd')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 size={16} />
              {t('common.delete')}
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <UserEditForm
          user={user}
          locations={locationsQuery.data ?? []}
          locale={locale}
          onCancel={() => {
            setSearchParams({});
            setEditing(false);
          }}
          onSaved={() => {
            setSearchParams({});
            setEditing(false);
            qc.invalidateQueries({ queryKey: ['user', userId] });
            qc.invalidateQueries({ queryKey: ['users'] });
          }}
        />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <dl>
            <DetailRow label={t('common.username')} value={<span className="font-mono">{user.username}</span>} />
            <DetailRow label={t('common.fullNameEn')} value={user.full_name} />
            <DetailRow label={t('common.fullNameBn')} value={user.full_name_bn} />
            <DetailRow label={t('common.role')} value={tRole(user.role)} />

            {isChairmanRole(user.role) && (
              <>
                <div className="border-b border-slate-100 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {t('users.section.chairman')}
                  </p>
                </div>
                <DetailRow label={t('users.nid')} value={user.nid_number} />
                <DetailRow label={t('users.address')} value={user.address} />
                <DetailRow
                  label={t('users.unionParishad')}
                  value={
                    user.region
                      ? `${user.region.district} → ${user.region.upazila} → ${user.region.union_name}`
                      : null
                  }
                />
              </>
            )}

            {isStaffRole(user.role) && (
              <>
                <div className="border-b border-slate-100 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {t('users.section.staff')}
                  </p>
                </div>
                <DetailRow label={t('users.govEmployeeId')} value={user.employee_id} />
                <DetailRow label={t('common.designation')} value={user.designation} />
                <DetailRow label={t('common.email')} value={user.email} />
                {(user.role === 'PIO' || user.role === 'UNO') && (
                  <DetailRow
                    label={t('users.upazilaKey')}
                    value={user.assigned_upazila_key?.replace('|', ' → ')}
                  />
                )}
              </>
            )}

            {Object.entries(user.custom_data ?? {}).map(([key, val]) => (
              <DetailRow key={key} label={key} value={String(val)} />
            ))}
            <DetailRow label={t('users.col.lastLogin')} value={formatDateTime(user.last_login)} />
            <DetailRow label={t('users.createdAt')} value={formatDateTime(user.created_at)} />
          </dl>
        </div>
      )}

      <ConfirmDialog
        open={showResetConfirm}
        title={t('users.resetConfirmTitle')}
        message={t('users.resetConfirmBody', { user: user.username })}
        variant="danger"
        isLoading={resetMut.isPending}
        onConfirm={() => resetMut.mutate()}
        onCancel={() => setShowResetConfirm(false)}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        title={t('users.deleteConfirmTitle')}
        message={t('users.deleteConfirm', { user: user.username })}
        variant="danger"
        confirmLabel={t('common.delete')}
        isLoading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

function UserEditForm({
  user,
  locations,
  locale,
  onCancel,
  onSaved,
}: {
  user: User;
  locations: import('@/types/location').LocationNode[];
  locale: 'en' | 'bn';
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { t, tRole } = useT();
  const defaultValues = useMemo((): EditValues & Record<string, unknown> => ({
    username: user.username,
    full_name: user.full_name,
    full_name_bn: user.full_name_bn ?? '',
    email: user.email ?? '',
    employee_id: user.employee_id ?? '',
    designation: user.designation ?? '',
    role: user.role,
    nid_number: user.nid_number ?? '',
    address: user.address ?? '',
    assigned_region: user.assigned_region ?? '',
    assigned_upazila_key: user.assigned_upazila_key ?? '',
    is_active: user.is_active,
    ...user.custom_data,
  }), [user]);

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EditValues & Record<string, unknown>>({
    resolver: zodResolver(editSchema),
    defaultValues,
  });

  const selectedRole = watch('role');
  const assignedRegion = watch('assigned_region');
  const assignedUpazilaKey = watch('assigned_upazila_key');

  const chairmanSchemaQuery = useQuery({
    queryKey: ['form-schema', 'chairman_user_create'],
    queryFn: () => getFormSchema('chairman_user_create'),
    enabled: selectedRole === 'Chairman',
  });
  const pioSchemaQuery = useQuery({
    queryKey: ['form-schema', 'pio_user_create'],
    queryFn: () => getFormSchema('pio_user_create'),
    enabled: selectedRole === 'PIO',
  });
  const unoSchemaQuery = useQuery({
    queryKey: ['form-schema', 'uno_user_create'],
    queryFn: () => getFormSchema('uno_user_create'),
    enabled: selectedRole === 'UNO',
  });

  const updateMut = useMutation({
    mutationFn: (payload: Parameters<typeof updateUser>[1]) => updateUser(user.id, payload),
    onSuccess: () => {
      toast.success(t('users.updatedToast'));
      onSaved();
    },
    onError: (err) => toast.error(extractErrorMessage(err, t('users.updateFailed'))),
  });

  function collectCustomData(values: EditValues & Record<string, unknown>, systemKeys: Set<string>) {
    const exclude = new Set([
      ...systemKeys,
      'full_name', 'full_name_bn', 'email', 'employee_id', 'designation', 'role',
      'assigned_region', 'assigned_upazila_key', 'nid_number', 'address', 'is_active',
    ]);
    const custom_data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      if (!exclude.has(k) && v !== '' && v != null) custom_data[k] = v;
    }
    return custom_data;
  }

  function onSubmit(values: EditValues & Record<string, unknown>) {
    const role = values.role as Role;
    const payload: Parameters<typeof updateUser>[1] = {
      username: String(values.username),
      full_name: values.full_name,
      full_name_bn: values.full_name_bn || undefined,
      role,
      is_active: values.is_active,
    };

    if (isChairmanRole(role)) {
      payload.nid_number = normalizeNid(String(values.nid_number ?? ''));
      payload.address = values.address ? String(values.address) : undefined;
      payload.assigned_region = values.assigned_region ? Number(values.assigned_region) : null;
      payload.employee_id = null;
      payload.designation = null;
      payload.assigned_upazila_key = null;
      payload.custom_data = collectCustomData(values, CHAIRMAN_SYSTEM_KEYS);
    } else if (role === 'PIO' || role === 'UNO') {
      payload.employee_id = values.employee_id ? String(values.employee_id) : undefined;
      payload.designation = values.designation ? String(values.designation) : undefined;
      payload.email = values.email || undefined;
      payload.assigned_upazila_key = values.assigned_upazila_key || undefined;
      payload.nid_number = null;
      payload.address = null;
      payload.assigned_region = null;
      payload.custom_data = collectCustomData(values, PIO_UNO_SYSTEM_KEYS);
    } else {
      payload.email = values.email || undefined;
      payload.employee_id = values.employee_id ? String(values.employee_id) : null;
      payload.designation = values.designation || undefined;
      payload.nid_number = null;
      payload.address = null;
      payload.assigned_region = null;
      payload.assigned_upazila_key = null;
    }

    updateMut.mutate(payload);
  }

  const isPioUnoRole = selectedRole === 'PIO' || selectedRole === 'UNO';
  const staffSchema = selectedRole === 'PIO' ? pioSchemaQuery.data : unoSchemaQuery.data;

  return (
    <form onSubmit={handleSubmit(onSubmit as (v: EditValues & Record<string, unknown>) => void)} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <Input label={t('common.username')} required {...register('username')} error={errors.username?.message} />
        <Select label={t('common.role')} required {...register('role')} error={errors.role?.message}>
          {ROLES.map((r) => <option key={r} value={r}>{tRole(r)}</option>)}
        </Select>
        <Input label={t('common.fullNameEn')} required {...register('full_name')} error={errors.full_name?.message} />
        <Input label={t('common.fullNameBn')} {...register('full_name_bn')} />
        <Select
          label={t('common.status')}
          value={watch('is_active') ? 'true' : 'false'}
          onChange={(e) => setValue('is_active', e.target.value === 'true')}
        >
          <option value="true">{t('common.active')}</option>
          <option value="false">{t('common.inactive')}</option>
        </Select>
      </div>

      {isChairmanRole(selectedRole) && chairmanSchemaQuery.data && (
        <div className="space-y-3 rounded-md border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">{t('users.chairmanIdHint')}</p>
          <DynamicFormRenderer
            fields={chairmanSchemaQuery.data.fields}
            register={register as never}
            control={control as never}
            setValue={setValue as never}
            errors={errors as never}
            locations={locations}
            locale={locale}
            hiddenKeys={new Set(['assigned_region', 'username'])}
          />
          <LocationCascadeSelect
            mode="union"
            locations={locations}
            valueLocationId={assignedRegion}
            onLocationIdChange={(id) => setValue('assigned_region', id, { shouldValidate: true })}
            required
          />
        </div>
      )}

      {isPioUnoRole && staffSchema && (
        <div className="space-y-3 rounded-md border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">{t('users.govEmployeeIdHint')}</p>
          <DynamicFormRenderer
            fields={staffSchema.fields}
            register={register as never}
            control={control as never}
            setValue={setValue as never}
            errors={errors as never}
            locations={locations}
            locale={locale}
            hiddenKeys={new Set(['assigned_upazila_key', 'username'])}
          />
          <LocationCascadeSelect
            mode="upazila"
            locations={locations}
            valueUpazilaKey={assignedUpazilaKey}
            onUpazilaKeyChange={(key) => setValue('assigned_upazila_key', key, { shouldValidate: true })}
            required
          />
        </div>
      )}

      {!isChairmanRole(selectedRole) && !isPioUnoRole && (
        <div className="grid gap-3 md:grid-cols-2">
          <Input label={t('common.email')} type="email" {...register('email')} />
          <Input
            label={t('users.govEmployeeId')}
            {...register('employee_id')}
            placeholder="LGED-1234"
            hint={t('users.govEmployeeIdHint')}
          />
          <Input label={t('common.designation')} {...register('designation')} />
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit" isLoading={isSubmitting || updateMut.isPending}>{t('common.save')}</Button>
      </div>
    </form>
  );
}
