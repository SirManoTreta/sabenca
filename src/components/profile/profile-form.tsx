"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { updateProfile } from "@/app/(community)/profile/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LabelSelector } from "./label-selector";
import { FieldError, FormFeedback } from "./form-feedback";
import type { SocialProfile } from "@/types/profile";

export function ProfileForm({
  profile,
}: {
  profile: Pick<SocialProfile, "username" | "bio" | "skills" | "interests">;
}) {
  const [state, action, pending] = useActionState(updateProfile, {});
  const [username, setUsername] = useState(profile.username ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  return (
    <form action={action} className="space-y-8">
      <fieldset disabled={pending} className="space-y-8 disabled:opacity-60">
        <div>
          <label
            htmlFor="username"
            className="mb-2 block text-sm font-semibold"
          >
            Username
          </label>
          <Input
            id="username"
            name="username"
            value={username}
            onChange={(event) => setUsername(event.target.value.toLowerCase())}
            minLength={3}
            maxLength={30}
            pattern="[a-z0-9_]{3,30}"
            required
            autoCapitalize="none"
            autoComplete="username"
            spellCheck={false}
            aria-invalid={!!state.fields?.username}
            aria-describedby="username-help username-error"
          />
          <p id="username-help" className="mt-2 text-xs text-muted-foreground">
            Seu endereço na comunidade. Use de 3 a 30 letras, números ou _.
          </p>
          <FieldError id="username-error" errors={state.fields?.username} />
        </div>
        <div>
          <label htmlFor="bio" className="mb-2 block text-sm font-semibold">
            Sobre mim
          </label>
          <textarea
            id="bio"
            name="bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            maxLength={500}
            rows={5}
            className="w-full rounded-xl border border-border p-4 text-sm leading-6 outline-primary"
            placeholder="O que você gosta de aprender, criar ou compartilhar?"
            aria-invalid={!!state.fields?.bio}
            aria-describedby="bio-help bio-error"
          />
          <p
            id="bio-help"
            className="mt-1 text-right text-xs text-muted-foreground"
          >
            {bio.length}/500 caracteres
          </p>
          <FieldError id="bio-error" errors={state.fields?.bio} />
        </div>
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[#063b73]">Habilidades</h2>
          <LabelSelector kind="skills" initial={profile.skills} />
          <FieldError id="skills-error" errors={state.fields?.skills} />
        </section>
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[#063b73]">Interesses</h2>
          <LabelSelector kind="interests" initial={profile.interests} />
          <FieldError id="interests-error" errors={state.fields?.interests} />
        </section>
      </fieldset>
      <FormFeedback state={state} />
      <div className="flex flex-wrap gap-3">
        <Button disabled={pending}>
          {pending ? "Salvando…" : "Salvar perfil"}
        </Button>
        <Button asChild variant="outline">
          <Link href="/profile">Voltar ao perfil</Link>
        </Button>
      </div>
    </form>
  );
}
