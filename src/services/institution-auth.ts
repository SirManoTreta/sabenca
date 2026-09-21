import "server-only";
import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { database } from "@/lib/institution/database";
import {
  ACTIVATION_COOKIE,
  INSTITUTION_ID,
  appOrigin,
} from "@/lib/institution/config";
import { authFingerprint } from "@/lib/institution/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
type AccessStudent = {
  id: string;
  auth_user_id: string | null;
  email: string;
  status: string;
  birth_date: string;
  name: string;
  course: string | null;
  semester: number | null;
};
export async function studentByRa(ra: string) {
  const sql = database();
  const [student] = await sql<
    AccessStudent[]
  >`select id,auth_user_id,email,status,birth_date::text,name,course,semester from private.institution_students where institution_id=${INSTITUTION_ID} and ra=${ra}`;
  return student;
}
export async function permitAttempt(scope: string, subject: string) {
  const sql = database();
  const requestHeaders = await headers();
  // Trust only the hosting provider's sanitized client address.
  const ip = process.env.VERCEL
    ? requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown"
    : "local";
  const keys = [
    { key: authFingerprint(`${scope}:subject:${subject}`), max: 5 },
    { key: authFingerprint(`${scope}:ip:${ip}`), max: 100 },
  ];
  let allowed = true;
  for (const { key, max } of keys) {
    const [row] =
      await sql`insert into private.auth_attempts (key,attempts,expires_at) values (${key},1,now()+interval '15 minutes') on conflict (key) do update set attempts=case when auth_attempts.expires_at<now() then 1 else auth_attempts.attempts+1 end, expires_at=case when auth_attempts.expires_at<now() then now()+interval '15 minutes' else auth_attempts.expires_at end returning attempts`;
    allowed = allowed && Number(row.attempts) <= max;
  }
  await sql`delete from private.auth_attempts where expires_at < now()-interval '1 day'`;
  return allowed;
}
export async function beginActivation(ra: string, birthDate: string) {
  const token = randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(ACTIVATION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 20 * 60,
  });
  const student = await studentByRa(ra);
  if (
    !student ||
    student.status !== "pending" ||
    student.birth_date !== birthDate
  )
    return;
  const sql = database();
  let userId = student.auth_user_id;
  if (!userId) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: student.email,
      email_confirm: false,
    });
    if (data.user) userId = data.user.id;
    else if (error) {
      const [existing] =
        await sql`select id from auth.users where lower(email)=${student.email} and coalesce(is_anonymous,false)=false`;
      if (!existing) throw new Error("Could not prepare activation");
      userId = String(existing.id);
    }
    if (!userId) throw new Error("Could not prepare activation");
    const linked =
      await sql`update private.institution_students set auth_user_id=${userId} where id=${student.id} and status='pending' and (auth_user_id is null or auth_user_id=${userId}) returning id`;
    if (!linked.length) return;
  }
  await sql`delete from private.activation_challenges where expires_at < now()`;
  await sql`insert into private.activation_challenges (token_hash,student_id,auth_user_id,expires_at) values (${authFingerprint(token)},${student.id},${userId},now()+interval '20 minutes')`;
  const client = await createClient();
  const [account] =
    await sql`select email_confirmed_at from auth.users where id=${userId} and lower(email)=${student.email} and coalesce(is_anonymous,false)=false`;
  if (!account) throw new Error("Could not prepare activation");
  const emailRedirectTo = `${appOrigin()}/auth/callback?next=/auth/definir-senha`;
  // OTP attempts signup for unconfirmed accounts, which closed registration rejects.
  // Resend confirms an already provisioned account and preserves the PKCE flow.
  const { error } = account.email_confirmed_at
    ? await client.auth.signInWithOtp({
        email: student.email,
        options: { shouldCreateUser: false, emailRedirectTo },
      })
    : await client.auth.resend({
        type: "signup",
        email: student.email,
        options: { emailRedirectTo },
      });
  if (error) {
    console.warn("SABENCA_ACTIVATION_EMAIL_REJECTED", {
      code: error.code,
      status: error.status,
    });
    throw new Error("Could not deliver activation email");
  }
}
export async function activationFor(user: User) {
  const token = (await cookies()).get(ACTIVATION_COOKIE)?.value;
  if (
    !token ||
    !/^[a-f0-9]{64}$/.test(token) ||
    !user.email_confirmed_at ||
    user.is_anonymous
  )
    return null;
  const sql = database();
  const [student] = await sql<
    AccessStudent[]
  >`select s.id,s.auth_user_id,s.email,s.status,s.birth_date::text,s.name,s.course,s.semester from private.institution_students s join private.activation_challenges c on c.student_id=s.id where s.institution_id=${INSTITUTION_ID} and s.status='pending' and s.auth_user_id=${user.id} and s.email=${user.email?.toLowerCase() || ""} and c.auth_user_id=${user.id} and c.token_hash=${authFingerprint(token)} and c.expires_at>now()`;
  return student ?? null;
}
export async function activateStudent(user: User) {
  const token = (await cookies()).get(ACTIVATION_COOKIE)?.value;
  if (!token || !user.email_confirmed_at || user.is_anonymous)
    throw new Error("Activation expired");
  const sql = database();
  await sql.begin(async (tx) => {
    const [student] = await tx<
      AccessStudent[]
    >`select s.id,s.auth_user_id,s.email,s.status,s.birth_date::text,s.name,s.course,s.semester from private.institution_students s join private.activation_challenges c on c.student_id=s.id join auth.users u on u.id=s.auth_user_id where s.institution_id=${INSTITUTION_ID} and s.status='pending' and s.auth_user_id=${user.id} and s.email=${user.email?.toLowerCase() || ""} and c.token_hash=${authFingerprint(token)} and c.auth_user_id=${user.id} and c.expires_at>now() and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<now()) for update of s,c`;
    if (!student) throw new Error("Activation expired or blocked");
    await tx`update private.institution_students set status='active',activated_at=now() where id=${student.id}`;
    await tx`insert into public.profiles (user_id,name,course,semester,institution) values (${user.id},${student.name},${student.course},${student.semester},'FATECE') on conflict (user_id) do nothing`;
    await tx`delete from private.activation_challenges where student_id=${student.id}`;
  });
  (await cookies()).delete(ACTIVATION_COOKIE);
}
