import "server-only";
import { database } from "@/lib/institution/database";
import {
  labelKey,
  profileSchema,
  type ProfileInput,
} from "@/lib/validations/profile";
import { idSchema } from "@/lib/validations/project";

// The caller supplies only the identity returned by requireUser(), never a form ID.
// Catalog creation needs server privileges. Everything is one transaction so a
// username conflict cannot leave half-saved associations or unused catalog rows.
export async function saveProfile(userId: string, input: ProfileInput) {
  idSchema.parse(userId);
  const values = profileSchema.parse(input);
  return database().begin(async (sql) => {
    await sql`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    const [access] = await sql`select private.is_member() as allowed`;
    if (!access?.allowed) throw new Error("Profile access denied");
    const [profile] =
      await sql`select id, username from public.profiles where user_id = ${userId} for update`;
    if (!profile) throw new Error("Profile unavailable");

    const selected: { skills: string[]; interests: string[] } = {
      skills: [],
      interests: [],
    };
    // Fixed table identifiers, validated names and a maximum of 20 per catalog.
    for (const kind of ["skills", "interests"] as const) {
      const names = [...values[kind]].sort((a, b) =>
        labelKey(a).localeCompare(labelKey(b)),
      );
      if (!names.length) continue;
      const labels = await sql`
        insert into ${sql("public." + kind)} ${sql(
          names.map((name) => ({ name })),
          "name",
        )}
        on conflict (normalized_name) do update set name = ${sql("public." + kind)}.name
        returning id`;
      selected[kind] = labels.map((label) => label.id as string);
    }

    // Reapply the user's RLS for writes and recheck active membership in policies.
    await sql`set local role authenticated`;
    const updated =
      await sql`update public.profiles set username = ${values.username}, bio = ${values.bio || null}
      where id = ${profile.id} and user_id = ${userId} returning id`;
    if (!updated.length) throw new Error("Profile access denied");
    await sql`delete from public.profile_skills where profile_id = ${profile.id}`;
    await sql`delete from public.profile_interests where profile_id = ${profile.id}`;
    if (selected.skills.length)
      await sql`insert into public.profile_skills ${sql(
        selected.skills.map((skill_id) => ({
          profile_id: profile.id,
          skill_id,
        })),
        "profile_id",
        "skill_id",
      )}`;
    if (selected.interests.length)
      await sql`insert into public.profile_interests ${sql(
        selected.interests.map((interest_id) => ({
          profile_id: profile.id,
          interest_id,
        })),
        "profile_id",
        "interest_id",
      )}`;
    return { previousUsername: profile.username as string | null };
  });
}
