export interface PurposeOption {
  key  : string;
  label: string;
}
 
export const TRAVEL_PURPOSE_OPTIONS: PurposeOption[] = [
  { key: 'ANNUAL_LEAVE',                    label: 'Annual Leave / Cuti Tahunan'          },
  { key: 'FIELD_BREAK',                     label: 'Field Break / Cuti Lapangan'          },
  { key: 'TRAINING',                        label: 'Training / Meeting'                   },
  { key: 'BUSINESS_TRIP',                   label: 'Business Trip'                        },
  { key: 'INBOUND',                         label: 'Inbound'                              },
  { key: 'OUTBOUND',                        label: 'Outbound'                             },
  { key: 'NEW_HIRE_INBOUND',               label: 'New Hire Inbound'                     },
  { key: 'SICK_LEAVE',                      label: 'Sick Leave'                           },
  { key: 'UNPAID_LEAVE',                    label: 'Unpaid Leave'                         },
  { key: 'CUTI_BAPTIS_KHITANAN',           label: 'Cuti Baptis / Khitanan'               },
  { key: 'CUTI_BESAR',                      label: 'Cuti Besar'                           },
  { key: 'CUTI_HAID',                       label: 'Cuti Haid'                            },
  { key: 'CUTI_KEGUGURAN',                 label: 'Cuti Keguguran Istri Pegawai'         },
  { key: 'CUTI_MELAHIRKAN_ISTRI',          label: 'Cuti Melahirkan Istri Pegawai'        },
  { key: 'CUTI_MELAHIRKAN_WANITA',         label: 'Cuti Melahirkan Pegawai Wanita'       },
  { key: 'CUTI_MENIKAH',                   label: 'Cuti Menikah Pekerja'                 },
  { key: 'CUTI_MENIKAHKAN_ANAK',           label: 'Cuti Menikahkan Anak'                 },
  { key: 'CUTI_MENINGGAL_KELUARGA_BESAR',  label: 'Cuti Meninggal Keluarga Besar'        },
  { key: 'CUTI_MENINGGAL_KELUARGA_INTI',   label: 'Cuti Meninggal Keluarga Inti'         },
  { key: 'CUTI_NAIK_HAJI',                label: 'Cuti Naik Haji'                       },
  { key: 'CUTI_PANJANG',                   label: 'Cuti Panjang'                         },
  { key: 'OTHERS',                          label: 'Others / Lainnya'                     },
];
 
/** Helper: key → label (untuk display) */
export const getPurposeLabel = (key: string): string => {
  return TRAVEL_PURPOSE_OPTIONS.find(o => o.key === key)?.label
    ?? key.replace(/_/g, ' ');
};
 