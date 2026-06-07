import { Fragment, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Eye, Pencil, Plus, Power, PowerOff, RotateCcw, Search, X } from 'lucide-react';

import { getFormSchema } from '@/api/formSettings';
import { listAllLocations } from '@/api/locations';
import DynamicFormRenderer from '@/components/forms/DynamicFormRenderer';
import LocationCascadeSelect from '@/components/forms/LocationCascadeSelect';
import {
  createUser,
  listUsers,
  resetUserPassword,
  updateUser,
  type UserListFilters,
} from '@/api/users';
import { ROLES, type Role, type User } from '@/types/user';
import { extractErrorMessage } from '@/lib/api';
import { normalizeNid } from '@/lib/nid';
import { userListIdentifier } from '@/lib/userRole';
import { useT } from '@/contexts/I18nContext';

import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const PAGE_SIZE = 15;

const createSchema = z.object({
  username: z.string().min(3, 'Min 3 chars').max(50).optional().or(z.literal('')),
  password: z.string().min(8, 'Min 8 chars').max(200),
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
});
type CreateValues = z.input<typeof createSchema>;

function roleTone(role: Role): 'red' | 'amber' | 'blue' | 'green' | 'gray' {
  switch (role) {
    case 'Super Admin': return 'red';
    case 'Admin': return 'amber';
    case 'Chairman': return 'green';
    case 'PIO': return 'blue';
    case 'UNO': return 'gray';
  }
}

const CHAIRMAN_SYSTEM_KEYS = new Set(['username', 'nid_number', 'assigned_region', 'address']);
const PIO_UNO_SYSTEM_KEYS = new Set(['username', 'employee_id', 'designation', 'assigned_upazila_key']);

type PendingUserAction =
  | { type: 'reset'; user: User }
  | { type: 'toggleActive'; user: User };

