// Shapes of the Go API's JSON. Field names follow the server exactly.

export interface Row {
  MID: string; Folder: string; From: string; To: string; Cc: string; Subject: string; Date: string;
  Size: number; Attachments: number; Unread: boolean; P2POnly: boolean; Starred: boolean; Labels: string[];
}
export interface Folder { name: string; system: boolean; count: number; unread: number }
export interface Label { name: string; color: string; count: number }
export interface Message extends Omit<Row, 'From' | 'To' | 'Cc' | 'Attachments'> {
  From: { Addr: string };
  To: { Addr: string }[];
  Cc: { Addr: string }[] | null;
  Body: string;
  BodyHTML: string;
  Files: { Name: string; Size: number }[] | null;
}
export interface Status {
  active_listeners: string[]; connected: boolean; dialing: boolean; remote_addr: string; http_clients: string[]; config_hash: string;
}
export interface Progress {
  bytes_transferred: number; bytes_total: number; mid: string; subject: string; receiving: boolean; sending: boolean; done: boolean;
}
export interface Prompt {
  id: string;
  kind: 'password' | 'multi-select' | 'busy-channel' | 'pre-account-activation' | 'account-activation';
  message: string;
  options?: { value: string; desc?: string; checked: boolean }[];
}
export interface Notification { title: string; body: string }
export interface BulkResult { ok: string[]; failed: Record<string, string> }
export type View =
  | { kind: 'folder'; name: string }
  | { kind: 'label'; name: string }
  | { kind: 'starred' }
  | { kind: 'search'; q: string };

// Config is the server's config.json; pages read the fields they need.
export type Config = Record<string, unknown>;
