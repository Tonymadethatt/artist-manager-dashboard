import type {
  OutreachStatus,
  VenueType,
  TemplateType,
  CommissionTier,
  MetricCategory,
  TaskPriority,
  TaskRecurrence,
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
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          venue_id: string
          note: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          venue_id?: string
          note?: string
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
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          template_id?: string | null
          venue_id?: string | null
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          template_id?: string | null
          venue_id?: string | null
          content?: string
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
          from_email: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          artist_name?: string
          artist_email?: string
          manager_name?: string | null
          from_email?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          artist_name?: string
          artist_email?: string
          manager_name?: string | null
          from_email?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
    }
    CompositeTypes: Record<string, never>
  }
}
