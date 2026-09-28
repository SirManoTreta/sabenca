import "server-only";
import { database } from "@/lib/institution/database";
import { INSTITUTION_ID } from "@/lib/institution/config";
import { requireUser } from "@/services/session";
import { connectionStatesFor } from "@/services/connections";
import {
  networkFiltersSchema,
  NETWORK_PAGE_SIZE,
} from "@/lib/validations/networks";
import { idSchema } from "@/lib/validations/project";
import type {
  NetworkResult,
  NetworkSearchParams,
  NetworkStudent,
} from "@/types/networks";
import type { ProfileLabel } from "@/types/profile";

// RLS and identity are transaction-local; the connection pool keeps no user state.
export async function searchNetworks(
  actor: string,
  params: NetworkSearchParams,
): Promise<NetworkResult> {
  idSchema.parse(actor);
  const parsed = networkFiltersSchema.safeParse(params);
  const filters = parsed.success ? parsed.data : { q: "", page: 1 };
  return database().begin(async (sql) => {
    await sql`select set_config('request.jwt.claim.sub', ${actor}, true)`;
    await sql`set local role authenticated`;
    const [access] = await sql`select private.is_member() as allowed`;
    if (!access?.allowed) throw new Error("Networks access denied");
    const courses = await sql<
      ProfileLabel[]
    >`select id,name from public.courses where institution_id=${INSTITUTION_ID} and status='active' order by name,id`;
    const skills = await sql<
      ProfileLabel[]
    >`select id,name from public.skills order by name,id`;
    const interests = await sql<
      ProfileLabel[]
    >`select id,name from public.interests order by name,id`;
    const base = {
      courses: [...courses],
      skills: [...skills],
      interests: [...interests],
      filters,
    };
    if (!parsed.success)
      return {
        ...base,
        total: 0,
        students: [],
        error: "Filtros inválidos. Revise a busca, os filtros e a página.",
      };
    const { q, course, semester, skill, interest, page } = parsed.data;
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const [result] = await sql<
      {
        total: number;
        students: Omit<NetworkStudent, "skills" | "interests" | "connection">[];
      }[]
    >`
      with matches as materialized (
        select p.id,p.username,p.name,c.name as course,p.semester,p.institution,p.avatar_url
        from public.profiles p left join public.courses c on c.id=p.course_id
        where p.institution_id=${INSTITUTION_ID} and p.username is not null and p.user_id <> (select auth.uid())
          ${course ? sql`and p.course_id=${course}` : sql``}
          ${semester ? sql`and p.semester=${semester}` : sql``}
          ${skill ? sql`and exists(select 1 from public.profile_skills ps where ps.profile_id=p.id and ps.skill_id=${skill})` : sql``}
          ${interest ? sql`and exists(select 1 from public.profile_interests pi where pi.profile_id=p.id and pi.interest_id=${interest})` : sql``}
          ${
            q
              ? sql`and (p.name ilike ${pattern} or p.username ilike ${pattern} or exists (
            select 1 from public.profile_skills ps join public.skills s on s.id=ps.skill_id
            where ps.profile_id=p.id and s.name ilike ${pattern}))`
              : sql``
          }
      ), paged as (
        select id,username,name,course,semester,institution,avatar_url from matches
        order by name,id limit ${NETWORK_PAGE_SIZE} offset ${(page - 1) * NETWORK_PAGE_SIZE}
      )
      select (select count(*)::integer from matches) as total,
        coalesce((select jsonb_agg(to_jsonb(paged) order by name,id) from paged), '[]'::jsonb) as students`;
    const ids = result.students.map((student) => student.id);
    const connectionStates = await connectionStatesFor(sql, ids);
    type Relation = ProfileLabel & { profile_id: string };
    const skillRows = ids.length
      ? await sql<
          Relation[]
        >`select ps.profile_id,s.id,s.name from public.profile_skills ps
      join public.skills s on s.id=ps.skill_id where ps.profile_id in ${sql(ids)} order by s.name,s.id`
      : [];
    const interestRows = ids.length
      ? await sql<
          Relation[]
        >`select pi.profile_id,i.id,i.name from public.profile_interests pi
      join public.interests i on i.id=pi.interest_id where pi.profile_id in ${sql(ids)} order by i.name,i.id`
      : [];
    const labelsFor = (rows: Relation[], id: string) =>
      rows
        .filter((row) => row.profile_id === id)
        .map(({ id, name }) => ({ id, name }));
    return {
      ...base,
      total: result.total,
      students: result.students.map((student) => ({
        id: student.id,
        username: student.username,
        name: student.name,
        course: student.course,
        semester: student.semester,
        institution: student.institution,
        avatar_url: student.avatar_url,
        skills: labelsFor(skillRows, student.id),
        interests: labelsFor(interestRows, student.id),
        connection: connectionStates.get(student.id) ?? { kind: "none" },
      })),
    };
  });
}

export async function getNetworks(
  params: NetworkSearchParams,
): Promise<NetworkResult> {
  const { client, user } = await requireUser();
  const result = await searchNetworks(user.id, params);
  const paths = [
    ...new Set(
      result.students.flatMap((student) =>
        student.avatar_url ? [student.avatar_url] : [],
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
  return {
    ...result,
    students: result.students.map((student) => ({
      ...student,
      avatar_url: urls.get(student.avatar_url ?? "") ?? null,
    })),
  };
}
