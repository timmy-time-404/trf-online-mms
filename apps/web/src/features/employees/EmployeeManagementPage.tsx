import React from 'react';
import {
  CalendarDays,
  Check,
  Copy,
  Edit3,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserRound,
  UserX,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  createEmployeeOnboarding,
  createEmployeeOperationKey,
  dispatchEmployeeManagementUpdated,
  getEmployeeManagementMasterData,
  listEmployeeManagementRecords,
  resetEmployeeTemporaryPassword,
  setEmployeeManagementActive,
  updateEmployeeManagement,
  type EmployeeManagementMasterData,
  type EmployeeManagementRecord,
  type TemporaryCredential,
} from '@/lib/employeeManagementApi';
import { cn } from '@/lib/utils';
import {
  useAuthStore,
  useTRFStore,
} from '@/store';

type EmployeeFormMode =
  | 'CREATE'
  | 'EDIT';

interface EmployeeFormState {
  employeeCode: string;
  employeeName: string;
  employeeType:
    | 'EMPLOYEE'
    | 'VISITOR';
  email: string;
  phone: string;
  department: string;
  section: string;
  jobTitle: string;
  joinDate: string;
  pointOfHire: string;

  rosterCode: string;
  siteLocationId: string;
  plannedD1: string;
}

interface EmployeeFormDialogState {
  mode: EmployeeFormMode;
  employee: EmployeeManagementRecord | null;
  form: EmployeeFormState;
}

interface EmployeeActionDialogState {
  action:
    | 'SET_ACTIVE'
    | 'RESET_PASSWORD';
  employee: EmployeeManagementRecord;
  nextActive?: boolean;
  remarks: string;
}

const EMPTY_MASTER_DATA: EmployeeManagementMasterData = {
  departments: [],
  rosters: [],
  sites: [],
  employee_types: [
    'EMPLOYEE',
    'VISITOR',
  ],
};

const EMPTY_FORM: EmployeeFormState = {
  employeeCode: '',
  employeeName: '',
  employeeType: 'EMPLOYEE',
  email: '',
  phone: '',
  department: '',
  section: '',
  jobTitle: '',
  joinDate: '',
  pointOfHire: '',

  rosterCode: '',
  siteLocationId: '',
  plannedD1: '',
};

const formatDate = (
  value?: string | null,
): string => {
  if (!value) return '-';

  const date = new Date(
    `${value}T00:00:00`,
  );

  if (
    Number.isNaN(date.getTime())
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'id-ID',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  ).format(date);
};

const normalizeSearch = (
  value: string,
): string =>
  value
    .trim()
    .toLocaleLowerCase('id-ID');

const isSevenDigitEmployeeCode = (
  value: string,
): boolean =>
  /^[0-9]{7}$/.test(value);

const createFormForRecord = (
  record: EmployeeManagementRecord,
): EmployeeFormState => ({
  employeeCode:
    record.employee_code,
  employeeName:
    record.employee_name,
  employeeType:
    record.employee_type ??
    'EMPLOYEE',
  email: record.email ?? '',
  phone: record.phone ?? '',
  department:
    record.department ?? '',
  section: record.section ?? '',
  jobTitle:
    record.job_title ?? '',
  joinDate:
    record.join_date ?? '',
  pointOfHire:
    record.point_of_hire ?? '',

  rosterCode:
    record.roster_code ?? '',
  siteLocationId:
    record.site_location_id ?? '',
  plannedD1:
    record.planned_site_in ??
    record.roster_effective_from ??
    '',
});

