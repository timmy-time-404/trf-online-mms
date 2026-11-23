import React from 'react';
import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  Save,
  Search,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import {
  createEarlyRecall,
  getEarlyRecallDetail,
  updateEarlyRecall,
  type EarlyRecallRecord,
} from '@/lib/earlyRecallApi';
import {
  useAuthStore,
  useTRFStore,
} from '@/store';

const calculateInclusiveDays = (
  start?: string,
  end?: string,
): number => {
  if (!start || !end) {
    return 0;
  }

  const startDate = new Date(
    `${start}T00:00:00`,
  );

  const endDate = new Date(
    `${end}T00:00:00`,
  );

  if (
    Number.isNaN(
      startDate.getTime(),
    ) ||
    Number.isNaN(
      endDate.getTime(),
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (
        endDate.getTime() -
        startDate.getTime()
      ) /
        86_400_000,
    ) + 1,
  );
};

const calculateLeaveUsed = (
  start?: string,
  returnDate?: string,
): number => {
  if (!start || !returnDate) {
    return 0;
  }

  const startDate = new Date(
    `${start}T00:00:00`,
  );

  const returnValue = new Date(
    `${returnDate}T00:00:00`,
  );

  if (
    Number.isNaN(
      startDate.getTime(),
    ) ||
    Number.isNaN(
      returnValue.getTime(),
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (
        returnValue.getTime() -
        startDate.getTime()
      ) /
        86_400_000,
    ),
  );
};

