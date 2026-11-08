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
      active_company_selection: {
        Row: {
          org_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          org_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          org_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_company_selection_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      applicant_documents: {
        Row: {
          applicant_id: string
          document_type: string
          expiry_date: string | null
          file_name: string
          file_url: string
          id: string
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
          {
            foreignKeyName: "applicant_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applicants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_simulation_clock: {
        Row: {
          changed_by: string | null
          enabled: boolean
          id: boolean
          real_start: string
          run_id: string
          simulated_start: string
        }
        Insert: {
          changed_by?: string | null
          enabled?: boolean
          id?: boolean
          real_start?: string
          run_id?: string
          simulated_start?: string
        }
        Update: {
          changed_by?: string | null
          enabled?: boolean
          id?: boolean
          real_start?: string
          run_id?: string
          simulated_start?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          employee_id: string | null
          id: string
          org_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          employee_id?: string | null
          id?: string
          org_id?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          employee_id?: string | null
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
            foreignKeyName: "client_invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_access_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
          {
            foreignKeyName: "client_sites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clock_devices: {
        Row: {
          activated_at: string | null
          activation_expires_at: string | null
          activation_hash: string | null
          created_at: string
          created_by: string | null
          department: string | null
          id: string
          last_seen_at: string | null
          name: string
          org_id: string
          revoked_at: string | null
          site_id: string | null
          token_hash: string | null
        }
        Insert: {
          activated_at?: string | null
          activation_expires_at?: string | null
          activation_hash?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          last_seen_at?: string | null
          name: string
          org_id: string
          revoked_at?: string | null
          site_id?: string | null
          token_hash?: string | null
        }
        Update: {
          activated_at?: string | null
          activation_expires_at?: string | null
          activation_hash?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          last_seen_at?: string | null
          name?: string
          org_id?: string
          revoked_at?: string | null
          site_id?: string | null
          token_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clock_devices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clock_devices_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "client_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      clock_incidents: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          clock_id: string
          clock_type: string
          created_at: string
          detail: string
          first_detected_at: string
          id: string
          kind: string
          last_detected_at: string
          org_id: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          clock_id: string
          clock_type: string
          created_at?: string
          detail: string
          first_detected_at?: string
          id?: string
          kind: string
          last_detected_at?: string
          org_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          status?: string
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          clock_id?: string
          clock_type?: string
          created_at?: string
          detail?: string
          first_detected_at?: string
          id?: string
          kind?: string
          last_detected_at?: string
          org_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "clock_incidents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
          {
            foreignKeyName: "clock_punches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_admin_access: {
        Row: {
          created_at: string
          granted_by: string | null
          org_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          org_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          org_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_admin_access_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_picklists: {
        Row: {
          id: string
          items: string[]
          list_key: string
          org_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          items?: string[]
          list_key: string
          org_id?: string
          updated_at?: string
        }
        Update: {
          id?: string
          items?: string[]
          list_key?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_picklists_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          tax_id?: string | null
          telephone?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_number?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_setup_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          company_name: string
          created_at: string
          created_by: string
          defaults: Json
          email: string
          expires_at: string
          id: string
          org_id: string | null
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_name: string
          created_at?: string
          created_by: string
          defaults?: Json
          email: string
          expires_at?: string
          id?: string
          org_id?: string | null
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_name?: string
          created_at?: string
          created_by?: string
          defaults?: Json
          email?: string
          expires_at?: string
          id?: string
          org_id?: string | null
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_setup_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_super_administrators: {
        Row: {
          created_at: string
          org_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_super_administrators_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_payments: {
        Row: {
          amount: number
          contractor_id: string
          created_at: string
          description: string | null
          id: string
          invoice_number: string | null
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
            foreignKeyName: "contractor_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          phone?: string | null
          status?: string
          tax_id?: string | null
          trade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      creditors: {
        Row: {
          account_number: string | null
          contact_info: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creditors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_members: {
        Row: {
          crew_id: string
          id: string
          joined_at: string
          org_id: string | null
          user_id: string
        }
        Insert: {
          crew_id: string
          id?: string
          joined_at?: string
          org_id?: string | null
          user_id: string
        }
        Update: {
          crew_id?: string
          id?: string
          joined_at?: string
          org_id?: string | null
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
          {
            foreignKeyName: "crew_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
          project_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_user_id?: string | null
          name: string
          org_id?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_user_id?: string | null
          name?: string
          org_id?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crews_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
            foreignKeyName: "daily_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          site_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          period?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_additions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_bank_info: {
        Row: {
          account_number: string | null
          account_type: string | null
          bank_name: string | null
          branch: string | null
          id: string
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          routing_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_bank_info_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
          {
            foreignKeyName: "employee_deductions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          category: string
          created_at: string
          employee_key: string
          employee_visible: boolean
          expiry_date: string | null
          file_name: string
          file_size: number
          id: string
          org_id: string | null
          storage_path: string
          title: string
          uploaded_by: string
        }
        Insert: {
          category: string
          created_at?: string
          employee_key: string
          employee_visible?: boolean
          expiry_date?: string | null
          file_name: string
          file_size: number
          id?: string
          org_id?: string | null
          storage_path: string
          title: string
          uploaded_by?: string
        }
        Update: {
          category?: string
          created_at?: string
          employee_key?: string
          employee_visible?: boolean
          expiry_date?: string | null
          file_name?: string
          file_size?: number
          id?: string
          org_id?: string | null
          storage_path?: string
          title?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_loans: {
        Row: {
          balance: number
          created_at: string
          creditor_id: string
          id: string
          is_active: boolean
          monthly_repayment: number
          notes: string
          org_id: string
          original_amount: number
          user_id: string
        }
        Insert: {
          balance: number
          created_at?: string
          creditor_id: string
          id?: string
          is_active?: boolean
          monthly_repayment: number
          notes?: string
          org_id?: string
          original_amount: number
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          creditor_id?: string
          id?: string
          is_active?: boolean
          monthly_repayment?: number
          notes?: string
          org_id?: string
          original_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_loans_creditor_id_fkey"
            columns: ["creditor_id"]
            isOneToOne: false
            referencedRelation: "creditors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_loans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_payslips: {
        Row: {
          basic_pay: number
          created_at: string
          currency_code: string | null
          department_snapshot: string | null
          employee_name_snapshot: string | null
          employee_nic: number
          employer_nic: number
          gross_pay: number
          id: string
          net_pay: number
          org_id: string | null
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
          currency_code?: string | null
          department_snapshot?: string | null
          employee_name_snapshot?: string | null
          employee_nic?: number
          employer_nic?: number
          gross_pay?: number
          id?: string
          net_pay?: number
          org_id?: string | null
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
          currency_code?: string | null
          department_snapshot?: string | null
          employee_name_snapshot?: string | null
          employee_nic?: number
          employer_nic?: number
          gross_pay?: number
          id?: string
          net_pay?: number
          org_id?: string | null
          overtime_pay?: number
          paye?: number
          payroll_run_id?: string | null
          period?: string
          total_deductions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_payslips_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payslips_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payslips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "employee_records"
            referencedColumns: ["user_id"]
          },
        ]
      }
      employee_records: {
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
          login_user_id: string | null
          monthly_salary: number | null
          nic_number: string | null
          org_id: string | null
          ot_rate: number | null
          permanently_deleted_at: string | null
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
          login_user_id?: string | null
          monthly_salary?: number | null
          nic_number?: string | null
          org_id?: string | null
          ot_rate?: number | null
          permanently_deleted_at?: string | null
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
          login_user_id?: string | null
          monthly_salary?: number | null
          nic_number?: string | null
          org_id?: string | null
          ot_rate?: number | null
          permanently_deleted_at?: string | null
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
        Relationships: [
          {
            foreignKeyName: "employee_records_login_user_id_fkey"
            columns: ["login_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "employee_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_removal_jobs: {
        Row: {
          account_linked: boolean
          completed_at: string | null
          created_at: string
          employee_id: string
          id: string
          org_id: string
          requested_by: string
          status: string
          storage_paths: string[]
        }
        Insert: {
          account_linked: boolean
          completed_at?: string | null
          created_at?: string
          employee_id: string
          id?: string
          org_id: string
          requested_by: string
          status?: string
          storage_paths?: string[]
        }
        Update: {
          account_linked?: boolean
          completed_at?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          org_id?: string
          requested_by?: string
          status?: string
          storage_paths?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "employee_removal_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_checkouts: {
        Row: {
          checked_out_at: string
          condition_on_return: string | null
          equipment_id: string
          id: string
          notes: string | null
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
            foreignKeyName: "equipment_checkouts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      erpnext_account_mappings: {
        Row: {
          erp_account: string
          id: string
          org_id: string
          payroll_item: string
          updated_at: string
        }
        Insert: {
          erp_account: string
          id?: string
          org_id: string
          payroll_item: string
          updated_at?: string
        }
        Update: {
          erp_account?: string
          id?: string
          org_id?: string
          payroll_item?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erpnext_account_mappings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      erpnext_connection: {
        Row: {
          api_key: string
          api_secret: string
          auto_post: boolean
          base_url: string
          erp_company: string
          id: string
          last_message: string | null
          last_tested_at: string | null
          org_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key: string
          api_secret: string
          auto_post?: boolean
          base_url: string
          erp_company: string
          id?: string
          last_message?: string | null
          last_tested_at?: string | null
          org_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key?: string
          api_secret?: string
          auto_post?: boolean
          base_url?: string
          erp_company?: string
          id?: string
          last_message?: string | null
          last_tested_at?: string | null
          org_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erpnext_connection_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          radius_meters?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "geofence_zones_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      guard_assignments: {
        Row: {
          assigned_at: string
          days_of_week: string[] | null
          id: string
          is_active: boolean
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          shift_end?: string | null
          shift_start?: string | null
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guard_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guard_licenses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_reports: {
        Row: {
          ai_draft: string | null
          audio_url: string | null
          description: string | null
          id: string
          is_ai_generated: boolean | null
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
            foreignKeyName: "incident_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
          {
            foreignKeyName: "invoice_line_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          shift_date?: string
          shift_start?: string
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "late_clock_in_alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          org_id: string | null
          total_days: number
          used_days: number
          user_id: string
          year: number
        }
        Insert: {
          id?: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          org_id?: string | null
          total_days?: number
          used_days?: number
          user_id: string
          year?: number
        }
        Update: {
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          org_id?: string | null
          total_days?: number
          used_days?: number
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string
          days: number
          end_date: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_repayments: {
        Row: {
          amount: number
          created_at: string
          id: string
          loan_id: string
          org_id: string
          payroll_run_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          loan_id: string
          org_id: string
          payroll_run_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          loan_id?: string
          org_id?: string
          payroll_run_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "employee_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          alert_on_geofence_violation: boolean
          alert_on_late_clock_in: boolean
          alert_on_panic_button: boolean
          enable_email: boolean
          enable_push: boolean
          id: string
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_simulation_clock: {
        Row: {
          changed_by: string | null
          enabled: boolean
          id: string
          org_id: string
          real_start: string
          run_id: string
          simulated_start: string
        }
        Insert: {
          changed_by?: string | null
          enabled?: boolean
          id?: string
          org_id?: string
          real_start?: string
          run_id?: string
          simulated_start: string
        }
        Update: {
          changed_by?: string | null
          enabled?: boolean
          id?: string
          org_id?: string
          real_start?: string
          run_id?: string
          simulated_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_simulation_clock_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          demo_mode: boolean
          enabled_modules: string[]
          id: string
          logo_url: string | null
          name: string
          onboarding_config: Json | null
          onboarding_status: string
        }
        Insert: {
          created_at?: string
          demo_mode?: boolean
          enabled_modules?: string[]
          id?: string
          logo_url?: string | null
          name: string
          onboarding_config?: Json | null
          onboarding_status?: string
        }
        Update: {
          created_at?: string
          demo_mode?: boolean
          enabled_modules?: string[]
          id?: string
          logo_url?: string | null
          name?: string
          onboarding_config?: Json | null
          onboarding_status?: string
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          scanned_at?: string
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patrol_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patrol_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "client_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      paymaster_drafts: {
        Row: {
          acknowledged_at: string | null
          active_loans: number
          approved_run_id: string | null
          change_pct: number | null
          created_at: string
          employee_count: number
          flags: Json
          id: string
          last_gross: number | null
          last_reminded_at: string | null
          loan_repayments: number
          missing_punches: number
          org_id: string
          pay_date: string
          pending_shifts: number
          period_end: string
          period_start: string
          projected_gross: number
          reminder_count: number
          status: string
          suggestions: Json
          summary: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          active_loans?: number
          approved_run_id?: string | null
          change_pct?: number | null
          created_at?: string
          employee_count?: number
          flags?: Json
          id?: string
          last_gross?: number | null
          last_reminded_at?: string | null
          loan_repayments?: number
          missing_punches?: number
          org_id: string
          pay_date: string
          pending_shifts?: number
          period_end: string
          period_start: string
          projected_gross?: number
          reminder_count?: number
          status?: string
          suggestions?: Json
          summary?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          active_loans?: number
          approved_run_id?: string | null
          change_pct?: number | null
          created_at?: string
          employee_count?: number
          flags?: Json
          id?: string
          last_gross?: number | null
          last_reminded_at?: string | null
          loan_repayments?: number
          missing_punches?: number
          org_id?: string
          pay_date?: string
          pending_shifts?: number
          period_end?: string
          period_start?: string
          projected_gross?: number
          reminder_count?: number
          status?: string
          suggestions?: Json
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paymaster_drafts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      paymaster_settings: {
        Row: {
          enabled: boolean
          last_run_at: string | null
          lead_days: number
          lock_until: string | null
          org_id: string
          paused_reason: string | null
          pay_day: number
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          last_run_at?: string | null
          lead_days?: number
          lock_until?: string | null
          org_id: string
          paused_reason?: string | null
          pay_day?: number
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          last_run_at?: string | null
          lead_days?: number
          lock_until?: string | null
          org_id?: string
          paused_reason?: string | null
          pay_day?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paymaster_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_go_live: {
        Row: {
          org_id: string
          set_at: string
          set_by: string | null
          start_date: string
        }
        Insert: {
          org_id: string
          set_at?: string
          set_by?: string | null
          start_date: string
        }
        Update: {
          org_id?: string
          set_at?: string
          set_by?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_go_live_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          created_at: string
          currency_code: string | null
          departments: string[]
          employee_count: number
          id: string
          jurisdiction: string | null
          notes: string | null
          org_id: string | null
          pay_type: string
          period: string
          period_end: string | null
          period_start: string | null
          run_date: string
          status: string
          total_deductions: number
          total_gross: number
          total_net: number
        }
        Insert: {
          created_at?: string
          currency_code?: string | null
          departments?: string[]
          employee_count?: number
          id?: string
          jurisdiction?: string | null
          notes?: string | null
          org_id?: string | null
          pay_type?: string
          period: string
          period_end?: string | null
          period_start?: string | null
          run_date?: string
          status?: string
          total_deductions?: number
          total_gross?: number
          total_net?: number
        }
        Update: {
          created_at?: string
          currency_code?: string | null
          departments?: string[]
          employee_count?: number
          id?: string
          jurisdiction?: string | null
          notes?: string | null
          org_id?: string | null
          pay_type?: string
          period?: string
          period_end?: string | null
          period_start?: string | null
          run_date?: string
          status?: string
          total_deductions?: number
          total_gross?: number
          total_net?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          basic_pay: number
          created_at: string
          currency_code: string | null
          department_snapshot: string | null
          employee_name_snapshot: string | null
          employee_nic: number
          employer_nic: number
          gross_pay: number
          id: string
          net_pay: number
          org_id: string | null
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
          currency_code?: string | null
          department_snapshot?: string | null
          employee_name_snapshot?: string | null
          employee_nic?: number
          employer_nic?: number
          gross_pay?: number
          id?: string
          net_pay?: number
          org_id?: string | null
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
          currency_code?: string | null
          department_snapshot?: string | null
          employee_name_snapshot?: string | null
          employee_nic?: number
          employer_nic?: number
          gross_pay?: number
          id?: string
          net_pay?: number
          org_id?: string | null
          overtime_pay?: number
          paye?: number
          payroll_run_id?: string | null
          period?: string
          total_deductions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslips_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_administrators: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_order_signoffs: {
        Row: {
          id: string
          org_id: string | null
          post_orders_text: string | null
          signed_at: string
          site_id: string
          user_id: string
        }
        Insert: {
          id?: string
          org_id?: string | null
          post_orders_text?: string | null
          signed_at?: string
          site_id: string
          user_id: string
        }
        Update: {
          id?: string
          org_id?: string | null
          post_orders_text?: string | null
          signed_at?: string
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_order_signoffs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          is_employee: boolean
          job_title: string | null
          jurisdiction: string
          last_name: string
          login_username: string | null
          monthly_salary: number | null
          nic_number: string | null
          org_id: string | null
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
          is_employee?: boolean
          job_title?: string | null
          jurisdiction?: string
          last_name?: string
          login_username?: string | null
          monthly_salary?: number | null
          nic_number?: string | null
          org_id?: string | null
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
          is_employee?: boolean
          job_title?: string | null
          jurisdiction?: string
          last_name?: string
          login_username?: string | null
          monthly_salary?: number | null
          nic_number?: string | null
          org_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_assignments: {
        Row: {
          assigned_at: string
          hourly_rate: number | null
          id: string
          org_id: string | null
          project_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string
          hourly_rate?: number | null
          id?: string
          org_id?: string | null
          project_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string
          hourly_rate?: number | null
          id?: string
          org_id?: string | null
          project_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          org_id: string | null
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          hours?: number
          id?: string
          log_date?: string
          org_id?: string | null
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          hours?: number
          id?: string
          log_date?: string
          org_id?: string | null
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_time_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prototype_employees: {
        Row: {
          creditor_name: string | null
          department: string
          id: string
          job_title: string
          loan_balance: number
          monthly_deduction: number
          name: string
          org_id: string
          original_loan: number
          pay_frequency: string
          pay_rate: number
          weekly_hours: number
        }
        Insert: {
          creditor_name?: string | null
          department: string
          id?: string
          job_title: string
          loan_balance?: number
          monthly_deduction?: number
          name: string
          org_id?: string
          original_loan?: number
          pay_frequency: string
          pay_rate: number
          weekly_hours: number
        }
        Update: {
          creditor_name?: string | null
          department?: string
          id?: string
          job_title?: string
          loan_balance?: number
          monthly_deduction?: number
          name?: string
          org_id?: string
          original_loan?: number
          pay_frequency?: string
          pay_rate?: number
          weekly_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "prototype_employees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_account_mappings: {
        Row: {
          account_type: string
          category: string
          description: string
          id: string
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          payroll_item?: string
          qbo_account_id?: string
          qbo_account_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qbo_account_mappings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_chart_of_accounts: {
        Row: {
          account_name: string
          account_subtype: string | null
          account_type: string
          active: boolean
          created_at: string
          id: string
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          qbo_account_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "qbo_chart_of_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_connection: {
        Row: {
          access_token: string | null
          company_name: string | null
          connected_at: string | null
          connected_by: string | null
          environment: string
          id: string
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          realm_id?: string | null
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qbo_connection_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_employee_map: {
        Row: {
          id: string
          last_synced_at: string | null
          org_id: string | null
          qbo_display_name: string
          qbo_employee_id: string
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          last_synced_at?: string | null
          org_id?: string | null
          qbo_display_name?: string
          qbo_employee_id?: string
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          last_synced_at?: string | null
          org_id?: string | null
          qbo_display_name?: string
          qbo_employee_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qbo_employee_map_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_sync_log: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          payload?: Json | null
          payroll_run_id?: string | null
          qbo_entity_id?: string | null
          response?: Json | null
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "qbo_sync_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulated_attendance_punches: {
        Row: {
          id: string
          org_id: string | null
          punch_type: string
          recorded_at: string
          run_id: string
          simulated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          org_id?: string | null
          punch_type: string
          recorded_at?: string
          run_id: string
          simulated_at: string
          user_id: string
        }
        Update: {
          id?: string
          org_id?: string | null
          punch_type?: string
          recorded_at?: string
          run_id?: string
          simulated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulated_attendance_punches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_pay_requests: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          kind: string
          org_id: string
          reason: string
          requested_clock_in: string | null
          requested_clock_out: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shift_date: string | null
          shift_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          kind: string
          org_id: string
          reason: string
          requested_clock_in?: string | null
          requested_clock_out?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_date?: string | null
          shift_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          kind?: string
          org_id?: string
          reason?: string
          requested_clock_in?: string | null
          requested_clock_out?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_date?: string | null
          shift_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_pay_requests_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "workforce_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          geofence_radius: number
          id: string
          nic_rate: number
          org_id: string
          paye_rate: number
          paye_threshold: number
          test_only: boolean
        }
        Insert: {
          geofence_radius?: number
          id?: string
          nic_rate?: number
          org_id?: string
          paye_rate?: number
          paye_threshold?: number
          test_only?: boolean
        }
        Update: {
          geofence_radius?: number
          id?: string
          nic_rate?: number
          org_id?: string
          paye_rate?: number
          paye_threshold?: number
          test_only?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pin_attempts: {
        Row: {
          failures: number
          locked_until: string | null
          user_id: string
        }
        Insert: {
          failures?: number
          locked_until?: string | null
          user_id: string
        }
        Update: {
          failures?: number
          locked_until?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_pins: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          org_id: string | null
          pin_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          org_id?: string | null
          pin_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          org_id?: string | null
          pin_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pins_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          org_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_workspace_access: {
        Row: {
          access_title: string | null
          modules: string[]
          org_id: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          access_title?: string | null
          modules?: string[]
          org_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          access_title?: string | null
          modules?: string[]
          org_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_workspace_access_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_alerts: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          missing_type: string
          org_id: string
          resolved_at: string | null
          shift_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          missing_type: string
          org_id: string
          resolved_at?: string | null
          shift_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          missing_type?: string
          org_id?: string
          resolved_at?: string | null
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workforce_alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workforce_alerts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "workforce_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_clock_credentials: {
        Row: {
          bound_at: string | null
          bound_device_hash: string | null
          employee_code: string
          employee_id: string
          enabled: boolean
          failed_attempts: number
          last_seen_at: string | null
          locked_until: string | null
          org_id: string
          pin_hash: string
        }
        Insert: {
          bound_at?: string | null
          bound_device_hash?: string | null
          employee_code: string
          employee_id: string
          enabled?: boolean
          failed_attempts?: number
          last_seen_at?: string | null
          locked_until?: string | null
          org_id: string
          pin_hash: string
        }
        Update: {
          bound_at?: string | null
          bound_device_hash?: string | null
          employee_code?: string
          employee_id?: string
          enabled?: boolean
          failed_attempts?: number
          last_seen_at?: string | null
          locked_until?: string | null
          org_id?: string
          pin_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "workforce_clock_credentials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_clock_settings: {
        Row: {
          attendance_payroll: boolean
          default_break_minutes: number
          default_shift_end: string
          default_shift_start: string
          default_work_days: number[]
          org_id: string
          overtime_basis: string
          overtime_multiplier: number
          overtime_threshold: number
          paid_site_travel: boolean
          selfie_policy: string
          timezone: string
        }
        Insert: {
          attendance_payroll?: boolean
          default_break_minutes?: number
          default_shift_end?: string
          default_shift_start?: string
          default_work_days?: number[]
          org_id: string
          overtime_basis?: string
          overtime_multiplier?: number
          overtime_threshold?: number
          paid_site_travel?: boolean
          selfie_policy?: string
          timezone?: string
        }
        Update: {
          attendance_payroll?: boolean
          default_break_minutes?: number
          default_shift_end?: string
          default_shift_start?: string
          default_work_days?: number[]
          org_id?: string
          overtime_basis?: string
          overtime_multiplier?: number
          overtime_threshold?: number
          paid_site_travel?: boolean
          selfie_policy?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "workforce_clock_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_payroll_snapshots: {
        Row: {
          basis: string
          created_at: string
          employee_id: string
          hours: Json
          id: string
          org_id: string
          payroll_run_id: string
          rate: number
          shift_ids: string[]
        }
        Insert: {
          basis: string
          created_at?: string
          employee_id: string
          hours: Json
          id?: string
          org_id: string
          payroll_run_id: string
          rate: number
          shift_ids: string[]
        }
        Update: {
          basis?: string
          created_at?: string
          employee_id?: string
          hours?: Json
          id?: string
          org_id?: string
          payroll_run_id?: string
          rate?: number
          shift_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "workforce_payroll_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workforce_payroll_snapshots_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_punches: {
        Row: {
          captured_offline: boolean
          client_punch_id: string | null
          device_id: string | null
          direction: string
          employee_id: string
          id: string
          latitude: number | null
          longitude: number | null
          mode: string
          org_id: string
          photo_path: string | null
          punched_at: string
          received_at: string
          shift_id: string
          site_id: string | null
        }
        Insert: {
          captured_offline?: boolean
          client_punch_id?: string | null
          device_id?: string | null
          direction: string
          employee_id: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          mode: string
          org_id: string
          photo_path?: string | null
          punched_at?: string
          received_at?: string
          shift_id: string
          site_id?: string | null
        }
        Update: {
          captured_offline?: boolean
          client_punch_id?: string | null
          device_id?: string | null
          direction?: string
          employee_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          mode?: string
          org_id?: string
          photo_path?: string | null
          punched_at?: string
          received_at?: string
          shift_id?: string
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workforce_punches_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "clock_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workforce_punches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workforce_punches_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "workforce_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workforce_punches_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "client_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_schedules: {
        Row: {
          allowed_methods: string[]
          break_minutes: number
          days_of_week: number[]
          employee_id: string
          enabled: boolean
          id: string
          org_id: string
          roaming: boolean
          shift_end: string
          shift_start: string
          site_id: string | null
        }
        Insert: {
          allowed_methods?: string[]
          break_minutes?: number
          days_of_week?: number[]
          employee_id: string
          enabled?: boolean
          id?: string
          org_id: string
          roaming?: boolean
          shift_end: string
          shift_start: string
          site_id?: string | null
        }
        Update: {
          allowed_methods?: string[]
          break_minutes?: number
          days_of_week?: number[]
          employee_id?: string
          enabled?: boolean
          id?: string
          org_id?: string
          roaming?: boolean
          shift_end?: string
          shift_start?: string
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workforce_schedules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workforce_schedules_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "client_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_shifts: {
        Row: {
          approved_hours: number | null
          break_minutes: number
          clock_in: string | null
          clock_out: string | null
          employee_id: string
          id: string
          lunch_in: string | null
          lunch_out: string | null
          org_id: string
          review_notes: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          shift_date: string
          site_gap_minutes: number
        }
        Insert: {
          approved_hours?: number | null
          break_minutes?: number
          clock_in?: string | null
          clock_out?: string | null
          employee_id: string
          id?: string
          lunch_in?: string | null
          lunch_out?: string | null
          org_id: string
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          shift_date: string
          site_gap_minutes?: number
        }
        Update: {
          approved_hours?: number | null
          break_minutes?: number
          clock_in?: string | null
          clock_out?: string | null
          employee_id?: string
          id?: string
          lunch_in?: string | null
          lunch_out?: string | null
          org_id?: string
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          shift_date?: string
          site_gap_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "workforce_shifts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      payroll_employee_directory: {
        Row: {
          account_linked: boolean | null
          created_at: string | null
          deleted_at: string | null
          department: string | null
          email: string | null
          first_name: string | null
          hr_details: Json | null
          id: string | null
          job_title: string | null
          jurisdiction: string | null
          last_name: string | null
          monthly_salary: number | null
          nic_number: string | null
          org_id: string | null
          ot_rate: number | null
          person_id: string | null
          phone: string | null
          schedule: string | null
          social_security_number: string | null
          start_date: string | null
          status: string | null
          std_hours_per_day: number | null
          tan_number: string | null
          tax_id_number: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
      payroll_payslip_directory: {
        Row: {
          basic_pay: number | null
          created_at: string | null
          currency_code: string | null
          department_snapshot: string | null
          employee_name_snapshot: string | null
          employee_nic: number | null
          employer_nic: number | null
          gross_pay: number | null
          id: string | null
          net_pay: number | null
          org_id: string | null
          overtime_pay: number | null
          paye: number | null
          payroll_run_id: string | null
          period: string | null
          total_deductions: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      actor_manages_org: {
        Args: { _actor: string; _org: string }
        Returns: boolean
      }
      administrator_authority: { Args: { _user: string }; Returns: Json }
      apply_payroll_loans: {
        Args: {
          _employee: string
          _factor: number
          _run: string
          _submitted: number
        }
        Returns: undefined
      }
      approve_department_payroll: {
        Args: {
          _departments: string[]
          _jurisdiction: string
          _period: string
          _rows: Json
        }
        Returns: string
      }
      approve_payroll_run: {
        Args: {
          _departments: string[]
          _end: string
          _jurisdiction: string
          _notes?: string
          _pay_type: string
          _rows: Json
          _start: string
        }
        Returns: string
      }
      approve_payslip_import: {
        Args: {
          _end: string
          _jurisdiction: string
          _notes?: string
          _rows: Json
          _start: string
        }
        Returns: string
      }
      assign_paymaster_companies: {
        Args: { _modules: string[]; _orgs: string[]; _user: string }
        Returns: undefined
      }
      bulk_issue_clock_codes: { Args: { _ids: string[] }; Returns: Json }
      can_access_applicant_file: { Args: { _path: string }; Returns: boolean }
      can_access_employee_document: {
        Args: { _employee: string; _shared: boolean }
        Returns: boolean
      }
      can_erase_payroll: { Args: { _org: string }; Returns: boolean }
      can_manage_clock_devices: { Args: { _org: string }; Returns: boolean }
      can_view_company: { Args: { _org: string }; Returns: boolean }
      claim_clock_device: {
        Args: { _device_hash: string; _employee: string; _org: string }
        Returns: boolean
      }
      claim_user_pin_attempt: { Args: { _user: string }; Returns: boolean }
      clear_punch_selfie: { Args: { _punch_id: string }; Returns: string }
      client_portal_data: { Args: { _code: string }; Returns: Json }
      clock_monitoring: { Args: never; Returns: Json }
      clock_phone_bindings: {
        Args: never
        Returns: {
          bound_at: string
          employee_id: string
        }[]
      }
      companies_overview: {
        Args: never
        Returns: {
          active_employees: number
          id: string
          last_net: number
          last_period: string
          name: string
          open_alerts: number
          pending_runs: number
        }[]
      }
      company_configuration: { Args: never; Returns: Json }
      company_dashboard_summaries: { Args: { _all?: boolean }; Returns: Json }
      complete_company_setup: {
        Args: { _details: Json; _token: string; _user: string }
        Returns: string
      }
      configure_employee_clock: {
        Args: {
          _break: number
          _code: string
          _days: number[]
          _employee: string
          _enabled?: boolean
          _end: string
          _pin: string
          _site?: string
          _start: string
        }
        Returns: undefined
      }
      configure_employee_clock_methods: {
        Args: {
          _break: number
          _code: string
          _days: number[]
          _employee: string
          _enabled: boolean
          _end: string
          _methods: string[]
          _pin: string
          _site: string
          _start: string
        }
        Returns: undefined
      }
      create_clock_device: {
        Args: { _department: string; _name: string; _site: string }
        Returns: Json
      }
      create_employee_loan: {
        Args: {
          _balance: number
          _creditor: string
          _employee: string
          _monthly: number
          _notes?: string
          _original: number
        }
        Returns: string
      }
      create_invited_profile: {
        Args: {
          _email: string
          _first: string
          _last: string
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      current_org_id: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      delete_punch_selfie: { Args: { _punch_id: string }; Returns: boolean }
      employee_clock_configuration: {
        Args: { _employee: string }
        Returns: Json
      }
      employee_org_id: { Args: { _employee: string }; Returns: string }
      erase_payroll_data: {
        Args: {
          _confirmation: string
          _end: string
          _orgs: string[]
          _start: string
        }
        Returns: Json
      }
      finish_employee_removal: {
        Args: { _actor: string; _job: string }
        Returns: undefined
      }
      has_employee_clock_access: {
        Args: { _employee: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_workspace_access: {
        Args: { _module: string; _user_id: string }
        Returns: boolean
      }
      is_admin_or_manager: { Args: { _user_id: string }; Returns: boolean }
      is_company_super_admin: { Args: { _user: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      issue_company_setup: {
        Args: { _create_now?: boolean; _details: Json }
        Returns: Json
      }
      link_employee_login: {
        Args: { _actor: string; _employee: string; _user: string }
        Returns: undefined
      }
      list_activatable_clocks: { Args: never; Returns: Json }
      multi_company_admins: {
        Args: never
        Returns: {
          email: string
          home_company: string
          name: string
          org_ids: string[]
          user_id: string
        }[]
      }
      my_companies: {
        Args: never
        Returns: {
          id: string
          is_current: boolean
          is_home: boolean
          name: string
        }[]
      }
      my_pay_preview: { Args: { _end: string; _start: string }; Returns: Json }
      my_workspace_access: { Args: never; Returns: Json }
      paymaster_assignment_candidates: {
        Args: never
        Returns: {
          email: string
          home_company: string
          home_org_id: string
          name: string
          org_ids: string[]
          user_id: string
        }[]
      }
      paymaster_assignment_details: {
        Args: { _user: string }
        Returns: string[]
      }
      payroll_period_factor: {
        Args: { _end: string; _pay_type: string; _start: string }
        Returns: number
      }
      platform_companies: {
        Args: never
        Returns: {
          created_at: string
          details: Json
          id: string
          name: string
          onboarding_status: string
        }[]
      }
      prepare_employee_removal: {
        Args: { _actor: string; _confirmation: string; _employee: string }
        Returns: {
          account_linked: boolean
          completed_at: string | null
          created_at: string
          employee_id: string
          id: string
          org_id: string
          requested_by: string
          status: string
          storage_paths: string[]
        }
        SetofOptions: {
          from: "*"
          to: "employee_removal_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reconcile_workforce_attendance: {
        Args: { _org?: string }
        Returns: number
      }
      record_simulated_punch: {
        Args: { _type: string }
        Returns: {
          id: string
          org_id: string | null
          punch_type: string
          recorded_at: string
          run_id: string
          simulated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "simulated_attendance_punches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_workforce_punch: {
        Args: {
          _direction: string
          _employee: string
          _lat?: number
          _lon?: number
          _mode: string
          _org: string
        }
        Returns: Json
      }
      record_workforce_punch_at: {
        Args: {
          _at: string
          _client: string
          _direction: string
          _employee: string
          _lat: number
          _lon: number
          _mode: string
          _org: string
        }
        Returns: Json
      }
      renew_clock_device_code: { Args: { _id: string }; Returns: Json }
      reset_attendance_simulation: {
        Args: { _enabled: boolean; _start: string }
        Returns: {
          changed_by: string | null
          enabled: boolean
          id: boolean
          real_start: string
          run_id: string
          simulated_start: string
        }
        SetofOptions: {
          from: "*"
          to: "attendance_simulation_clock"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reset_clock_phone: { Args: { _employee: string }; Returns: undefined }
      reset_company_simulation: {
        Args: { _enabled: boolean; _start: string }
        Returns: {
          changed_by: string | null
          enabled: boolean
          id: string
          org_id: string
          real_start: string
          run_id: string
          simulated_start: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_simulation_clock"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_clock_incident: {
        Args: { _action: string; _id: string }
        Returns: undefined
      }
      review_staff_pay_request: {
        Args: { _approve: boolean; _id: string; _note: string }
        Returns: undefined
      }
      review_workforce_shift: {
        Args: { _hours: number; _notes: string; _shift: string }
        Returns: undefined
      }
      revoke_clock_device: { Args: { _id: string }; Returns: undefined }
      revoke_company_setup: { Args: { _id: string }; Returns: undefined }
      save_own_staff_information: {
        Args: { _details: Json; _user: string }
        Returns: undefined
      }
      save_workforce_settings: {
        Args: {
          _basis: string
          _multiplier: number
          _payroll: boolean
          _threshold: number
          _timezone: string
        }
        Returns: undefined
      }
      scan_clock_health: { Args: { _org?: string }; Returns: Json }
      set_administrator_authority: {
        Args: { _company: boolean; _platform: boolean; _user: string }
        Returns: undefined
      }
      set_company_admin_access: {
        Args: { _orgs: string[]; _user: string }
        Returns: undefined
      }
      set_employee_clock_roaming: {
        Args: { _employee: string; _roaming: boolean }
        Returns: undefined
      }
      set_employee_loan_active: {
        Args: { _active: boolean; _loan: string }
        Returns: undefined
      }
      set_paid_site_travel: { Args: { _paid: boolean }; Returns: undefined }
      set_payroll_go_live: {
        Args: { _confirmation: string; _orgs: string[]; _start: string }
        Returns: Json
      }
      set_selfie_policy: { Args: { _policy: string }; Returns: undefined }
      set_user_workspace_access: {
        Args: {
          _modules: string[]
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      set_user_workspace_access_titled: {
        Args: { _modules: string[]; _title: string; _user_id: string }
        Returns: undefined
      }
      staff_employment_key: { Args: never; Returns: string }
      submit_staff_pay_request: {
        Args: {
          _date: string
          _in: string
          _kind: string
          _out: string
          _reason: string
          _shift: string
        }
        Returns: string
      }
      switch_company: { Args: { _org: string }; Returns: undefined }
      update_platform_company: {
        Args: { _actor: string; _details: Json; _org: string }
        Returns: undefined
      }
      validate_company_modules: { Args: { _modules: Json }; Returns: undefined }
      validate_company_setup: { Args: { _details: Json }; Returns: undefined }
      validate_manual_pay: {
        Args: {
          _basic: number
          _employee: string
          _factor: number
          _h: Json
          _ot: number
        }
        Returns: undefined
      }
      validate_onboarding_pack: { Args: { _pack: Json }; Returns: undefined }
      validate_pay_lines: { Args: { _row: Json }; Returns: undefined }
      validate_workforce_pay: {
        Args: {
          _basic: number
          _employee: string
          _end: string
          _ot: number
          _start: string
        }
        Returns: undefined
      }
      verify_guard_location: {
        Args: { _lat: number; _lon: number; _site_id: string }
        Returns: Json
      }
      workforce_pay_hours: {
        Args: { _employee: string; _end: string; _start: string }
        Returns: Json
      }
      workforce_pin_employee: {
        Args: { _code: string; _org: string; _pin: string }
        Returns: string
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
