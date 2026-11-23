// types/supabase.ts - Database schema untuk Supabase
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          username: string;
          email: string;
          role: string;
          employee_id: string | null;
          department: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          email: string;
          role: string;
          employee_id?: string | null;
          department?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          email?: string;
          role?: string;
          employee_id?: string | null;
          department?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      employees: {
        Row: {
          id: string;
          employee_type: string;
          employee_name: string;
          job_title: string | null;
          department: string | null;
          section: string | null;
          email: string | null;
          phone: string | null;
          date_of_hire: string | null;
          point_of_hire: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_type: string;
          employee_name: string;
          job_title?: string | null;
          department?: string | null;
          section?: string | null;
          email?: string | null;
          phone?: string | null;
          date_of_hire?: string | null;
          point_of_hire?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_type?: string;
          employee_name?: string;
          job_title?: string | null;
          department?: string | null;
          section?: string | null;
          email?: string | null;
          phone?: string | null;
          date_of_hire?: string | null;
          point_of_hire?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      trfs: {
        Row: {
          id: string;
          trf_number: string;
          employee_id: string;
          department: string;
          travel_purpose: string;
          start_date: string;
          end_date: string;
          purpose_remarks: string | null;
          status: string;
          accommodation: any | null;
          travel_arrangements: any;
          admin_dept_verify: any | null;
          parallel_approval: any | null;
          pm_approval: any | null;
          ga_process: any | null;
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trf_number?: string;
          employee_id: string;
          department: string;
          travel_purpose: string;
          start_date: string;
          end_date: string;
          purpose_remarks?: string | null;
          status?: string;
          accommodation?: any | null;
          travel_arrangements?: any;
          admin_dept_verify?: any | null;
          parallel_approval?: any | null;
          pm_approval?: any | null;
          ga_process?: any | null;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trf_number?: string;
          employee_id?: string;
          department?: string;
          travel_purpose?: string;
          start_date?: string;
          end_date?: string;
          purpose_remarks?: string | null;
          status?: string;
          accommodation?: any | null;
          travel_arrangements?: any;
          admin_dept_verify?: any | null;
          parallel_approval?: any | null;
          pm_approval?: any | null;
          ga_process?: any | null;
          submitted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      status_history: {
        Row: {
          id: string;
          trf_id: string;
          changed_by: string;
          changed_by_name: string;
          old_status: string | null;
          new_status: string;
          remarks: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          trf_id: string;
          changed_by: string;
          changed_by_name: string;
          old_status?: string | null;
          new_status: string;
          remarks?: string | null;
          changed_at?: string;
        };
      };
    };
  };
}