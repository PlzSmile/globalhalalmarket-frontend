/** Phase 6b: in-app notifications (GET /api/v1/notifications). */
export type NotificationKind = 'expiry_digest' | 'recognition_lost';

export interface ReminderItem {
  readonly kind: 'certificate' | 'recognition';
  readonly id: number;
  readonly days: number;
  readonly stage?: number;
  readonly date: string;
  readonly title: string;
  readonly url: string;
  readonly note?: string;
}

export interface AffectedProduct { readonly name: string; readonly market: string; }

export interface AppNotification {
  readonly id: string;
  readonly kind: NotificationKind | null;
  readonly title: string;
  readonly items: readonly ReminderItem[];
  readonly products: readonly AffectedProduct[];
  readonly read: boolean;
  readonly created_at: string | null;
}

export interface NotificationPage {
  readonly data: readonly AppNotification[];
  readonly meta: { readonly current_page: number; readonly last_page: number; readonly total: number; readonly unread: number };
}