const EarlyRecallFormPage: React.FC =
  () => {
    const navigate = useNavigate();

    const {
      id: earlyRecallId,
    } = useParams<{
      id: string;
    }>();

    const isEditMode =
      Boolean(earlyRecallId);

    const currentUser = useAuthStore(
      (state) =>
        state.currentUser,
    );

    const employees = useTRFStore(
      (state) => state.employees,
    );

    const fetchEmployees =
      useTRFStore(
        (state) =>
          state.fetchEmployees,
      );

    const [
      existingRecord,
      setExistingRecord,
    ] = React.useState<
      EarlyRecallRecord | null
    >(null);

    const [
      employeeId,
      setEmployeeId,
    ] = React.useState('');

    const [
      employeeSearch,
      setEmployeeSearch,
    ] = React.useState('');

    const [
      approvedLeaveStart,
      setApprovedLeaveStart,
    ] = React.useState('');

    const [
      approvedLeaveEnd,
      setApprovedLeaveEnd,
    ] = React.useState('');

    const [
      proposedReturnDate,
      setProposedReturnDate,
    ] = React.useState('');

    const [
      reason,
      setReason,
    ] = React.useState('');

    const [
      remarks,
      setRemarks,
    ] = React.useState('');

    const [
      isLoading,
      setIsLoading,
    ] = React.useState(
      isEditMode,
    );

    const [
      isSaving,
      setIsSaving,
    ] = React.useState(false);

    React.useEffect(() => {
      if (employees.length === 0) {
        void fetchEmployees();
      }
    }, [
      employees.length,
      fetchEmployees,
    ]);

    React.useEffect(() => {
      if (
        !earlyRecallId
      ) {
        return;
      }

      const loadRecord =
        async () => {
          setIsLoading(true);

          try {
            const response =
              await getEarlyRecallDetail(
                earlyRecallId,
              );

            const record =
              response.item;

            setExistingRecord(
              record,
            );

            setEmployeeId(
              record.employee_id,
            );

            setEmployeeSearch(
              `${record.employee.employee_code} - ${record.employee.employee_name}`,
            );

            setApprovedLeaveStart(
              record.approved_leave_start,
            );

            setApprovedLeaveEnd(
              record.approved_leave_end,
            );

            setProposedReturnDate(
              record.proposed_return_date,
            );

            setReason(
              record.reason,
            );

            setRemarks(
              record.remarks ?? '',
            );
          } catch (error) {
            console.error(
              'Load Early Recall form failed:',
              error,
            );

            toast.error(
              error instanceof Error
                ? error.message
                : 'Gagal mengambil data Early Recall.',
            );

            navigate(
              '/early-recall',
              {
                replace: true,
              },
            );
          } finally {
            setIsLoading(false);
          }
        };

      void loadRecord();
    }, [
      earlyRecallId,
      navigate,
    ]);

    const availableEmployees =
      React.useMemo(() => {
        const role =
          currentUser?.role;

        const department =
          currentUser?.department;

        const scopedEmployees =
          role === 'HOD'
            ? employees.filter(
                (employee) =>
                  employee.department ===
                  department,
              )
            : employees;

        const normalizedSearch =
          employeeSearch
            .trim()
            .toLowerCase();

        return scopedEmployees
          .filter(
            (employee) =>
              employee.employeeType ===
              'EMPLOYEE',
          )
          .filter(
            (employee) => {
              if (
                !normalizedSearch
              ) {
                return true;
              }

              return [
                employee.employeeCode,
                employee.employeeName,
                employee.department,
                employee.jobTitle,
              ].some((value) =>
                value
                  ?.toLowerCase()
                  .includes(
                    normalizedSearch,
                  ),
              );
            },
          )
          .sort((first, second) =>
            first.employeeName.localeCompare(
              second.employeeName,
            ),
          );
      }, [
        currentUser?.department,
        currentUser?.role,
        employeeSearch,
        employees,
      ]);

    const selectedEmployee =
      React.useMemo(
        () =>
          employees.find(
            (employee) =>
              employee.id ===
              employeeId,
          ),
        [employeeId, employees],
      );

    const approvedDays =
      calculateInclusiveDays(
        approvedLeaveStart,
        approvedLeaveEnd,
      );

    const leaveUsed =
      calculateLeaveUsed(
        approvedLeaveStart,
        proposedReturnDate,
      );

    const unusedDays =
      approvedDays > 0
        ? Math.max(
            0,
            approvedDays -
              leaveUsed,
          )
        : 0;

    const isEditable =
      !existingRecord ||
      [
        'DRAFT',
        'NEEDS_REVISION',
      ].includes(
        existingRecord.status,
      );

    const validateForm =
      (): string | null => {
        if (!employeeId) {
          return 'Employee wajib dipilih.';
        }

        if (
          !approvedLeaveStart ||
          !approvedLeaveEnd ||
          !proposedReturnDate
        ) {
          return 'Seluruh tanggal wajib diisi.';
        }

        if (
          approvedLeaveEnd <
          approvedLeaveStart
        ) {
          return 'Approved Leave End tidak boleh lebih awal dari Approved Leave Start.';
        }

        if (
          proposedReturnDate <=
            approvedLeaveStart ||
          proposedReturnDate >
            approvedLeaveEnd
        ) {
          return 'Proposed Return Date harus setelah tanggal mulai cuti dan tidak boleh melewati tanggal akhir cuti.';
        }

        if (
          !reason.trim()
        ) {
          return 'Reason for Recall wajib diisi.';
        }

        if (
          unusedDays <= 0
        ) {
          return 'Early Recall harus memiliki minimal 1 hari sisa cuti.';
        }

        return null;
      };

    const handleSave =
      async () => {
        if (!isEditable) {
          toast.error(
            'Data tidak dapat diedit pada status saat ini.',
          );
          return;
        }

        const validationError =
          validateForm();

        if (validationError) {
          toast.error(
            validationError,
          );
          return;
        }

        setIsSaving(true);

        try {
          const response =
            isEditMode &&
            earlyRecallId
              ? await updateEarlyRecall({
                  earlyRecallId,
                  employeeId,
                  approvedLeaveStart,
                  approvedLeaveEnd,
                  proposedReturnDate,
                  reason:
                    reason.trim(),
                  remarks:
                    remarks.trim() ||
                    null,
                  sourceTrfId:
                    existingRecord?.source_trf_id ??
                    null,
                })
              : await createEarlyRecall({
                  employeeId,
                  approvedLeaveStart,
                  approvedLeaveEnd,
                  proposedReturnDate,
                  reason:
                    reason.trim(),
                  remarks:
                    remarks.trim() ||
                    null,
                  sourceTrfId: null,
                });

          toast.success(
            isEditMode
              ? 'Early Recall berhasil diperbarui.'
              : 'Draft Early Recall berhasil dibuat.',
          );

          window.dispatchEvent(
            new CustomEvent(
              'early-recall-updated',
            ),
          );

          navigate(
            `/early-recall/${response.item.id}`,
            {
              replace: true,
            },
          );
        } catch (error) {
          console.error(
            'Save Early Recall failed:',
            error,
          );

          toast.error(
            error instanceof Error
              ? error.message
              : 'Gagal menyimpan Early Recall.',
          );
        } finally {
          setIsSaving(false);
        }
      };

    if (isLoading) {
      return (
        <div className="flex min-h-[420px] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-500" />

            <p className="mt-3 text-sm text-gray-500">
              Memuat form...
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Button
              type="button"
              variant="ghost"
              className="-ml-3 mb-2 gap-2 text-gray-600"
              onClick={() =>
                navigate(
                  isEditMode &&
                    earlyRecallId
                    ? `/early-recall/${earlyRecallId}`
                    : '/early-recall',
                )
              }
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            <h1 className="text-2xl font-bold text-gray-900">
              {isEditMode
                ? 'Edit Early Recall'
                : 'New Early Recall'}
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Early Recall digunakan ketika employee harus kembali ke site sebelum approved leave selesai.
            </p>
          </div>
        </div>

        {!isEditable && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Early Recall berstatus{' '}
            <strong>
              {
                existingRecord?.status
              }
            </strong>{' '}
            dan tidak dapat diedit.
          </div>
        )}

        {/* EMPLOYEE */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <UserRound className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-semibold text-gray-900">
                Employee Information
              </h2>

              <p className="text-sm text-gray-500">
                Pilih employee yang sedang menjalani cuti aktif.
              </p>
            </div>
          </div>

          {isEditMode ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="font-semibold text-gray-900">
                {
                  existingRecord
                    ?.employee
                    .employee_name
                }
              </p>

              <p className="mt-1 text-sm text-gray-500">
                {
                  existingRecord
                    ?.employee
                    .employee_code
                }{' '}
                ·{' '}
                {
                  existingRecord
                    ?.employee
                    .department
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                <Input
                  value={employeeSearch}
                  onChange={(event) =>
                    setEmployeeSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Cari Employee ID, nama, department, atau job title..."
                  className="pl-10"
                  disabled={!isEditable}
                />
              </div>

              <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                {availableEmployees.length ===
                0 ? (
                  <div className="p-6 text-center text-sm text-gray-500">
                    Employee tidak ditemukan.
                  </div>
                ) : (
                  availableEmployees.map(
                    (employee) => (
                      <button
                        key={
                          employee.id
                        }
                        type="button"
                        disabled={
                          !isEditable
                        }
                        onClick={() => {
                          setEmployeeId(
                            employee.id,
                          );

                          setEmployeeSearch(
                            `${employee.employeeCode} - ${employee.employeeName}`,
                          );
                        }}
                        className={`flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left last:border-b-0 ${
                          employee.id ===
                          employeeId
                            ? 'bg-blue-50'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
                          {employee.employeeName
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">
                            {
                              employee.employeeName
                            }
                          </p>

                          <p className="text-xs text-gray-500">
                            {
                              employee.employeeCode
                            }{' '}
                            ·{' '}
                            {
                              employee.department
                            }
                          </p>

                          <p className="mt-1 text-xs text-gray-400">
                            {
                              employee.jobTitle
                            }
                          </p>
                        </div>
                      </button>
                    ),
                  )
                )}
              </div>
            </div>
          )}

          {selectedEmployee &&
            !isEditMode && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Selected Employee
                </p>

                <p className="mt-1 font-semibold text-blue-950">
                  {
                    selectedEmployee.employeeName
                  }
                </p>

                <p className="text-sm text-blue-700">
                  {
                    selectedEmployee.employeeCode
                  }{' '}
                  ·{' '}
                  {
                    selectedEmployee.department
                  }
                </p>
              </div>
            )}
        </section>

        {/* LEAVE PERIOD */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <CalendarDays className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-semibold text-gray-900">
                Approved Leave &amp; Return Plan
              </h2>

              <p className="text-sm text-gray-500">
                Sistem menghitung estimasi sisa cuti secara otomatis.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Approved Leave Start
                <span className="text-red-500">
                  {' '}
                  *
                </span>
              </label>

              <Input
                type="date"
                value={
                  approvedLeaveStart
                }
                disabled={!isEditable}
                onChange={(event) =>
                  setApprovedLeaveStart(
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Approved Leave End
                <span className="text-red-500">
                  {' '}
                  *
                </span>
              </label>

              <Input
                type="date"
                value={
                  approvedLeaveEnd
                }
                min={
                  approvedLeaveStart ||
                  undefined
                }
                disabled={!isEditable}
                onChange={(event) =>
                  setApprovedLeaveEnd(
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Proposed Return Date
                <span className="text-red-500">
                  {' '}
                  *
                </span>
              </label>

              <Input
                type="date"
                value={
                  proposedReturnDate
                }
                min={
                  approvedLeaveStart ||
                  undefined
                }
                max={
                  approvedLeaveEnd ||
                  undefined
                }
                disabled={!isEditable}
                onChange={(event) =>
                  setProposedReturnDate(
                    event.target.value,
                  )
                }
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Approved Leave
              </p>

              <p className="mt-1 text-2xl font-bold text-gray-900">
                {approvedDays}
              </p>

              <p className="text-xs text-gray-500">
                days
              </p>
            </div>

            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-xs uppercase tracking-wide text-blue-600">
                Estimated Used
              </p>

              <p className="mt-1 text-2xl font-bold text-blue-900">
                {leaveUsed}
              </p>

              <p className="text-xs text-blue-600">
                days
              </p>
            </div>

            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-xs uppercase tracking-wide text-green-600">
                Estimated OS
              </p>

              <p className="mt-1 text-2xl font-bold text-green-900">
                {unusedDays}
              </p>

              <p className="text-xs text-green-600">
                days · Cycle 0 after actual return
              </p>
            </div>
          </div>
        </section>

        {/* REASON */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="grid gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Reason for Recall
                <span className="text-red-500">
                  {' '}
                  *
                </span>
              </label>

              <Textarea
                value={reason}
                disabled={!isEditable}
                onChange={(event) =>
                  setReason(
                    event.target.value,
                  )
                }
                placeholder="Contoh: Kebutuhan operasional site, pekerjaan kritikal, atau pengganti personel..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Additional Remarks
              </label>

              <Textarea
                value={remarks}
                disabled={!isEditable}
                onChange={(event) =>
                  setRemarks(
                    event.target.value,
                  )
                }
                placeholder="Informasi tambahan atau instruksi untuk HR/PM/GA..."
                rows={3}
              />
            </div>
          </div>
        </section>

        {/* ACTIONS */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() =>
              navigate(
                isEditMode &&
                  earlyRecallId
                  ? `/early-recall/${earlyRecallId}`
                  : '/early-recall',
              )
            }
          >
            Cancel
          </Button>

          <Button
            type="button"
            disabled={
              isSaving ||
              !isEditable
            }
            className="gap-2"
            onClick={() =>
              void handleSave()
            }
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}

            {isEditMode
              ? 'Save Changes'
              : 'Save Draft'}
          </Button>
        </div>
      </div>
    );
  };

export default EarlyRecallFormPage;