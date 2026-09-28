import "server-only";
import type { TransactionSql } from "postgres";
import { database } from "@/lib/institution/database";
import { requireUser } from "@/services/session";
import { idSchema } from "@/lib/validations/project";
import type {
  ConnectionDirection,
  ConnectionItem,
  ConnectionResult,
  ConnectionState,
} from "@/types/connections";

export const CONNECTION_SECTION_LIMIT = 50;
export class ConnectionError extends Error {}
const unavailable = "Esta solicitação não está mais disponível.";

// Identity only comes from requireUser. Every query runs with the caller's RLS.
async function withMember<T>(
  actor: string,
  task: (sql: TransactionSql, profileId: string) => Promise<T>,
): Promise<T> {
  idSchema.parse(actor);
  const result = await database().begin(async (sql) => {
    await sql`select set_config('request.jwt.claim.sub', ${actor}, true)`;
    await sql`set local role authenticated`;
    const [profile] =
      await sql`select id from public.profiles where user_id=(select auth.uid()) and institution_id='fatece'`;
    if (!profile)
      throw new ConnectionError(
        "Seu perfil não está disponível para conexões.",
      );
    return task(sql, profile.id as string);
  });
  return result as T;
}

// One query for the entire Networks page, in its existing RLS transaction.
export async function connectionStatesFor(
  sql: TransactionSql,
  targetIds: string[],
): Promise<Map<string, ConnectionState>> {
  targetIds.forEach((id) => idSchema.parse(id));
  if (!targetIds.length) return new Map();
  const rows = await sql<
    { id: string; target_id: string; kind: ConnectionDirection }[]
  >`
    select c.id, case when c.requester_id=p.id then c.receiver_id else c.requester_id end as target_id,
      case when c.status='accepted' then 'accepted' when c.requester_id=p.id then 'outgoing' else 'incoming' end as kind
    from public.connections c join public.profiles p on p.user_id=(select auth.uid())
    where (c.requester_id=p.id and c.receiver_id in ${sql(targetIds)})
       or (c.receiver_id=p.id and c.requester_id in ${sql(targetIds)})`;
  return new Map(
    rows.map((row) => [row.target_id, { kind: row.kind, id: row.id }]),
  );
}

export async function getConnectionState(
  targetProfileId: string,
): Promise<ConnectionState> {
  const { user } = await requireUser();
  idSchema.parse(targetProfileId);
  return withMember(user.id, async (sql, profileId) => {
    if (profileId === targetProfileId) return { kind: "self" };
    const [target] =
      await sql`select id from public.profiles where id=${targetProfileId} and institution_id='fatece'`;
    if (!target) return { kind: "unavailable" };
    return (
      (await connectionStatesFor(sql, [targetProfileId])).get(
        targetProfileId,
      ) ?? { kind: "none" }
    );
  });
}

export async function getConnections(): Promise<ConnectionResult> {
  const { client, user } = await requireUser();
  const rows = await withMember(
    user.id,
    async (sql, profileId) => sql<(ConnectionItem & { total: number })[]>`
    with relations as (
      select c.id,c.created_at,
        case when c.status='accepted' then 'accepted' when c.receiver_id=${profileId} then 'incoming' else 'outgoing' end as direction,
        p.id as profile_id,p.username,p.name,course.name as course,p.semester,p.institution,p.avatar_url
      from public.connections c
      join public.profiles p on p.id=case when c.requester_id=${profileId} then c.receiver_id else c.requester_id end
      left join public.courses course on course.id=p.course_id
      where c.requester_id=${profileId} or c.receiver_id=${profileId}
    ), ranked as (
      select *, count(*) over(partition by direction)::integer as total,
        row_number() over(partition by direction order by
          case when direction='accepted' then name end asc,
          case when direction<>'accepted' then created_at end desc, id) as position
      from relations
    )
    select id,direction,created_at,total,
      jsonb_build_object('profile_id',profile_id,'username',username,'name',name,'course',course,
        'semester',semester,'institution',institution,'avatar_url',avatar_url) as person
    from ranked where position<=${CONNECTION_SECTION_LIMIT} order by direction,position`,
  );
  const paths = [
    ...new Set(
      rows.flatMap((row) =>
        row.person.avatar_url ? [row.person.avatar_url] : [],
      ),
    ),
  ];
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data, error } = await client.storage
      .from("avatars")
      .createSignedUrls(paths, 300);
    if (!error)
      for (const item of data ?? []) {
        if (item.path && item.signedUrl && !item.error)
          urls.set(item.path, item.signedUrl);
      }
  }
  const result: ConnectionResult = {
    incoming: { items: [], total: 0 },
    outgoing: { items: [], total: 0 },
    accepted: { items: [], total: 0 },
  };
  for (const row of rows) {
    result[row.direction].total = row.total;
    result[row.direction].items.push({
      id: row.id,
      direction: row.direction,
      created_at: new Date(row.created_at).toISOString(),
      person: {
        ...row.person,
        avatar_url: urls.get(row.person.avatar_url ?? "") ?? null,
      },
    });
  }
  return result;
}

export async function sendConnectionRequest(targetProfileId: string) {
  const { user } = await requireUser();
  idSchema.parse(targetProfileId);
  try {
    return await withMember(user.id, async (sql, profileId) => {
      if (profileId === targetProfileId)
        throw new ConnectionError("Você não pode se conectar consigo mesmo.");
      const [target] =
        await sql`select id from public.profiles where id=${targetProfileId} and institution_id='fatece'`;
      if (!target)
        throw new ConnectionError(
          "Este estudante não está disponível para novas conexões.",
        );
      const [created] =
        await sql`insert into public.connections(requester_id,receiver_id) values (${profileId},${targetProfileId}) returning id`;
      return created.id as string;
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "23505"
    )
      throw new ConnectionError(
        "Já existe uma solicitação ou conexão com este estudante.",
      );
    throw error;
  }
}

async function changeConnection(
  id: string,
  operation: "accept" | "reject" | "cancel" | "remove",
) {
  const { user } = await requireUser();
  idSchema.parse(id);
  return withMember(user.id, async (sql, profileId) => {
    const rows =
      operation === "accept"
        ? await sql`update public.connections set status='accepted' where id=${id} and status='pending' and receiver_id=${profileId} returning id`
        : await sql`delete from public.connections where id=${id}
          and status=${operation === "remove" ? "accepted" : "pending"}
          and ${operation === "reject" ? sql`receiver_id=${profileId}` : operation === "cancel" ? sql`requester_id=${profileId}` : sql`(requester_id=${profileId} or receiver_id=${profileId})`} returning id`;
    if (!rows.length) throw new ConnectionError(unavailable);
  });
}
export async function acceptConnectionRequest(id: string) {
  return changeConnection(id, "accept");
}
export async function rejectConnectionRequest(id: string) {
  return changeConnection(id, "reject");
}
export async function cancelConnectionRequest(id: string) {
  return changeConnection(id, "cancel");
}
export async function removeConnection(id: string) {
  return changeConnection(id, "remove");
}