export default function UserManagementPage() {
  const qc = useQueryClient();
  const { t, tRole, locale } = useT();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingUserAction | null>(null);

  const filters: UserListFilters = useMemo(
    () => ({
      page,
      page_size: PAGE_SIZE,
      ...(search ? { search } : {}),
      ...(role ? { role } : {}),
      ...(activeFilter === 'all' ? {} : { is_active: activeFilter === 'active' }),
    }),
    [page, search, role, activeFilter],
  );

  const usersQuery = useQuery({
    queryKey: ['users', filters],
    queryFn: () => listUsers(filters),
    placeholderData: (prev) => prev,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof updateUser>[1] }) =>
      updateUser(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (err) => toast.error(extractErrorMessage(err, t('users.updateFailed'))),
  });

  const resetMut = useMutation({
    mutationFn: (id: number) => resetUserPassword(id),
    onSuccess: (data) => {
      setPendingAction(null);
      toast.success(t('users.tempPwdToast', { user: data.username, pwd: data.temporary_password }), { duration: 10000 });
    },
    onError: (err) => toast.error(extractErrorMessage(err, t('users.resetFailed'))),
  });

  function confirmPendingAction() {
    if (!pendingAction) return;
    if (pendingAction.type === 'reset') {
      resetMut.mutate(pendingAction.user.id);
      return;
    }
    updateMut.mutate(
      { id: pendingAction.user.id, payload: { is_active: !pendingAction.user.is_active } },
      { onSuccess: () => setPendingAction(null) },
    );
  }

  const confirmDialog = (() => {
    if (!pendingAction) return null;
    const name = pendingAction.user.username;
    if (pendingAction.type === 'reset') {
      return {
        title: t('users.resetConfirmTitle'),
        message: t('users.resetConfirmBody', { user: name }),
        variant: 'danger' as const,
        isLoading: resetMut.isPending,
      };
    }
    if (pendingAction.user.is_active) {
      return {
        title: t('users.deactivateConfirmTitle'),
        message: t('users.deactivateConfirmBody', { user: name }),
        variant: 'danger' as const,
        isLoading: updateMut.isPending,
      };
    }
    return {
      title: t('users.activateConfirmTitle'),
      message: t('users.activateConfirmBody', { user: name }),
      variant: 'default' as const,
      isLoading: updateMut.isPending,
    };
  })();

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{t('users.title')}</h2>
          <p className="text-sm text-slate-500">{t('users.subtitle')}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          {t('users.addBtn')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={t('users.searchPlaceholder')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
        </div>
        <Select value={role} onChange={(e) => { setRole(e.target.value as Role | ''); setPage(1); }}>
          <option value="">{t('common.allRoles')}</option>
          {ROLES.map((r) => <option key={r} value={r}>{tRole(r)}</option>)}
        </Select>
        <Select
          value={activeFilter}
          onChange={(e) => { setActiveFilter(e.target.value as 'all' | 'active' | 'inactive'); setPage(1); }}
        >
          <option value="all">{t('common.activeAndInactive')}</option>
          <option value="active">{t('common.activeOnly')}</option>
          <option value="inactive">{t('common.inactiveOnly')}</option>
        </Select>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-200 bg-white">
        {usersQuery.isLoading && (
          <div className="flex flex-1 items-center justify-center"><Spinner /></div>
        )}
        {usersQuery.isError && (
          <div className="flex flex-1 items-center justify-center text-sm text-danger-500">
            {t('users.failed')}
          </div>
        )}
        {usersQuery.data && (
          <>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[640px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[38%]" />
                  <col className="w-[24%]" />
                  <col className="w-[14%]" />
                  <col className="w-[24%]" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">{t('users.col.user')}</th>
                    <th className="hidden px-4 py-2.5 sm:table-cell">{t('users.col.reference')}</th>
                    <th className="px-4 py-2.5">{t('users.col.status')}</th>
                    <th className="px-4 py-2.5 text-right">{t('users.col.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersQuery.data.items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                        {t('users.empty')}
                      </td>
                    </tr>
                  )}
                  {usersQuery.data.items.map((u) => {
                    const primary = locale === 'bn' && u.full_name_bn ? u.full_name_bn : u.full_name;
                    const ref = userListIdentifier(u);
                    const isUpdating = updateMut.isPending && updateMut.variables?.id === u.id;
                    const isResetting = resetMut.isPending && resetMut.variables === u.id;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <Link
                              to={`/users/${u.id}`}
                              className="truncate font-medium text-slate-800 hover:text-brand-600 hover:underline"
                            >
                              {primary}
                            </Link>
                            <Badge tone={roleTone(u.role)}>{tRole(u.role)}</Badge>
                          </div>
                          <p className="mt-0.5 font-mono text-xs text-slate-500">@{u.username}</p>
                          <p className="mt-0.5 font-mono text-xs text-slate-400 sm:hidden">{ref.primary}</p>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <span className="font-mono text-xs text-slate-700">{ref.primary}</span>
                        </td>
                        <td className="px-4 py-3">
                          {u.is_active
                            ? <Badge tone="green">{t('common.active')}</Badge>
                            : <Badge tone="red">{t('common.inactive')}</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                            <Link to={`/users/${u.id}`} title={t('users.viewDetails')}>
                              <Button size="sm" variant="ghost" className="h-9 w-9 shrink-0 p-0" aria-label={t('users.viewDetails')}>
                                <Eye size={18} />
                              </Button>
                            </Link>
                            <Link to={`/users/${u.id}?edit=1`} title={t('common.edit')}>
                              <Button size="sm" variant="ghost" className="h-9 w-9 shrink-0 p-0" aria-label={t('common.edit')}>
                                <Pencil size={18} />
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 w-9 shrink-0 p-0"
                              title={u.is_active ? t('common.deactivate') : t('common.activate')}
                              aria-label={u.is_active ? t('common.deactivate') : t('common.activate')}
                              onClick={() => setPendingAction({ type: 'toggleActive', user: u })}
                              isLoading={isUpdating}
                            >
                              {u.is_active ? <PowerOff size={18} /> : <Power size={18} />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 w-9 shrink-0 p-0"
                              title={t('users.resetPwd')}
                              aria-label={t('users.resetPwd')}
                              onClick={() => setPendingAction({ type: 'reset', user: u })}
                              isLoading={isResetting}
                            >
                              <RotateCcw size={18} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-200">
              <Pagination
                page={usersQuery.data.page}
                totalPages={usersQuery.data.total_pages}
                total={usersQuery.data.total}
                pageSize={usersQuery.data.page_size}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ['users'] });
          }}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          open
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          isLoading={confirmDialog.isLoading}
          onConfirm={confirmPendingAction}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t, tRole, locale } = useT();
  const locationsQuery = useQuery({
    queryKey: ['locations', 'all'],
    queryFn: listAllLocations,
  });
  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'Chairman' },
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

  const mut = useMutation({
    mutationFn: createUser,
    onSuccess: (u) => {
      toast.success(t('users.createdToast', { user: u.username }));
      onCreated();
    },
    onError: (err) => toast.error(extractErrorMessage(err, t('users.createFailed'))),
  });

  function collectCustomData(
    values: CreateValues & Record<string, unknown>,
    systemKeys: Set<string>,
    extraExclude: string[],
  ) {
    const custom_data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      if (
        !systemKeys.has(k) &&
        !extraExclude.includes(k) &&
        v !== '' &&
        v != null
      ) {
        custom_data[k] = v;
      }
    }
    return custom_data;
  }

  function onSubmit(values: CreateValues & Record<string, unknown>) {
    const baseExclude = ['password', 'full_name', 'full_name_bn', 'email', 'employee_id', 'designation', 'role', 'assigned_region', 'assigned_upazila_key', 'nid_number', 'address'];

    if (values.role === 'Chairman') {
      const custom_data = collectCustomData(values, CHAIRMAN_SYSTEM_KEYS, baseExclude);
      mut.mutate({
        username: String(values.username),
        password: values.password,
        full_name: values.full_name,
        full_name_bn: values.full_name_bn || undefined,
        role: 'Chairman',
        nid_number: normalizeNid(String(values.nid_number ?? '')),
        address: values.address ? String(values.address) : undefined,
        assigned_region: values.assigned_region ? Number(values.assigned_region) : undefined,
        custom_data: Object.keys(custom_data).length ? custom_data : undefined,
      });
      return;
    }

    if (values.role === 'PIO' || values.role === 'UNO') {
      const custom_data = collectCustomData(values, PIO_UNO_SYSTEM_KEYS, baseExclude);
      mut.mutate({
        username: String(values.username),
        password: values.password,
        full_name: values.full_name,
        full_name_bn: values.full_name_bn || undefined,
        email: values.email || (custom_data.email as string | undefined),
        employee_id: values.employee_id ? String(values.employee_id) : undefined,
        designation: values.designation ? String(values.designation) : undefined,
        role: values.role as Role,
        assigned_upazila_key: values.assigned_upazila_key || undefined,
        custom_data: Object.keys(custom_data).length ? custom_data : undefined,
      });
      return;
    }

    mut.mutate({
      username: String(values.username),
      password: values.password,
      full_name: values.full_name,
      full_name_bn: values.full_name_bn || undefined,
      email: values.email || undefined,
      employee_id: values.employee_id || undefined,
      designation: values.designation || undefined,
      role: values.role as Role,
    });
  }

  const isStaffRole = selectedRole === 'PIO' || selectedRole === 'UNO';
  const staffSchema = selectedRole === 'PIO' ? pioSchemaQuery.data : unoSchemaQuery.data;

  return (
    <Fragment>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(640px,95vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-base font-semibold text-slate-800">{t('users.createTitle')}</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
          <Select label={t('common.role')} required {...register('role')} error={errors.role?.message}>
            {ROLES.map((r) => <option key={r} value={r}>{tRole(r)}</option>)}
          </Select>
          <Input
            label={t('common.password')}
            type="password"
            required
            {...register('password')}
            error={errors.password?.message}
            hint={t('common.minChars', { n: 8 })}
          />
          <Input label={t('common.fullNameEn')} required {...register('full_name')} error={errors.full_name?.message} />
          <Input label={t('common.fullNameBn')} {...register('full_name_bn')} error={errors.full_name_bn?.message as string | undefined} />

          {selectedRole === 'Chairman' && chairmanSchemaQuery.data && (
            <div className="md:col-span-2 space-y-3 rounded-md border border-slate-100 bg-slate-50 p-3">
              <DynamicFormRenderer
                fields={chairmanSchemaQuery.data.fields}
                register={register as never}
                control={control as never}
                setValue={setValue as never}
                errors={errors as never}
                locations={locationsQuery.data ?? []}
                locale={locale}
                hiddenKeys={new Set(['assigned_region'])}
              />
              <LocationCascadeSelect
                mode="union"
                locations={locationsQuery.data ?? []}
                valueLocationId={assignedRegion}
                onLocationIdChange={(id) => setValue('assigned_region', id, { shouldValidate: true })}
                error={errors.assigned_region?.message as string | undefined}
                required
              />
            </div>
          )}

          {isStaffRole && staffSchema && (
            <div className="md:col-span-2 space-y-3 rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{t('users.govEmployeeIdHint')}</p>
              <DynamicFormRenderer
                fields={staffSchema.fields}
                register={register as never}
                control={control as never}
                setValue={setValue as never}
                errors={errors as never}
                locations={locationsQuery.data ?? []}
                locale={locale}
                hiddenKeys={new Set(['assigned_upazila_key'])}
              />
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  {t('users.upazilaKey')}
                  <span className="text-red-500"> *</span>
                </p>
                <LocationCascadeSelect
                  mode="upazila"
                  locations={locationsQuery.data ?? []}
                  valueUpazilaKey={assignedUpazilaKey}
                  onUpazilaKeyChange={(key) => setValue('assigned_upazila_key', key, { shouldValidate: true })}
                  error={errors.assigned_upazila_key?.message as string | undefined}
                  required
                />
              </div>
            </div>
          )}

          {selectedRole !== 'Chairman' && !isStaffRole && (
            <>
              <Input label={t('common.username')} required {...register('username')} error={errors.username?.message} />
              <Input label={t('common.email')} type="email" {...register('email')} error={errors.email?.message as string | undefined} />
              <Input
                label={t('users.govEmployeeId')}
                {...register('employee_id')}
                error={errors.employee_id?.message as string | undefined}
                placeholder="LGED-1234"
                hint={t('users.govEmployeeIdHint')}
              />
              <Input label={t('common.designation')} {...register('designation')} error={errors.designation?.message as string | undefined} />
            </>
          )}

          {selectedRole === 'Chairman' && (
            <p className="md:col-span-2 text-xs text-slate-500">{t('users.chairmanIdHint')}</p>
          )}

          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" isLoading={isSubmitting || mut.isPending}>{t('common.create')}</Button>
          </div>
        </form>
      </div>
    </Fragment>
  );
}