const EmployeeManagementPage:
React.FC = () => {
  const currentUser = useAuthStore(
    state => state.currentUser,
  );

  const fetchEmployees =
    useTRFStore(
      state => state.fetchEmployees,
    );

  const [
    masterData,
    setMasterData,
  ] = React.useState<
    EmployeeManagementMasterData
  >(EMPTY_MASTER_DATA);

  const [
    records,
    setRecords,
  ] = React.useState<
    EmployeeManagementRecord[]
  >([]);

  const [
    search,
    setSearch,
  ] = React.useState('');

  const [
    includeInactive,
    setIncludeInactive,
  ] = React.useState(true);

  const [
    isLoading,
    setIsLoading,
  ] = React.useState(true);

  const [
    isSaving,
    setIsSaving,
  ] = React.useState(false);

  const [
    formDialog,
    setFormDialog,
  ] = React.useState<
    EmployeeFormDialogState | null
  >(null);

  const [
    actionDialog,
    setActionDialog,
  ] = React.useState<
    EmployeeActionDialogState | null
  >(null);

  const [
    credentials,
    setCredentials,
  ] = React.useState<
    TemporaryCredential | null
  >(null);

  const isAllowed =
    currentUser?.role === 'HR' ||
    currentUser?.role ===
      'SUPER_ADMIN';

  const loadData =
    React.useCallback(
      async (
        showSuccess = false,
      ) => {
        if (!isAllowed) return;

        setIsLoading(true);

        try {
          const [
            masterResponse,
            listResponse,
          ] = await Promise.all([
            getEmployeeManagementMasterData(),
            listEmployeeManagementRecords(
              '',
              includeInactive,
            ),
          ]);

          setMasterData(
            masterResponse.masterData,
          );

          setRecords(
            listResponse.items,
          );

          if (showSuccess) {
            toast.success(
              'Employee data diperbarui.',
            );
          }
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : 'Gagal mengambil Employee Management.',
          );
        } finally {
          setIsLoading(false);
        }
      },
      [
        includeInactive,
        isAllowed,
      ],
    );

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredRecords =
    React.useMemo(() => {
      const keyword =
        normalizeSearch(search);

      if (!keyword) {
        return records;
      }

      return records.filter(
        record => {
          const searchable =
            normalizeSearch(
              [
                record.employee_code,
                record.employee_name,
                record.department,
                record.section,
                record.job_title,
                record.email,
                record.phone,
                record.roster_code,
                record.site_name,
                record.cycle_status,
              ]
                .filter(Boolean)
                .join(' '),
            );

          return searchable.includes(
            keyword,
          );
        },
      );
    }, [records, search]);

  const activeCount =
    React.useMemo(
      () =>
        records.filter(
          record =>
            record.employee_is_active &&
            record.user_is_active,
        ).length,
      [records],
    );

  const plannedCount =
    React.useMemo(
      () =>
        records.filter(
          record =>
            record.cycle_status ===
            'PLANNED',
        ).length,
      [records],
    );

  const openCreateDialog = () => {
    setFormDialog({
      mode: 'CREATE',
      employee: null,
      form: {
        ...EMPTY_FORM,
        department:
          masterData
            .departments[0] ?? '',
        rosterCode:
          masterData
            .rosters[0]
            ?.code ?? '',
        siteLocationId:
          masterData
            .sites[0]
            ?.id ?? '',
      },
    });
  };

  const openEditDialog = (
    employee:
      EmployeeManagementRecord,
  ) => {
    setFormDialog({
      mode: 'EDIT',
      employee,
      form:
        createFormForRecord(
          employee,
        ),
    });
  };

  const updateForm = <
    K extends keyof EmployeeFormState,
  >(
    field: K,
    value: EmployeeFormState[K],
  ) => {
    setFormDialog(current =>
      current
        ? {
            ...current,
            form: {
              ...current.form,
              [field]: value,
            },
          }
        : null,
    );
  };

  const validateForm = (
    state:
      EmployeeFormDialogState,
  ): string | null => {
    const { form } = state;

    if (
      !isSevenDigitEmployeeCode(
        form.employeeCode,
      )
    ) {
      return 'Employee ID wajib tepat 7 digit angka.';
    }

    if (
      !form.employeeName.trim()
    ) {
      return 'Nama employee wajib diisi.';
    }

    if (
      !form.email.trim()
    ) {
      return 'Email wajib diisi untuk akun login.';
    }

    if (
      !form.phone.trim()
    ) {
      return 'Nomor WhatsApp wajib diisi.';
    }

    if (
      !form.department
    ) {
      return 'Department wajib dipilih.';
    }

    if (
      !form.jobTitle.trim()
    ) {
      return 'Job Title wajib diisi.';
    }

    if (!form.joinDate) {
      return 'Date of Hire wajib diisi.';
    }

    if (
      !form.rosterCode
    ) {
      return 'Roster wajib dipilih.';
    }

    if (
      !form.siteLocationId
    ) {
      return 'Site wajib dipilih.';
    }

    if (
      !form.plannedD1
    ) {
      return 'D1 wajib diisi.';
    }

    return null;
  };

  const refreshAfterMutation =
    async () => {
      dispatchEmployeeManagementUpdated();

      await Promise.all([
        loadData(),
        fetchEmployees(),
      ]);
    };

  const submitForm = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    if (!formDialog) return;

    const validationError =
      validateForm(formDialog);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSaving(true);

    try {
      const profileInput = {
        employeeName:
          formDialog.form
            .employeeName.trim(),
        employeeType:
          formDialog.form
            .employeeType,
        email:
          formDialog.form
            .email.trim(),
        phone:
          formDialog.form
            .phone.trim(),
        department:
          formDialog.form.department,
        section:
          formDialog.form
            .section.trim(),
        jobTitle:
          formDialog.form
            .jobTitle.trim(),
        joinDate:
          formDialog.form.joinDate,
        pointOfHire:
          formDialog.form
            .pointOfHire.trim(),

        rosterCode:
          formDialog.form.rosterCode,
        siteLocationId:
          formDialog.form
            .siteLocationId,
        plannedD1:
          formDialog.form.plannedD1,
      };

      if (
        formDialog.mode ===
        'CREATE'
      ) {
        const response =
          await createEmployeeOnboarding({
            operationKey:
              createEmployeeOperationKey(
                'CREATE',
                formDialog.form
                  .employeeCode,
              ),
            employeeCode:
              formDialog.form
                .employeeCode,
            ...profileInput,
          });

        setFormDialog(null);

        if (
          response.credentials
        ) {
          setCredentials(
            response.credentials,
          );
        }

        toast.success(
          'Employee, akun login, roster, dan planned cycle berhasil dibuat.',
        );
      } else {
        const employee =
          formDialog.employee;

        if (!employee) {
          throw new Error(
            'Employee edit tidak ditemukan.',
          );
        }

        await updateEmployeeManagement({
          operationKey:
            createEmployeeOperationKey(
              'UPDATE',
              employee.employee_id,
            ),
          employeeId:
            employee.employee_id,
          ...profileInput,
        });

        setFormDialog(null);

        toast.success(
          'Data employee berhasil diperbarui.',
        );
      }

      await refreshAfterMutation();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Employee gagal disimpan.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const submitAction =
    async () => {
      if (!actionDialog) return;

      if (
        !actionDialog.remarks.trim()
      ) {
        toast.error(
          'Remarks wajib diisi.',
        );
        return;
      }

      setIsSaving(true);

      try {
        if (
          actionDialog.action ===
          'SET_ACTIVE'
        ) {
          await setEmployeeManagementActive({
            operationKey:
              createEmployeeOperationKey(
                actionDialog
                  .nextActive
                  ? 'REACTIVATE'
                  : 'DEACTIVATE',
                actionDialog
                  .employee
                  .employee_id,
              ),
            employeeId:
              actionDialog
                .employee
                .employee_id,
            isActive:
              actionDialog
                .nextActive === true,
            remarks:
              actionDialog
                .remarks.trim(),
          });

          toast.success(
            actionDialog.nextActive
              ? 'Employee dan akun login berhasil diaktifkan.'
              : 'Employee dan akun login berhasil dinonaktifkan.',
          );
        } else {
          const response =
            await resetEmployeeTemporaryPassword({
              operationKey:
                createEmployeeOperationKey(
                  'RESET_PASSWORD',
                  actionDialog
                    .employee
                    .employee_id,
                ),
              employeeId:
                actionDialog
                  .employee
                  .employee_id,
              remarks:
                actionDialog
                  .remarks.trim(),
            });

          if (
            response.credentials
          ) {
            setCredentials(
              response.credentials,
            );
          }

          toast.success(
            'Temporary password baru berhasil dibuat.',
          );
        }

        setActionDialog(null);
        await refreshAfterMutation();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Tindakan employee gagal diproses.',
        );
      } finally {
        setIsSaving(false);
      }
    };

  const copyCredential = async (
    value: string,
    label: string,
  ) => {
    try {
      await navigator.clipboard
        .writeText(value);

      toast.success(
        `${label} disalin.`,
      );
    } catch {
      toast.error(
        `Gagal menyalin ${label}.`,
      );
    }
  };

  if (!isAllowed) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h1 className="font-semibold text-red-900">
          Access denied
        </h1>

        <p className="mt-2 text-sm text-red-700">
          Hanya HR dan Super Admin
          yang dapat mengakses
          Employee Management.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Employee Management
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Tambah dan edit employee,
            akun login, roster, site,
            serta planned D1.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              void loadData(true)
            }
            disabled={isLoading}
          >
            <RefreshCw
              className={cn(
                'mr-2 h-4 w-4',
                isLoading &&
                  'animate-spin',
              )}
            />
            Refresh
          </Button>

          <Button
            type="button"
            onClick={
              openCreateDialog
            }
            disabled={
              isLoading ||
              masterData
                .departments
                .length === 0 ||
              masterData
                .rosters
                .length === 0 ||
              masterData
                .sites
                .length === 0
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New Employee
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-full bg-blue-100 p-3 text-blue-700">
              <Users className="h-5 w-5" />
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Total displayed
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                {records.length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-full bg-emerald-100 p-3 text-emerald-700">
              <UserCheck className="h-5 w-5" />
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Active account
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                {activeCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-full bg-amber-100 p-3 text-amber-700">
              <CalendarDays className="h-5 w-5" />
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Planned cycle
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                {plannedCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Employee Directory
          </CardTitle>

          <CardDescription>
            Employee ID tidak dapat
            diedit. Delete tidak
            tersedia; gunakan
            deactivate.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              <Input
                value={search}
                onChange={event =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Cari Employee ID, nama, department, jabatan, roster, atau site..."
                className="pl-9"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={
                  includeInactive
                }
                onChange={event =>
                  setIncludeInactive(
                    event.target
                      .checked,
                  )
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              Tampilkan employee
              nonaktif
            </label>
          </div>

          {isLoading ? (
            <div className="flex min-h-64 items-center justify-center text-sm text-gray-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Mengambil employee...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <UserRound className="mx-auto h-10 w-10 text-gray-300" />

              <p className="mt-3 font-medium text-gray-900">
                Employee tidak
                ditemukan
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Ubah pencarian atau
                tambahkan employee baru.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-3">
                      Employee
                    </th>
                    <th className="px-3 py-3">
                      Position
                    </th>
                    <th className="px-3 py-3">
                      Account
                    </th>
                    <th className="px-3 py-3">
                      Roster / Site
                    </th>
                    <th className="px-3 py-3">
                      Current Cycle
                    </th>
                    <th className="px-3 py-3 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecords.map(
                    employee => {
                      const active =
                        employee
                          .employee_is_active &&
                        employee
                          .user_is_active;

                      return (
                        <tr
                          key={
                            employee
                              .employee_id
                          }
                          className="border-b align-top last:border-0 hover:bg-gray-50"
                        >
                          <td className="px-3 py-4">
                            <p className="font-medium text-gray-900">
                              {
                                employee
                                  .employee_code
                              }
                              {' — '}
                              {
                                employee
                                  .employee_name
                              }
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              {
                                employee
                                  .employee_type
                              }
                              {' · '}
                              {
                                employee
                                  .phone ||
                                '-'
                              }
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              {
                                employee
                                  .email ||
                                '-'
                              }
                            </p>
                          </td>

                          <td className="px-3 py-4">
                            <p className="font-medium text-gray-800">
                              {
                                employee
                                  .job_title ||
                                '-'
                              }
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              {
                                employee
                                  .department ||
                                '-'
                              }
                              {' · '}
                              {
                                employee
                                  .section ||
                                '-'
                              }
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              Hire:{' '}
                              {formatDate(
                                employee
                                  .join_date,
                              )}
                            </p>
                          </td>

                          <td className="px-3 py-4">
                            <Badge
                              variant={
                                active
                                  ? 'default'
                                  : 'secondary'
                              }
                              className={cn(
                                active
                                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                                  : 'bg-gray-100 text-gray-600',
                              )}
                            >
                              {active
                                ? 'ACTIVE'
                                : 'INACTIVE'}
                            </Badge>

                            <p className="mt-2 text-xs text-gray-500">
                              Username:{' '}
                              {
                                employee
                                  .username ||
                                '-'
                              }
                            </p>

                            {employee.must_change_password && (
                              <p className="mt-1 text-xs font-medium text-amber-700">
                                Password change
                                required
                              </p>
                            )}
                          </td>

                          <td className="px-3 py-4">
                            <p className="font-medium text-gray-800">
                              {
                                employee
                                  .roster_code ||
                                'Belum ada roster'
                              }
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              Site:{' '}
                              {
                                employee
                                  .site_name ||
                                '-'
                              }
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              D1:{' '}
                              {formatDate(
                                employee
                                  .planned_site_in,
                              )}
                            </p>
                          </td>

                          <td className="px-3 py-4">
                            <Badge
                              variant="outline"
                            >
                              {
                                employee
                                  .cycle_status ||
                                'NO CYCLE'
                              }
                            </Badge>

                            <p className="mt-2 text-xs text-gray-500">
                              Site Out:{' '}
                              {formatDate(
                                employee
                                  .planned_site_out,
                              )}
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              Leave:{' '}
                              {formatDate(
                                employee
                                  .planned_leave_start,
                              )}
                              {' – '}
                              {formatDate(
                                employee
                                  .planned_leave_end,
                              )}
                            </p>

                            {!employee.schedule_editable && (
                              <p className="mt-1 text-xs font-medium text-blue-700">
                                Schedule locked
                              </p>
                            )}
                          </td>

                          <td className="px-3 py-4">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  openEditDialog(
                                    employee,
                                  )
                                }
                              >
                                <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                                Edit
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setActionDialog({
                                    action:
                                      'RESET_PASSWORD',
                                    employee,
                                    remarks:
                                      '',
                                  })
                                }
                                disabled={
                                  !employee
                                    .user_id
                                }
                              >
                                <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                                Reset
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant={
                                  active
                                    ? 'destructive'
                                    : 'default'
                                }
                                onClick={() =>
                                  setActionDialog({
                                    action:
                                      'SET_ACTIVE',
                                    employee,
                                    nextActive:
                                      !active,
                                    remarks:
                                      '',
                                  })
                                }
                              >
                                {active ? (
                                  <UserX className="mr-1.5 h-3.5 w-3.5" />
                                ) : (
                                  <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                                )}

                                {active
                                  ? 'Deactivate'
                                  : 'Activate'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={formDialog !== null}
        onOpenChange={open => {
          if (
            !open &&
            !isSaving
          ) {
            setFormDialog(null);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {formDialog?.mode ===
              'CREATE'
                ? 'Add New Employee'
                : 'Edit Employee'}
            </DialogTitle>

            <DialogDescription>
              {formDialog?.mode ===
              'CREATE'
                ? 'Employee, akun login, roster assignment, dan PLANNED cycle dibuat secara atomic.'
                : 'Employee ID bersifat mutlak dan tidak dapat diubah.'}
            </DialogDescription>
          </DialogHeader>

          {formDialog && (
            <form
              onSubmit={
                submitForm
              }
              className="space-y-6"
            >
              <div className="rounded-lg border bg-gray-50 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-blue-600" />
                  <h3 className="font-medium text-gray-900">
                    Employee Profile
                  </h3>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="employee-code">
                      Employee ID *
                    </Label>

                    <Input
                      id="employee-code"
                      inputMode="numeric"
                      maxLength={7}
                      value={
                        formDialog.form
                          .employeeCode
                      }
                      disabled={
                        formDialog.mode ===
                        'EDIT'
                      }
                      onChange={event =>
                        updateForm(
                          'employeeCode',
                          event.target.value
                            .replace(
                              /\D/g,
                              '',
                            )
                            .slice(0, 7),
                        )
                      }
                      placeholder="7 digit angka"
                    />

                    {formDialog.mode ===
                      'EDIT' && (
                      <p className="text-xs text-gray-500">
                        Employee ID tidak
                        dapat diedit.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employee-name">
                      Nama Lengkap *
                    </Label>

                    <Input
                      id="employee-name"
                      value={
                        formDialog.form
                          .employeeName
                      }
                      onChange={event =>
                        updateForm(
                          'employeeName',
                          event.target.value,
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employee-type">
                      Employee Type *
                    </Label>

                    <select
                      id="employee-type"
                      value={
                        formDialog.form
                          .employeeType
                      }
                      onChange={event =>
                        updateForm(
                          'employeeType',
                          event.target.value as
                            EmployeeFormState['employeeType'],
                        )
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {masterData
                        .employee_types
                        .map(type => (
                          <option
                            key={type}
                            value={type}
                          >
                            {type}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employee-email">
                      Email Akun *
                    </Label>

                    <Input
                      id="employee-email"
                      type="email"
                      value={
                        formDialog.form
                          .email
                      }
                      onChange={event =>
                        updateForm(
                          'email',
                          event.target.value,
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employee-phone">
                      Nomor WhatsApp *
                    </Label>

                    <Input
                      id="employee-phone"
                      value={
                        formDialog.form
                          .phone
                      }
                      onChange={event =>
                        updateForm(
                          'phone',
                          event.target.value,
                        )
                      }
                      placeholder="Contoh: 081234567890"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employee-hire-date">
                      Date of Hire *
                    </Label>

                    <Input
                      id="employee-hire-date"
                      type="date"
                      value={
                        formDialog.form
                          .joinDate
                      }
                      onChange={event =>
                        updateForm(
                          'joinDate',
                          event.target.value,
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employee-department">
                      Department *
                    </Label>

                    <select
                      id="employee-department"
                      value={
                        formDialog.form
                          .department
                      }
                      onChange={event =>
                        updateForm(
                          'department',
                          event.target.value,
                        )
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <option value="">
                        Pilih department
                      </option>

                      {masterData
                        .departments
                        .map(department => (
                          <option
                            key={department}
                            value={department}
                          >
                            {department}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employee-section">
                      Section
                    </Label>

                    <Input
                      id="employee-section"
                      value={
                        formDialog.form
                          .section
                      }
                      onChange={event =>
                        updateForm(
                          'section',
                          event.target.value,
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employee-job-title">
                      Job Title *
                    </Label>

                    <Input
                      id="employee-job-title"
                      value={
                        formDialog.form
                          .jobTitle
                      }
                      onChange={event =>
                        updateForm(
                          'jobTitle',
                          event.target.value,
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employee-point-of-hire">
                      Point of Hire
                    </Label>

                    <Input
                      id="employee-point-of-hire"
                      value={
                        formDialog.form
                          .pointOfHire
                      }
                      onChange={event =>
                        updateForm(
                          'pointOfHire',
                          event.target.value,
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-blue-50/40 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-blue-600" />

                  <h3 className="font-medium text-gray-900">
                    Mandatory Roster
                    and Planned Cycle
                  </h3>
                </div>

                {formDialog.mode ===
                  'EDIT' &&
                  formDialog.employee &&
                  !formDialog.employee
                    .schedule_editable && (
                    <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                      Roster, site, dan
                      D1 dikunci karena
                      cycle sudah memiliki
                      actual movement.
                      Data profile masih
                      dapat diedit.
                    </div>
                  )}

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="employee-roster">
                      Roster *
                    </Label>

                    <select
                      id="employee-roster"
                      value={
                        formDialog.form
                          .rosterCode
                      }
                      disabled={
                        formDialog.mode ===
                          'EDIT' &&
                        formDialog.employee
                          ?.schedule_editable ===
                          false
                      }
                      onChange={event =>
                        updateForm(
                          'rosterCode',
                          event.target.value,
                        )
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">
                        Pilih roster
                      </option>

                      {masterData
                        .rosters
                        .map(roster => (
                          <option
                            key={roster.id}
                            value={roster.code}
                          >
                            {roster.code}
                            {' — '}
                            {
                              roster.site_days
                            }
                            {' site / '}
                            {
                              roster.leave_days
                            }
                            {' leave'}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employee-site">
                      Site *
                    </Label>

                    <select
                      id="employee-site"
                      value={
                        formDialog.form
                          .siteLocationId
                      }
                      disabled={
                        formDialog.mode ===
                          'EDIT' &&
                        formDialog.employee
                          ?.schedule_editable ===
                          false
                      }
                      onChange={event =>
                        updateForm(
                          'siteLocationId',
                          event.target.value,
                        )
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">
                        Pilih site
                      </option>

                      {masterData
                        .sites
                        .map(site => (
                          <option
                            key={site.id}
                            value={site.id}
                          >
                            {site.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employee-d1">
                      Planned D1 *
                    </Label>

                    <Input
                      id="employee-d1"
                      type="date"
                      value={
                        formDialog.form
                          .plannedD1
                      }
                      disabled={
                        formDialog.mode ===
                          'EDIT' &&
                        formDialog.employee
                          ?.schedule_editable ===
                          false
                      }
                      onChange={event =>
                        updateForm(
                          'plannedD1',
                          event.target.value,
                        )
                      }
                    />
                  </div>
                </div>

                <p className="mt-3 text-xs text-gray-600">
                  Setiap employee baru
                  dibuat sebagai
                  PLANNED. Actual Site In
                  tetap harus dikonfirmasi
                  terpisah. OS tidak
                  dibuat pada proses ini.
                </p>
              </div>

              {formDialog.mode ===
                'CREATE' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

                    <div>
                      <p className="font-medium text-amber-900">
                        Login account
                        otomatis
                      </p>

                      <p className="mt-1 text-sm text-amber-800">
                        Username sama
                        dengan Employee ID.
                        Temporary password
                        acak ditampilkan
                        satu kali dan wajib
                        diganti saat login
                        pertama.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setFormDialog(null)
                  }
                  disabled={isSaving}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}

                  {formDialog.mode ===
                  'CREATE'
                    ? 'Create Employee'
                    : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={actionDialog !== null}
        onOpenChange={open => {
          if (
            !open &&
            !isSaving
          ) {
            setActionDialog(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action ===
              'RESET_PASSWORD'
                ? 'Reset Temporary Password'
                : actionDialog?.nextActive
                  ? 'Activate Employee'
                  : 'Deactivate Employee'}
            </DialogTitle>

            <DialogDescription>
              {actionDialog
                ? `${actionDialog.employee.employee_code} — ${actionDialog.employee.employee_name}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {actionDialog && (
            <div className="space-y-4">
              <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {actionDialog.action ===
                'RESET_PASSWORD'
                  ? 'Seluruh session lama akan dicabut. Password baru ditampilkan satu kali dan wajib diganti pada login berikutnya.'
                  : actionDialog.nextActive
                    ? 'Record employee dan akun login akan diaktifkan kembali.'
                    : 'Record employee dan akun login akan dinonaktifkan. Data history tidak dihapus.'}
              </div>

              <div className="space-y-2">
                <Label htmlFor="employee-action-remarks">
                  Remarks *
                </Label>

                <Textarea
                  id="employee-action-remarks"
                  value={
                    actionDialog.remarks
                  }
                  onChange={event =>
                    setActionDialog(
                      current =>
                        current
                          ? {
                              ...current,
                              remarks:
                                event
                                  .target
                                  .value,
                            }
                          : null,
                    )
                  }
                  rows={4}
                  placeholder="Tuliskan alasan atau referensi tindakan..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setActionDialog(null)
              }
              disabled={isSaving}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant={
                actionDialog?.action ===
                  'SET_ACTIVE' &&
                actionDialog
                  .nextActive ===
                  false
                  ? 'destructive'
                  : 'default'
              }
              onClick={() =>
                void submitAction()
              }
              disabled={isSaving}
            >
              {isSaving && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}

              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={credentials !== null}
        onOpenChange={open => {
          if (!open) {
            setCredentials(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Temporary Login
            </DialogTitle>

            <DialogDescription>
              Simpan sekarang. Password
              hanya ditampilkan satu kali.
            </DialogDescription>
          </DialogHeader>

          {credentials && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-gray-50 p-4">
                <Label>
                  Username
                </Label>

                <div className="mt-2 flex gap-2">
                  <Input
                    readOnly
                    value={
                      credentials.username
                    }
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      void copyCredential(
                        credentials.username,
                        'Username',
                      )
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <Label className="text-amber-900">
                  Temporary Password
                </Label>

                <div className="mt-2 flex gap-2">
                  <Input
                    readOnly
                    value={
                      credentials
                        .temporaryPassword
                    }
                    className="font-mono"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      void copyCredential(
                        credentials
                          .temporaryPassword,
                        'Temporary password',
                      )
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                <p className="mt-3 text-xs text-amber-800">
                  Employee wajib
                  mengganti password saat
                  login pertama.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              onClick={() =>
                setCredentials(null)
              }
            >
              Saya sudah menyimpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeManagementPage;
