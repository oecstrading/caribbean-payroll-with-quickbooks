export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      applicant_documents: {
        Row: {
          applicant_id: string
          document_type: string
          expiry_date: string | null
          file_name: string
          file_url: string
          id: string
          uploaded_at: string
          verified: boolean
        }
        Insert: {
          applicant_id: string
          document_type?: string
          expiry_date?: string | null
          file_name?: string
          file_url?: string
          id?: string
          uploaded_at?: string
          verified?: boolean
        }
        Update: {
          applicant_id?: string
          document_type?: string
          expiry_date?: string | null
          file_name?: string
          file_url?: string
          id?: string
          uploaded_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "applicant_documents_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
        ]
      }
      applicants: {
        Row: {
          address: string | null
          applied_date: string
          created_at: string
          desired_position: string | null
          email: string
          experience_years: number | null
          first_name: string
          id: string
          jurisdiction: string | null
          last_name: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          applied_date?: string
          created_at?: string
          desired_position?: string | null
          email?: string
          experience_years?: number | null
          first_name?: string
          id?: string
          jurisdiction?: string | null
          last_name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          applied_date?: string
          created_at?: string
          desired_position?: string | null
          email?: string
          experience_years?: number | null
          first_name?: string
          id?: string
          jurisdiction?: string | null
          last_name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_invoices: {
        Row: {
          client_email: string | null
          client_name: string
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          period_end: string
          period_start: string
          site_id: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
        }
        Insert: {
          client_email?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          site_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Update: {
          client_email?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          site_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_invoices_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "client_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_access: {
        Row: {
          access_code: string
          client_email: string | null
          client_name: string
          created_at: string
          id: string
          is_active: boolean
          last_accessed_at: string | null
          site_id: string
        }
        Insert: {
          access_code: string
          client_email?: string | null
          client_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          site_id: string
        }
        Update: {
          access_code?: string
          client_email?: string | null
          client_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_access_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "client_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      client_sites: {
        Row: {
          address: string | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          id: string
          jurisdiction_id: string | null
          latitude: number | null
          location: unknown
          longitude: number | null
          name: string
          post_orders: string | null
          radius_meters: number
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          id?: string
          jurisdiction_id?: string | null
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          name: string
          post_orders?: string | null
          radius_meters?: number
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          id?: string
          jurisdiction_id?: string | null
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          name?: string
          post_orders?: string | null
          radius_meters?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_sites_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
        ]
      }
      clock_punches: {
        Row: {
          address_label: string | null
          clock_in_location: unknown
          geofence_zone_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          punch_type: string
          punched_at: string
          user_id: string
          within_geofence: boolean | null
        }
        Insert: {
          address_label?: string | null
          clock_in_location?: unknown
          geofence_zone_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          punch_type: string
          punched_at?: string
          user_id: string
          within_geofence?: boolean | null
        }
        Update: {
          address_label?: string | null
          clock_in_location?: unknown
          geofence_zone_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          punch_type?: string
          punched_at?: string
          user_id?: string
          within_geofence?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "clock_punches_geofence_zone_id_fkey"
            columns: ["geofence_zone_id"]
            isOneToOne: false
            referencedRelation: "geofence_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          company_name: string
          employer_nic_number: string | null
          id: string
          logo_url: string | null
          tax_id: string | null
          telephone: string | null
          updated_at: string
          updated_by: string | null
          vat_number: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          company_name?: string
          employer_nic_number?: string | null
          id?: string
          logo_url?: string | null
          tax_id?: string | null
          telephone?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          employer_nic_number?: string | null
          id?: string
          logo_url?: string | null
          tax_id?: string | null
          telephone?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_number?: string | null
          website?: string | null
        }
        Relationships: []
      }
      contractor_payments: {
        Row: {
          amount: number
          contractor_id: string
          created_at: string
          description: string | null
          id: string
          invoice_number: string | null
          payment_date: string | null
          project_id: string | null
          status: string
        }
        Insert: {
          amount?: number
          contractor_id: string
          created_at?: string
          description?: string | null
          id?: string
          invoice_number?: string | null
          payment_date?: string | null
          project_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          contractor_id?: string
          created_at?: string
          description?: string | null
          id?: string
          invoice_number?: string | null
          payment_date?: string | null
          project_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_payments_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          account_number: string | null
          bank_name: string | null
          company_name: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          phone: string | null
          status: string
          tax_id: string | null
          trade: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          bank_name?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          status?: string
          tax_id?: string | null
          trade?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          bank_name?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          status?: string
          tax_id?: string | null
          trade?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      creditors: {
        Row: {
          account_number: string | null
          contact_info: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          contact_info?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          contact_info?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      crew_members: {
        Row: {
          crew_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          crew_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          crew_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_members_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      crews: {
        Row: {
          created_at: string
          id: string
          lead_user_id: string | null
          name: string
          project_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_user_id?: string | null
          name: string
          project_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_user_id?: string | null
          name?: string
          project_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reports: {
        Row: {
          created_at: string
          crew_size: number | null
          id: string
          issues: string | null
          materials_used: string | null
          photo_urls: string[] | null
          project_id: string
          report_date: string
          safety_notes: string | null
          status: string
          submitted_by: string
          updated_at: string
          weather: string | null
          work_completed: string | null
        }
        Insert: {
          created_at?: string
          crew_size?: number | null
          id?: string
          issues?: string | null
          materials_used?: string | null
          photo_urls?: string[] | null
          project_id: string
          report_date?: string
          safety_notes?: string | null
          status?: string
          submitted_by: string
          updated_at?: string
          weather?: string | null
          work_completed?: string | null
        }
        Update: {
          created_at?: string
          crew_size?: number | null
          id?: string
          issues?: string | null
          materials_used?: string | null
          photo_urls?: string[] | null
          project_id?: string
          report_date?: string
          safety_notes?: string | null
          status?: string
          submitted_by?: string
          updated_at?: string
          weather?: string | null
          work_completed?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_alerts: {
        Row: {
          created_at: string
          id: string
          latitude: number
          location: unknown
          longitude: number
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          site_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          latitude: number
          location?: unknown
          longitude: number
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          site_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          latitude?: number
          location?: unknown
          longitude?: number
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          site_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_alerts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "client_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_additions: {
        Row: {
          addition_type: Database["public"]["Enums"]["addition_type"]
          amount: number
          created_at: string
          description: string | null
          frequency: string
          id: string
          is_active: boolean
          notes: string | null
          period: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          addition_type?: Database["public"]["Enums"]["addition_type"]
          amount?: number
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          period?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          addition_type?: Database["public"]["Enums"]["addition_type"]
          amount?: number
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          period?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employee_bank_info: {
        Row: {
          account_number: string | null
          account_type: string | null
          bank_name: string | null
          branch: string | null
          id: string
          routing_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          bank_name?: string | null
          branch?: string | null
          id?: string
          routing_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          bank_name?: string | null
          branch?: string | null
          id?: string
          routing_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employee_deductions: {
        Row: {
          amount: number
          created_at: string
          creditor_id: string
          end_date: string | null
          frequency: string
          id: string
          is_active: boolean
          notes: string | null
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          creditor_id: string
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          creditor_id?: string
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_deductions_creditor_id_fkey"
            columns: ["creditor_id"]
            isOneToOne: false
            referencedRelation: "creditors"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          condition: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          purchase_cost: number | null
          purchase_date: string | null
          serial_number: string | null
          status: string
          type: string | null
          updated_at: string
        }
        Insert: {
          condition?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          condition?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      equipment_checkouts: {
        Row: {
          checked_out_at: string
          condition_on_return: string | null
          equipment_id: string
          id: string
          notes: string | null
          project_id: string | null
          returned_at: string | null
          user_id: string
        }
        Insert: {
          checked_out_at?: string
          condition_on_return?: string | null
          equipment_id: string
          id?: string
          notes?: string | null
          project_id?: string | null
          returned_at?: string | null
          user_id: string
        }
        Update: {
          checked_out_at?: string
          condition_on_return?: string | null
          equipment_id?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          returned_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_checkouts_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_checkouts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      geofence_zones: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          name: string
          radius_meters: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          name: string
          radius_meters?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          name?: string
          radius_meters?: number
          updated_at?: string
        }
        Relationships: []
      }
      guard_assignments: {
        Row: {
          assigned_at: string
          days_of_week: string[] | null
          id: string
          is_active: boolean
          shift_end: string | null
          shift_start: string | null
          site_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          days_of_week?: string[] | null
          id?: string
          is_active?: boolean
          shift_end?: string | null
          shift_start?: string | null
          site_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          days_of_week?: string[] | null
          id?: string
          is_active?: boolean
          shift_end?: string | null
          shift_start?: string | null
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guard_assignments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "client_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      guard_licenses: {
        Row: {
          created_at: string
          expiry_date: string
          id: string
          issued_date: string | null
          license_number: string
          license_type: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expiry_date: string
          id?: string
          issued_date?: string | null
          license_number?: string
          license_type?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expiry_date?: string
          id?: string
          issued_date?: string | null
          license_number?: string
          license_type?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      incident_reports: {
        Row: {
          ai_draft: string | null
          audio_url: string | null
          description: string | null
          id: string
          is_ai_generated: boolean | null
          photo_urls: string[] | null
          raw_transcript: string | null
          reported_at: string
          resolved_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          site_id: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          ai_draft?: string | null
          audio_url?: string | null
          description?: string | null
          id?: string
          is_ai_generated?: boolean | null
          photo_urls?: string[] | null
          raw_transcript?: string | null
          reported_at?: string
          resolved_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          site_id: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          ai_draft?: string | null
          audio_url?: string | null
          description?: string | null
          id?: string
          is_ai_generated?: boolean | null
          photo_urls?: string[] | null
          raw_transcript?: string | null
          reported_at?: string
          resolved_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          site_id?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_reports_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "client_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          guard_name: string | null
          hours: number
          id: string
          invoice_id: string
          rate: number
          shift_date: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string
          guard_name?: string | null
          hours?: number
          id?: string
          invoice_id: string
          rate?: number
          shift_date?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          guard_name?: string | null
          hours?: number
          id?: string
          invoice_id?: string
          rate?: number
          shift_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "client_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      jurisdictions: {
        Row: {
          code: string
          created_at: string
          currency_code: string
          holiday_multiplier: number
          holiday_ot_multiplier: number
          id: string
          name: string
          nic_ceiling: number | null
          nic_employee_rate: number
          nic_employer_rate: number
          night_differential: number
          overtime_multiplier: number
        }
        Insert: {
          code: string
          created_at?: string
          currency_code?: string
          holiday_multiplier?: number
          holiday_ot_multiplier?: number
          id?: string
          name: string
          nic_ceiling?: number | null
          nic_employee_rate?: number
          nic_employer_rate?: number
          night_differential?: number
          overtime_multiplier?: number
        }
        Update: {
          code?: string
          created_at?: string
          currency_code?: string
          holiday_multiplier?: number
          holiday_ot_multiplier?: number
          id?: string
          name?: string
          nic_ceiling?: number | null
          nic_employee_rate?: number
          nic_employer_rate?: number
          night_differential?: number
          overtime_multiplier?: number
        }
        Relationships: []
      }
      late_clock_in_alerts: {
        Row: {
          alert_sent_at: string
          clock_in_at: string | null
          id: string
          late_minutes: number
          shift_date: string
          shift_start: string
          site_id: string
          user_id: string
        }
        Insert: {
          alert_sent_at?: string
          clock_in_at?: string | null
          id?: string
          late_minutes?: number
          shift_date?: string
          shift_start: string
          site_id: string
          user_id: string
        }
        Update: {
          alert_sent_at?: string
          clock_in_at?: string | null
          id?: string
          late_minutes?: number
          shift_date?: string
          shift_start?: string
          site_id?: string
          user_id?: string
        }
        Relationships: []
      }
      leave_balances: {
        Row: {
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          total_days: number
          used_days: number
          user_id: string
          year: number
        }
        Insert: {
          id?: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          total_days?: number
          used_days?: number
          user_id: string
          year?: number
        }
        Update: {
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          total_days?: number
          used_days?: number
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          days: number
          end_date: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days: number
          end_date: string
          id?: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days?: number
          end_date?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          alert_on_geofence_violation: boolean
          alert_on_late_clock_in: boolean
          alert_on_panic_button: boolean
          enable_email: boolean
          enable_push: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_on_geofence_violation?: boolean
          alert_on_late_clock_in?: boolean
          alert_on_panic_button?: boolean
          enable_email?: boolean
          enable_push?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_on_geofence_violation?: boolean
          alert_on_late_clock_in?: boolean
          alert_on_panic_button?: boolean
          enable_email?: boolean
          enable_push?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      patrol_logs: {
        Row: {
          checkpoint_name: string | null
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          scanned_at: string
          site_id: string
          user_id: string
        }
        Insert: {
          checkpoint_name?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          scanned_at?: string
          site_id: string
          user_id: string
        }
        Update: {
          checkpoint_name?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          scanned_at?: string
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patrol_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "client_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          created_at: string
          employee_count: number
          id: string
          period: string
          run_date: string
          status: string
          total_deductions: number
          total_gross: number
          total_net: number
        }
        Insert: {
          created_at?: string
          employee_count?: number
          id?: string
          period: string
          run_date?: string
          status?: string
          total_deductions?: number
          total_gross?: number
          total_net?: number
        }
        Update: {
          created_at?: string
          employee_count?: number
          id?: string
          period?: string
          run_date?: string
          status?: string
          total_deductions?: number
          total_gross?: number
          total_net?: number
        }
        Relationships: []
      }
      payslips: {
        Row: {
          basic_pay: number
          created_at: string
          employee_nic: number
          employer_nic: number
          gross_pay: number
          id: string
          net_pay: number
          overtime_pay: number
          paye: number
          payroll_run_id: string | null
          period: string
          total_deductions: number
          user_id: string
        }
        Insert: {
          basic_pay?: number
          created_at?: string
          employee_nic?: number
          employer_nic?: number
          gross_pay?: number
          id?: string
          net_pay?: number
          overtime_pay?: number
          paye?: number
          payroll_run_id?: string | null
          period: string
          total_deductions?: number
          user_id: string
        }
        Update: {
          basic_pay?: number
          created_at?: string
          employee_nic?: number
          employer_nic?: number
          gross_pay?: number
          id?: string
          net_pay?: number
          overtime_pay?: number
          paye?: number
          payroll_run_id?: string | null
          period?: string
          total_deductions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslips_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      post_order_signoffs: {
        Row: {
          id: string
          post_orders_text: string | null
          signed_at: string
          site_id: string
          user_id: string
        }
        Insert: {
          id?: string
          post_orders_text?: string | null
          signed_at?: string
          site_id: string
          user_id: string
        }
        Update: {
          id?: string
          post_orders_text?: string | null
          signed_at?: string
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_order_signoffs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "client_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          department: string | null
          email: string
          first_name: string
          hr_details: Json
          id: string
          job_title: string | null
          jurisdiction: string
          last_name: string
          monthly_salary: number | null
          nic_number: string | null
          ot_rate: number | null
          person_id: string | null
          phone: string | null
          schedule: string | null
          social_security_number: string | null
          start_date: string | null
          status: string
          std_hours_per_day: number | null
          tan_number: string | null
          tax_id_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          department?: string | null
          email?: string
          first_name?: string
          hr_details?: Json
          id?: string
          job_title?: string | null
          jurisdiction?: string
          last_name?: string
          monthly_salary?: number | null
          nic_number?: string | null
          ot_rate?: number | null
          person_id?: string | null
          phone?: string | null
          schedule?: string | null
          social_security_number?: string | null
          start_date?: string | null
          status?: string
          std_hours_per_day?: number | null
          tan_number?: string | null
          tax_id_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          department?: string | null
          email?: string
          first_name?: string
          hr_details?: Json
          id?: string
          job_title?: string | null
          jurisdiction?: string
          last_name?: string
          monthly_salary?: number | null
          nic_number?: string | null
          ot_rate?: number | null
          person_id?: string | null
          phone?: string | null
          schedule?: string | null
          social_security_number?: string | null
          start_date?: string | null
          status?: string
          std_hours_per_day?: number | null
          tan_number?: string | null
          tax_id_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_assignments: {
        Row: {
          assigned_at: string
          hourly_rate: number | null
          id: string
          project_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string
          hourly_rate?: number | null
          id?: string
          project_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string
          hourly_rate?: number | null
          id?: string
          project_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_time_logs: {
        Row: {
          created_at: string
          description: string | null
          hours: number
          id: string
          log_date: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          hours?: number
          id?: string
          log_date?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          hours?: number
          id?: string
          log_date?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_time_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          budget: number | null
          client_name: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          budget?: number | null
          client_name?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          budget?: number | null
          client_name?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      qbo_account_mappings: {
        Row: {
          account_type: string
          category: string
          description: string
          id: string
          payroll_item: string
          qbo_account_id: string
          qbo_account_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_type?: string
          category?: string
          description?: string
          id?: string
          payroll_item: string
          qbo_account_id?: string
          qbo_account_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_type?: string
          category?: string
          description?: string
          id?: string
          payroll_item?: string
          qbo_account_id?: string
          qbo_account_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      qbo_chart_of_accounts: {
        Row: {
          account_name: string
          account_subtype: string | null
          account_type: string
          active: boolean
          created_at: string
          id: string
          qbo_account_id: string
          source: string
        }
        Insert: {
          account_name: string
          account_subtype?: string | null
          account_type?: string
          active?: boolean
          created_at?: string
          id?: string
          qbo_account_id?: string
          source?: string
        }
        Update: {
          account_name?: string
          account_subtype?: string | null
          account_type?: string
          active?: boolean
          created_at?: string
          id?: string
          qbo_account_id?: string
          source?: string
        }
        Relationships: []
      }
      qbo_connection: {
        Row: {
          access_token: string | null
          company_name: string | null
          connected_at: string | null
          connected_by: string | null
          environment: string
          id: string
          realm_id: string | null
          refresh_token: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          company_name?: string | null
          connected_at?: string | null
          connected_by?: string | null
          environment?: string
          id?: string
          realm_id?: string | null
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          company_name?: string | null
          connected_at?: string | null
          connected_by?: string | null
          environment?: string
          id?: string
          realm_id?: string | null
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      qbo_employee_map: {
        Row: {
          id: string
          last_synced_at: string | null
          qbo_display_name: string
          qbo_employee_id: string
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          last_synced_at?: string | null
          qbo_display_name?: string
          qbo_employee_id?: string
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          last_synced_at?: string | null
          qbo_display_name?: string
          qbo_employee_id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      qbo_sync_log: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          payload: Json | null
          payroll_run_id: string | null
          qbo_entity_id: string | null
          response: Json | null
          status: string
          sync_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          payroll_run_id?: string | null
          qbo_entity_id?: string | null
          response?: Json | null
          status?: string
          sync_type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          payroll_run_id?: string | null
          qbo_entity_id?: string | null
          response?: Json | null
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      training_documents: {
        Row: {
          category: string
          created_at: string
          description: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      user_pins: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          pin_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          pin_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          pin_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      geofence_violations: {
        Row: {
          actual_distance_meters: number | null
          allowed_radius: number | null
          client_site_name: string | null
          guard_jurisdiction: string | null
          guard_lat: number | null
          guard_lon: number | null
          guard_name: string | null
          jurisdiction_id: string | null
          punch_id: string | null
          punch_type: string | null
          punched_at: string | null
          shift_date: string | null
          site_name: string | null
          user_id: string | null
          within_geofence: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "client_sites_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_manager: { Args: { _user_id: string }; Returns: boolean }
      verify_guard_location: {
        Args: { _lat: number; _lon: number; _site_id: string }
        Returns: Json
      }
    }
    Enums: {
      addition_type:
        | "bonus"
        | "overtime"
        | "double_time"
        | "vacation_pay"
        | "commission"
        | "allowance"
        | "other"
      app_role: "admin" | "manager" | "employee"
      leave_status: "pending" | "approved" | "rejected"
      leave_type:
        | "annual"
        | "sick"
        | "personal"
        | "maternity"
        | "bereavement"
        | "study"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      addition_type: [
        "bonus",
        "overtime",
        "double_time",
        "vacation_pay",
        "commission",
        "allowance",
        "other",
      ],
      app_role: ["admin", "manager", "employee"],
      leave_status: ["pending", "approved", "rejected"],
      leave_type: [
        "annual",
        "sick",
        "personal",
        "maternity",
        "bereavement",
        "study",
      ],
    },
  },
} as const
