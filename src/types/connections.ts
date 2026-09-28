export type ConnectionState =
  | { kind: "none" | "self" | "unavailable" }
  | { kind: "incoming" | "outgoing" | "accepted"; id: string };

export type ConnectionPerson = {
  profile_id: string;
  username: string | null;
  name: string;
  course: string | null;
  semester: number | null;
  institution: string | null;
  avatar_url: string | null;
};
export type ConnectionDirection = "incoming" | "outgoing" | "accepted";
export type ConnectionItem = {
  id: string;
  direction: ConnectionDirection;
  person: ConnectionPerson;
  created_at: string;
};
export type ConnectionSection = { items: ConnectionItem[]; total: number };
export type ConnectionResult = Record<ConnectionDirection, ConnectionSection>;
export type ConnectionActionState = { error?: string; success?: string };
