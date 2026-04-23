import type {
  OutreachStatus,
  OutreachTrack,
  VenueType,
  TemplateType,
  CommissionTier,
  MetricCategory,
  TaskPriority,
  TaskRecurrence,
  PaymentMethod,
  VenueEmailStatus,
  DealTerms,
  TemplateSection,
} from './index'

export interface Database {
  public: {
    Tables: {
      venues: {
        Row: {
          id: string
          user_id: string
          name: string
          location: string | null
          city: string | null
          address_line2: string | null
          region: string | null
          postal_code: string | null
          country: string | null
          venue_type: VenueType
          priority: number
          status: OutreachStatus
          outreach_track: OutreachTrack
          follow_up_date: string | null
          deal_terms: DealTerms | null
          capacity: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          location?: string | null
          city?: string | null
          address_line2?: string | null
          region?: string | null
          postal_code?: string | null
          country?: string | null
          venue_type?: VenueType
          priority?: number
          status?: OutreachStatus
          outreach_track?: OutreachTrack
          follow_up_date?: string | null
          deal_terms?: DealTerms | null
          capacity?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          location?: string | null
          city?: string | null
          address_line2?: string | null
          region?: string | null
          postal_code?: string | null
          country?: string | null
          venue_type?: VenueType
          priority?: number
          status?: OutreachStatus
          outreach_track?: OutreachTrack
          follow_up_date?: string | null
          deal_terms?: DealTerms | null
          capacity?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      cold_calls: {
        Row: {
          id: string
          user_id: string
          venue_id: string | null
          contact_id: string | null
          title: string
          call_date: string | null
          temperature: string
          outcome: string
          call_purpose: string
          duration_feel: string
          who_answered: string
          rejection_reason: string | null
          save_to_pipeline: boolean
          converted_to_intake_id: string | null
          previous_call_id: string | null
          call_data: unknown
          notes: string | null
          follow_up_date: string | null
          follow_up_task_id: string | null
          next_actions: unknown
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          venue_id?: string | null
          contact_id?: string | null
          title?: string
          call_date?: string | null
          temperature?: string
          outcome?: string
          call_purpose?: string
          duration_feel?: string
          who_answered?: string
          rejection_reason?: string | null
          save_to_pipeline?: boolean
          converted_to_intake_id?: string | null
          previous_call_id?: string | null
          call_data?: unknown
          notes?: string | null
          follow_up_date?: string | null
          follow_up_task_id?: string | null
          next_actions?: unknown
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          venue_id?: string | null
          contact_id?: string | null
          title?: string
          call_date?: string | null
          temperature?: string
          outcome?: string
          call_purpose?: string
          duration_feel?: string
          who_answered?: string
          rejection_reason?: string | null
          save_to_pipeline?: boolean
          converted_to_intake_id?: string | null
          previous_call_id?: string | null
          call_data?: unknown
          notes?: string | null
          follow_up_date?: string | null
          follow_up_task_id?: string | null
          next_actions?: unknown
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          id: string
          user_id: string
          venue_id: string
          name: string
          title_key: string | null
          role: string | null
          email: string | null
          phone: string | null
          company: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          venue_id: string
          name: string
          title_key?: string | null
          role?: string | null
          email?: string | null
          phone?: string | null
          company?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          venue_id?: string
          name?: string
          title_key?: string | null
          role?: string | null
          email?: string | null
          phone?: string | null
          company?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'contacts_venue_id_fkey'
            columns: ['venue_id']
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      outreach_notes: {
        Row: {
          id: string
          user_id: string
          venue_id: string
          note: string
          category: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          venue_id: string
          note: string
          category?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          venue_id?: string
          note?: string
          category?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'outreach_notes_venue_id_fkey'
            columns: ['venue_id']
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      templates: {
        Row: {
          id: string
          user_id: string
          name: string
          type: TemplateType
          sections: TemplateSection[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type?: TemplateType
          sections?: TemplateSection[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: TemplateType
          sections?: TemplateSection[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      generated_files: {
        Row: {
          id: string
          user_id: string
          name: string
          template_id: string | null
          venue_id: string | null
          deal_id: string | null
          folder_id: string | null
          content: string
          output_format: 'text' | 'pdf'
          file_source: 'generated' | 'upload'
          pdf_storage_path: string | null
          pdf_public_url: string | null
          pdf_share_slug: string | null
          upload_storage_path: string | null
          upload_public_url: string | null
          upload_mime_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          template_id?: string | null
          venue_id?: string | null
          deal_id?: string | null
          folder_id?: string | null
          content?: string
          output_format?: 'text' | 'pdf'
          file_source?: 'generated' | 'upload'
          pdf_storage_path?: string | null
          pdf_public_url?: string | null
          pdf_share_slug?: string | null
          upload_storage_path?: string | null
          upload_public_url?: string | null
          upload_mime_type?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          template_id?: string | null
          venue_id?: string | null
          deal_id?: string | null
          folder_id?: string | null
          content?: string
          output_format?: 'text' | 'pdf'
          file_source?: 'generated' | 'upload'
          pdf_storage_path?: string | null
          pdf_public_url?: string | null
          pdf_share_slug?: string | null
          upload_storage_path?: string | null
          upload_public_url?: string | null
          upload_mime_type?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'generated_files_template_id_fkey'
            columns: ['template_id']
            referencedRelation: 'templates'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'generated_files_venue_id_fkey'
            columns: ['venue_id']
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'generated_files_deal_id_fkey'
            columns: ['deal_id']
            referencedRelation: 'deals'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'generated_files_folder_id_fkey'
            columns: ['folder_id']
            referencedRelation: 'document_folders'
            referencedColumns: ['id']
          },
        ]
      }
      deals: {
        Row: {
          id: string
          user_id: string
          description: string
          venue_id: string | null
          event_date: string | null
          event_start_at: string | null
          event_end_at: string | null
          event_cancelled_at: string | null
          google_shared_calendar_event_id: string | null
          google_shared_calendar_event_etag: string | null
          calendar_first_listed_at: string | null
          ics_invite_sent_at: string | null
          reminder_24h_queued_at: string | null
          performance_genre: string | null
          performance_start_at: string | null
          performance_end_at: string | null
          onsite_contact_id: string | null
          gross_amount: number
          commission_tier: CommissionTier
          commission_rate: number
          commission_amount: number
          artist_paid: boolean
          artist_paid_date: string | null
          manager_paid: boolean
          manager_paid_date: string | null
          payment_due_date: string | null
          agreement_url: string | null
          agreement_generated_file_id: string | null
          promise_lines: unknown | null
          pricing_snapshot: unknown | null
          deposit_due_amount: number | null
          deposit_paid_amount: number
          balance_paid_amount: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          description: string
          venue_id?: string | null
          event_date?: string | null
          event_start_at?: string | null
          event_end_at?: string | null
          event_cancelled_at?: string | null
          google_shared_calendar_event_id?: string | null
          google_shared_calendar_event_etag?: string | null
          calendar_first_listed_at?: string | null
          ics_invite_sent_at?: string | null
          reminder_24h_queued_at?: string | null
          performance_genre?: string | null
          performance_start_at?: string | null
          performance_end_at?: string | null
          onsite_contact_id?: string | null
          gross_amount: number
          commission_tier: CommissionTier
          commission_rate: number
          commission_amount: number
          artist_paid?: boolean
          artist_paid_date?: string | null
          manager_paid?: boolean
          manager_paid_date?: string | null
          payment_due_date?: string | null
          agreement_url?: string | null
          agreement_generated_file_id?: string | null
          promise_lines?: unknown | null
          pricing_snapshot?: unknown | null
          deposit_due_amount?: number | null
          deposit_paid_amount?: number
          balance_paid_amount?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          description?: string
          venue_id?: string | null
          event_date?: string | null
          event_start_at?: string | null
          event_end_at?: string | null
          event_cancelled_at?: string | null
          google_shared_calendar_event_id?: string | null
          google_shared_calendar_event_etag?: string | null
          calendar_first_listed_at?: string | null
          ics_invite_sent_at?: string | null
          reminder_24h_queued_at?: string | null
          performance_genre?: string | null
          performance_start_at?: string | null
          performance_end_at?: string | null
          onsite_contact_id?: string | null
          gross_amount?: number
          commission_tier?: CommissionTier
          commission_rate?: number
          commission_amount?: number
          artist_paid?: boolean
          artist_paid_date?: string | null
          manager_paid?: boolean
          manager_paid_date?: string | null
          payment_due_date?: string | null
          agreement_url?: string | null
          agreement_generated_file_id?: string | null
          promise_lines?: unknown | null
          pricing_snapshot?: unknown | null
          deposit_due_amount?: number | null
          deposit_paid_amount?: number
          balance_paid_amount?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'deals_venue_id_fkey'
            columns: ['venue_id']
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'deals_onsite_contact_id_fkey'
            columns: ['onsite_contact_id']
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
        ]
      }
      document_folders: {
        Row: {
          id: string
          user_id: string
          name: string
          parent_id: string | null
          created_at: string
          accent: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          parent_id?: string | null
          created_at?: string
          accent?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          parent_id?: string | null
          created_at?: string
          accent?: string
        }
        Relationships: [
          {
            foreignKeyName: 'document_folders_parent_id_fkey'
            columns: ['parent_id']
            referencedRelation: 'document_folders'
            referencedColumns: ['id']
          },
        ]
      }
      user_pricing_catalog: {
        Row: {
          user_id: string
          doc: unknown
          updated_at: string
        }
        Insert: {
          user_id: string
          doc?: unknown
          updated_at?: string
        }
        Update: {
          user_id?: string
          doc?: unknown
          updated_at?: string
        }
        Relationships: []
      }
      artist_profile: {
        Row: {
          user_id: string
          artist_name: string
          artist_email: string
          manager_name: string | null
          manager_title: string | null
          manager_email: string | null
          manager_phone: string | null
          from_email: string
          company_name: string | null
          website: string | null
          phone: string | null
          social_handle: string | null
          tagline: string | null
          reply_to_email: string | null
          email_queue_buffer_minutes?: number
          email_usage_day_offset: number
          email_usage_month_offset: number
          resend_daily_email_cap: number | null
          resend_monthly_email_cap: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          artist_name?: string
          artist_email?: string
          manager_name?: string | null
          manager_title?: string | null
          manager_email?: string | null
          manager_phone?: string | null
          from_email?: string
          company_name?: string | null
          website?: string | null
          phone?: string | null
          social_handle?: string | null
          tagline?: string | null
          reply_to_email?: string | null
          email_queue_buffer_minutes?: number
          email_usage_day_offset?: number
          email_usage_month_offset?: number
          resend_daily_email_cap?: number | null
          resend_monthly_email_cap?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          artist_name?: string
          artist_email?: string
          manager_name?: string | null
          manager_title?: string | null
          manager_email?: string | null
          manager_phone?: string | null
          from_email?: string
          company_name?: string | null
          website?: string | null
          phone?: string | null
          social_handle?: string | null
          tagline?: string | null
          reply_to_email?: string | null
          email_queue_buffer_minutes?: number
          email_usage_day_offset?: number
          email_usage_month_offset?: number
          resend_daily_email_cap?: number | null
          resend_monthly_email_cap?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      artist_partnership_roll_entries: {
        Row: {
          id: string
          user_id: string
          name: string
          cohort: 'recent' | 'older'
          is_confirmed: boolean
          confirmed_at: string | null
          source: 'system' | 'dj' | 'admin' | 'mock'
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          cohort?: 'recent' | 'older'
          is_confirmed?: boolean
          confirmed_at?: string | null
          source?: 'system' | 'dj' | 'admin' | 'mock'
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          cohort?: 'recent' | 'older'
          is_confirmed?: boolean
          confirmed_at?: string | null
          source?: 'system' | 'dj' | 'admin' | 'mock'
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      partnership_roll_public_owner: {
        Row: {
          id: number
          artist_user_id: string
          edit_window_ends_at: string | null
          confirmed_at: string | null
          confirmation_document_downloaded_at: string | null
        }
        Insert: {
          id?: number
          artist_user_id: string
          edit_window_ends_at?: string | null
          confirmed_at?: string | null
          confirmation_document_downloaded_at?: string | null
        }
        Update: {
          id?: number
          artist_user_id?: string
          edit_window_ends_at?: string | null
          confirmed_at?: string | null
          confirmation_document_downloaded_at?: string | null
        }
        Relationships: []
      }
      booking_intake_shows: {
        Row: {
          id: string
          intake_id: string
          label: string
          show_data: unknown
          sort_order: number
          imported_deal_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          intake_id: string
          label?: string
          show_data?: unknown
          sort_order?: number
          imported_deal_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          intake_id?: string
          label?: string
          show_data?: unknown
          sort_order?: number
          imported_deal_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'booking_intake_shows_intake_id_fkey'
            columns: ['intake_id']
            referencedRelation: 'booking_intakes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'booking_intake_shows_imported_deal_id_fkey'
            columns: ['imported_deal_id']
            referencedRelation: 'deals'
            referencedColumns: ['id']
          },
        ]
      }
      booking_intakes: {
        Row: {
          id: string
          user_id: string
          title: string
          venue_data: unknown
          schema_version: number
          source_type: string
          source_cold_call_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string
          venue_data?: unknown
          schema_version?: number
          source_type?: string
          source_cold_call_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          venue_data?: unknown
          schema_version?: number
          source_type?: string
          source_cold_call_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_field_preset: {
        Row: {
          id: string
          user_id: string
          field_key: string
          value: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          field_key: string
          value: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          field_key?: string
          value?: string
          created_at?: string
        }
        Relationships: []
      }
      nav_badges: {
        Row: {
          user_id: string
          seen_at: Record<string, string>
        }
        Insert: {
          user_id: string
          seen_at?: Record<string, string>
        }
        Update: {
          user_id?: string
          seen_at?: Record<string, string>
        }
        Relationships: []
      }
      resend_outbound_send_log: {
        Row: {
          id: string
          user_id: string
          resend_message_id: string
          sent_at: string
          source: string
        }
        Insert: {
          id?: string
          user_id: string
          resend_message_id: string
          sent_at?: string
          source: string
        }
        Update: {
          id?: string
          user_id?: string
          resend_message_id?: string
          sent_at?: string
          source?: string
        }
        Relationships: []
      }
      lead_folders: {
        Row: {
          id: string
          user_id: string
          name: string
          sort_order: number
          is_system: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          sort_order?: number
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          sort_order?: number
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_email_events: {
        Row: {
          id: string
          user_id: string
          lead_id: string
          custom_email_template_id: string | null
          email_type: string
          recipient_email: string
          subject: string
          status: VenueEmailStatus
          sent_at: string | null
          resend_message_id: string | null
          notes: string | null
          task_id: string | null
          folder_id_before: string | null
          moved_to_folder_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          lead_id: string
          custom_email_template_id?: string | null
          email_type: string
          recipient_email: string
          subject: string
          status?: VenueEmailStatus
          sent_at?: string | null
          resend_message_id?: string | null
          notes?: string | null
          task_id?: string | null
          folder_id_before?: string | null
          moved_to_folder_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          lead_id?: string
          custom_email_template_id?: string | null
          email_type?: string
          recipient_email?: string
          subject?: string
          status?: VenueEmailStatus
          sent_at?: string | null
          resend_message_id?: string | null
          notes?: string | null
          task_id?: string | null
          folder_id_before?: string | null
          moved_to_folder_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lead_email_events_lead_fkey'
            columns: ['lead_id']
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lead_email_events_custom_email_template_id_fkey'
            columns: ['custom_email_template_id']
            referencedRelation: 'custom_email_templates'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lead_email_events_task_id_fkey'
            columns: ['task_id']
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
      lead_folder_movements: {
        Row: {
          id: string
          user_id: string
          lead_id: string
          from_folder_id: string | null
          to_folder_id: string
          source: 'manual' | 'email_template_send'
          custom_email_template_id: string | null
          task_id: string | null
          lead_email_event_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          lead_id: string
          from_folder_id?: string | null
          to_folder_id: string
          source: 'manual' | 'email_template_send'
          custom_email_template_id?: string | null
          task_id?: string | null
          lead_email_event_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          lead_id?: string
          from_folder_id?: string | null
          to_folder_id?: string
          source?: 'manual' | 'email_template_send'
          custom_email_template_id?: string | null
          task_id?: string | null
          lead_email_event_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          id: string
          user_id: string
          folder_id: string
          venue_name: string | null
          instagram_handle: string | null
          genre: string | null
          event_name: string | null
          crowd_type: string | null
          resident_dj: string | null
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          website: string | null
          research_notes: string | null
          promoted_venue_id: string | null
          promoted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          folder_id: string
          venue_name?: string | null
          instagram_handle?: string | null
          genre?: string | null
          event_name?: string | null
          crowd_type?: string | null
          resident_dj?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          website?: string | null
          research_notes?: string | null
          promoted_venue_id?: string | null
          promoted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          folder_id?: string
          venue_name?: string | null
          instagram_handle?: string | null
          genre?: string | null
          event_name?: string | null
          crowd_type?: string | null
          resident_dj?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          website?: string | null
          research_notes?: string | null
          promoted_venue_id?: string | null
          promoted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'leads_user_folder_fkey'
            columns: ['folder_id']
            referencedRelation: 'lead_folders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'leads_promoted_venue_fkey'
            columns: ['promoted_venue_id']
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      venue_emails: {
        Row: {
          id: string
          user_id: string
          venue_id: string | null
          deal_id: string | null
          contact_id: string | null
          email_type: string
          recipient_email: string
          subject: string
          status: VenueEmailStatus
          sent_at: string | null
          resend_message_id: string | null
          notes: string | null
          scheduled_send_at: string | null
          processing_started_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          venue_id?: string | null
          deal_id?: string | null
          contact_id?: string | null
          email_type: string
          recipient_email: string
          subject: string
          status?: VenueEmailStatus
          sent_at?: string | null
          resend_message_id?: string | null
          notes?: string | null
          scheduled_send_at?: string | null
          processing_started_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          venue_id?: string | null
          deal_id?: string | null
          contact_id?: string | null
          email_type?: string
          recipient_email?: string
          subject?: string
          status?: VenueEmailStatus
          sent_at?: string | null
          resend_message_id?: string | null
          notes?: string | null
          scheduled_send_at?: string | null
          processing_started_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'venue_emails_venue_id_fkey'
            columns: ['venue_id']
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'venue_emails_deal_id_fkey'
            columns: ['deal_id']
            referencedRelation: 'deals'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'venue_emails_contact_id_fkey'
            columns: ['contact_id']
            referencedRelation: 'contacts'
            referencedColumns: ['id']
          },
        ]
      }
      email_capture_tokens: {
        Row: {
          id: string
          user_id: string
          token: string
          kind: string
          venue_id: string | null
          deal_id: string | null
          contact_id: string | null
          venue_emails_id: string | null
          expires_at: string
          consumed_at: string | null
          response: unknown | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token?: string
          kind: string
          venue_id?: string | null
          deal_id?: string | null
          contact_id?: string | null
          venue_emails_id?: string | null
          expires_at: string
          consumed_at?: string | null
          response?: unknown | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          kind?: string
          venue_id?: string | null
          deal_id?: string | null
          contact_id?: string | null
          venue_emails_id?: string | null
          expires_at?: string
          consumed_at?: string | null
          response?: unknown | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'email_capture_tokens_venue_id_fkey'
            columns: ['venue_id']
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'email_capture_tokens_deal_id_fkey'
            columns: ['deal_id']
            referencedRelation: 'deals'
            referencedColumns: ['id']
          },
        ]
      }
      metrics: {
        Row: {
          id: string
          user_id: string
          date: string
          category: MetricCategory
          title: string
          numeric_value: number | null
          description: string | null
          deal_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date?: string
          category: MetricCategory
          title: string
          numeric_value?: number | null
          description?: string | null
          deal_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          category?: MetricCategory
          title?: string
          numeric_value?: number | null
          description?: string | null
          deal_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'metrics_deal_id_fkey'
            columns: ['deal_id']
            referencedRelation: 'deals'
            referencedColumns: ['id']
          },
        ]
      }
      monthly_fees: {
        Row: {
          id: string
          user_id: string
          month: string
          amount: number
          paid: boolean
          paid_date: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          month: string
          amount?: number
          paid?: boolean
          paid_date?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          month?: string
          amount?: number
          paid?: boolean
          paid_date?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      monthly_fee_payments: {
        Row: {
          id: string
          fee_id: string
          user_id: string
          amount: number
          paid_date: string
          payment_method: PaymentMethod
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          fee_id: string
          user_id: string
          amount: number
          paid_date?: string
          payment_method?: PaymentMethod
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          fee_id?: string
          user_id?: string
          amount?: number
          paid_date?: string
          payment_method?: PaymentMethod
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'monthly_fee_payments_fee_id_fkey'
            columns: ['fee_id']
            referencedRelation: 'monthly_fees'
            referencedColumns: ['id']
          },
        ]
      }
      tasks: {
        Row: {
          id: string
          user_id: string
          title: string
          notes: string | null
          due_date: string | null
          completed: boolean
          completed_at: string | null
          priority: TaskPriority
          recurrence: TaskRecurrence
          venue_id: string | null
          deal_id: string | null
          cold_call_id: string | null
          lead_id: string | null
          lead_folder_id: string | null
          lead_send_all: boolean
          email_type: string | null
          generated_file_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          notes?: string | null
          due_date?: string | null
          completed?: boolean
          completed_at?: string | null
          priority?: TaskPriority
          recurrence?: TaskRecurrence
          venue_id?: string | null
          deal_id?: string | null
          cold_call_id?: string | null
          lead_id?: string | null
          lead_folder_id?: string | null
          lead_send_all?: boolean
          email_type?: string | null
          generated_file_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          notes?: string | null
          due_date?: string | null
          completed?: boolean
          completed_at?: string | null
          priority?: TaskPriority
          recurrence?: TaskRecurrence
          venue_id?: string | null
          deal_id?: string | null
          cold_call_id?: string | null
          lead_id?: string | null
          lead_folder_id?: string | null
          lead_send_all?: boolean
          email_type?: string | null
          generated_file_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_venue_id_fkey'
            columns: ['venue_id']
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_deal_id_fkey'
            columns: ['deal_id']
            referencedRelation: 'deals'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_generated_file_id_fkey'
            columns: ['generated_file_id']
            referencedRelation: 'generated_files'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_cold_call_id_fkey'
            columns: ['cold_call_id']
            referencedRelation: 'cold_calls'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_lead_fkey'
            columns: ['lead_id']
            referencedRelation: 'leads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_lead_folder_fkey'
            columns: ['lead_folder_id']
            referencedRelation: 'lead_folders'
            referencedColumns: ['id']
          },
        ]
      }
      google_calendar_connection: {
        Row: {
          user_id: string
          google_email: string | null
          source_calendar_id: string
          destination_calendar_id: string
          sync_past_days: number
          sync_future_days: number
          last_sync_at: string | null
          last_sync_summary: Record<string, unknown> | null
          last_deal_push_at: string | null
          last_deal_push_error: string | null
          connected_at: string | null
          updated_at: string
        }
        Insert: {
          user_id: string
          google_email?: string | null
          source_calendar_id?: string
          destination_calendar_id?: string
          sync_past_days?: number
          sync_future_days?: number
          last_sync_at?: string | null
          last_sync_summary?: Record<string, unknown> | null
          last_deal_push_at?: string | null
          last_deal_push_error?: string | null
          connected_at?: string | null
          updated_at?: string
        }
        Update: {
          user_id?: string
          google_email?: string | null
          source_calendar_id?: string
          destination_calendar_id?: string
          sync_past_days?: number
          sync_future_days?: number
          last_sync_at?: string | null
          last_sync_summary?: Record<string, unknown> | null
          last_deal_push_at?: string | null
          last_deal_push_error?: string | null
          connected_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      calendar_sync_event: {
        Row: {
          id: string
          user_id: string
          source_calendar_id: string
          source_event_id: string
          destination_calendar_id: string | null
          destination_event_id: string | null
          event_start_at: string | null
          event_end_at: string | null
          summary: string | null
          location: string | null
          description: string | null
          matched_venue_id: string | null
          follow_up_task_id: string | null
          display_status: string
          dedup_pair_deal_id: string | null
          dedup_rule: string | null
          dedup_score: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source_calendar_id: string
          source_event_id: string
          destination_calendar_id?: string | null
          destination_event_id?: string | null
          event_start_at?: string | null
          event_end_at?: string | null
          summary?: string | null
          location?: string | null
          description?: string | null
          matched_venue_id?: string | null
          follow_up_task_id?: string | null
          display_status?: string
          dedup_pair_deal_id?: string | null
          dedup_rule?: string | null
          dedup_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          source_calendar_id?: string
          source_event_id?: string
          destination_calendar_id?: string | null
          destination_event_id?: string | null
          event_start_at?: string | null
          event_end_at?: string | null
          summary?: string | null
          location?: string | null
          description?: string | null
          matched_venue_id?: string | null
          follow_up_task_id?: string | null
          display_status?: string
          dedup_pair_deal_id?: string | null
          dedup_rule?: string | null
          dedup_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'calendar_sync_event_matched_venue_id_fkey'
            columns: ['matched_venue_id']
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'calendar_sync_event_follow_up_task_id_fkey'
            columns: ['follow_up_task_id']
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'calendar_sync_event_dedup_pair_deal_id_fkey'
            columns: ['dedup_pair_deal_id']
            referencedRelation: 'deals'
            referencedColumns: ['id']
          },
        ]
      }
      task_templates: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          trigger_status: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          trigger_status?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          trigger_status?: string | null
          created_at?: string
        }
        Relationships: []
      }
      task_template_items: {
        Row: {
          id: string
          template_id: string
          title: string
          notes: string | null
          days_offset: number
          priority: TaskPriority
          recurrence: TaskRecurrence
          sort_order: number
          email_type: string | null
          generated_file_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          template_id: string
          title: string
          notes?: string | null
          days_offset?: number
          priority?: TaskPriority
          recurrence?: TaskRecurrence
          sort_order?: number
          email_type?: string | null
          generated_file_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          template_id?: string
          title?: string
          notes?: string | null
          days_offset?: number
          priority?: TaskPriority
          recurrence?: TaskRecurrence
          sort_order?: number
          email_type?: string | null
          generated_file_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'task_template_items_template_id_fkey'
            columns: ['template_id']
            referencedRelation: 'task_templates'
            referencedColumns: ['id']
          },
        ]
      }
      custom_email_templates: {
        Row: {
          id: string
          user_id: string
          audience: 'venue' | 'artist' | 'lead'
          name: string
          subject_template: string
          blocks: unknown
          attachment_generated_file_id: string | null
          /** Lead templates: optional folder the lead is moved to after a successful send. */
          move_to_folder_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          audience: 'venue' | 'artist' | 'lead'
          name: string
          subject_template?: string
          blocks?: unknown
          attachment_generated_file_id?: string | null
          move_to_folder_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          audience?: 'venue' | 'artist' | 'lead'
          name?: string
          subject_template?: string
          blocks?: unknown
          attachment_generated_file_id?: string | null
          move_to_folder_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'custom_email_templates_attachment_generated_file_id_fkey'
            columns: ['attachment_generated_file_id']
            referencedRelation: 'generated_files'
            referencedColumns: ['id']
          },
        ]
      }
      email_templates: {
        Row: {
          id: string
          user_id: string
          email_type: string
          custom_subject: string | null
          custom_intro: string | null
          layout: unknown | null
          layout_version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email_type: string
          custom_subject?: string | null
          custom_intro?: string | null
          layout?: unknown | null
          layout_version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email_type?: string
          custom_subject?: string | null
          custom_intro?: string | null
          layout?: unknown | null
          layout_version?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      performance_reports: {
        Row: {
          id: string
          user_id: string
          venue_id: string
          deal_id: string | null
          token: string
          token_used: boolean
          event_happened: string | null
          event_rating: number | null
          attendance: number | null
          artist_paid_status: string | null
          payment_amount: number | null
          fee_total: number | null
          amount_received: number | null
          payment_dispute_claimed_amount: number | null
          venue_interest: string | null
          relationship_quality: string | null
          notes: string | null
          media_links: string | null
          commission_flagged: boolean
          submitted: boolean
          submitted_at: string | null
          created_at: string
          chase_payment_followup: string | null
          payment_dispute: string | null
          production_issue_level: string | null
          production_friction_tags: string[]
          rebooking_timeline: string | null
          wants_booking_call: string | null
          wants_manager_venue_contact: string | null
          would_play_again: string | null
          cancellation_reason: string | null
          referral_lead: string | null
          promise_results: unknown | null
          night_mood: string | null
          rescheduled_to_date: string | null
          rebooking_specific_date: string | null
          cancellation_freeform: string | null
          creation_source: string | null
          submitted_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          venue_id: string
          deal_id?: string | null
          token?: string
          token_used?: boolean
          event_happened?: string | null
          event_rating?: number | null
          attendance?: number | null
          artist_paid_status?: string | null
          payment_amount?: number | null
          fee_total?: number | null
          amount_received?: number | null
          payment_dispute_claimed_amount?: number | null
          venue_interest?: string | null
          relationship_quality?: string | null
          notes?: string | null
          media_links?: string | null
          commission_flagged?: boolean
          submitted?: boolean
          submitted_at?: string | null
          created_at?: string
          chase_payment_followup?: string | null
          payment_dispute?: string | null
          production_issue_level?: string | null
          production_friction_tags?: string[]
          rebooking_timeline?: string | null
          wants_booking_call?: string | null
          wants_manager_venue_contact?: string | null
          would_play_again?: string | null
          cancellation_reason?: string | null
          referral_lead?: string | null
          promise_results?: unknown | null
          night_mood?: string | null
          rescheduled_to_date?: string | null
          rebooking_specific_date?: string | null
          cancellation_freeform?: string | null
          creation_source?: string | null
          submitted_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          venue_id?: string
          deal_id?: string | null
          token?: string
          token_used?: boolean
          event_happened?: string | null
          event_rating?: number | null
          attendance?: number | null
          artist_paid_status?: string | null
          payment_amount?: number | null
          fee_total?: number | null
          amount_received?: number | null
          payment_dispute_claimed_amount?: number | null
          venue_interest?: string | null
          relationship_quality?: string | null
          notes?: string | null
          media_links?: string | null
          commission_flagged?: boolean
          submitted?: boolean
          submitted_at?: string | null
          created_at?: string
          chase_payment_followup?: string | null
          payment_dispute?: string | null
          production_issue_level?: string | null
          production_friction_tags?: string[]
          rebooking_timeline?: string | null
          wants_booking_call?: string | null
          wants_manager_venue_contact?: string | null
          would_play_again?: string | null
          cancellation_reason?: string | null
          referral_lead?: string | null
          promise_results?: unknown | null
          night_mood?: string | null
          rescheduled_to_date?: string | null
          rebooking_specific_date?: string | null
          cancellation_freeform?: string | null
          creation_source?: string | null
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'performance_reports_venue_id_fkey'
            columns: ['venue_id']
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'performance_reports_deal_id_fkey'
            columns: ['deal_id']
            referencedRelation: 'deals'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      update_nav_badge_seen: {
        Args: { p_section: string }
        Returns: undefined
      }
      nav_calendar_badge_count: {
        Args: { p_since: string }
        Returns: number
      }
      ensure_deal_calendar_listing_stamp: {
        Args: { p_deal_id: string }
        Returns: undefined
      }
      ensure_calendar_listing_stamps_for_venue: {
        Args: { p_venue_id: string }
        Returns: undefined
      }
      partnership_roll_ensure_deadline: {
        Args: Record<PropertyKey, never>
        Returns: Record<string, unknown>
      }
      partnership_roll_confirm_list: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      partnership_roll_mark_document_downloaded: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      partnership_roll_clear_document_downloaded: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      partnership_roll_clear_list_confirmation: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      count_distinct_resend_sends: {
        Args: { p_start: string; p_end_exclusive: string }
        Returns: number
      }
    }
    Enums: {
      outreach_status: OutreachStatus
      venue_type: VenueType
      template_type: TemplateType
      commission_tier: CommissionTier
      metric_category: MetricCategory
      task_priority: TaskPriority
      task_recurrence: TaskRecurrence
      payment_method: PaymentMethod
    }
    CompositeTypes: Record<string, never>
  }
}
