import type {
  OutreachStatus,
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
          venue_type: VenueType
          priority: number
          status: OutreachStatus
          follow_up_date: string | null
          deal_terms: DealTerms | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          location?: string | null
          city?: string | null
          venue_type?: VenueType
          priority?: number
          status?: OutreachStatus
          follow_up_date?: string | null
          deal_terms?: DealTerms | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          location?: string | null
          city?: string | null
          venue_type?: VenueType
          priority?: number
          status?: OutreachStatus
          follow_up_date?: string | null
          deal_terms?: DealTerms | null
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
          content: string
          output_format: 'text' | 'pdf'
          pdf_storage_path: string | null
          pdf_public_url: string | null
          pdf_share_slug: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          template_id?: string | null
          venue_id?: string | null
          deal_id?: string | null
          content: string
          output_format?: 'text' | 'pdf'
          pdf_storage_path?: string | null
          pdf_public_url?: string | null
          pdf_share_slug?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          template_id?: string | null
          venue_id?: string | null
          deal_id?: string | null
          content?: string
          output_format?: 'text' | 'pdf'
          pdf_storage_path?: string | null
          pdf_public_url?: string | null
          pdf_share_slug?: string | null
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
        ]
      }
      deals: {
        Row: {
          id: string
          user_id: string
          description: string
          venue_id: string | null
          event_date: string | null
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
        ]
      }
      artist_profile: {
        Row: {
          user_id: string
          artist_name: string
          artist_email: string
          manager_name: string | null
          manager_email: string | null
          from_email: string
          company_name: string | null
          website: string | null
          phone: string | null
          social_handle: string | null
          tagline: string | null
          reply_to_email: string | null
          email_queue_buffer_minutes?: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          artist_name?: string
          artist_email?: string
          manager_name?: string | null
          manager_email?: string | null
          from_email?: string
          company_name?: string | null
          website?: string | null
          phone?: string | null
          social_handle?: string | null
          tagline?: string | null
          reply_to_email?: string | null
          email_queue_buffer_minutes?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          artist_name?: string
          artist_email?: string
          manager_name?: string | null
          manager_email?: string | null
          from_email?: string
          company_name?: string | null
          website?: string | null
          phone?: string | null
          social_handle?: string | null
          tagline?: string | null
          reply_to_email?: string | null
          email_queue_buffer_minutes?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
          notes: string | null
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
          notes?: string | null
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
          notes?: string | null
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
          audience: 'venue' | 'artist'
          name: string
          subject_template: string
          blocks: unknown
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          audience: 'venue' | 'artist'
          name: string
          subject_template?: string
          blocks?: unknown
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          audience?: 'venue' | 'artist'
          name?: string
          subject_template?: string
          blocks?: unknown
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
          venue_interest: string | null
          relationship_quality: string | null
          notes: string | null
          media_links: string | null
          commission_flagged: boolean
          submitted: boolean
          submitted_at: string | null
          created_at: string
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
          venue_interest?: string | null
          relationship_quality?: string | null
          notes?: string | null
          media_links?: string | null
          commission_flagged?: boolean
          submitted?: boolean
          submitted_at?: string | null
          created_at?: string
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
          venue_interest?: string | null
          relationship_quality?: string | null
          notes?: string | null
          media_links?: string | null
          commission_flagged?: boolean
          submitted?: boolean
          submitted_at?: string | null
          created_at?: string
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
    Functions: Record<string, never>
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
