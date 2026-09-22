"use client";
import { useActionState } from "react";
import { uploadAvatar } from "@/app/(community)/profile/actions";
import { IMAGE_ACCEPT } from "@/lib/validations/image";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "./form-feedback";
import { ProfileImage } from "./profile-image";

export function AvatarUpload({
  src,
  name,
}: {
  src: string | null;
  name: string;
}) {
  const [state, action, pending] = useActionState(uploadAvatar, {});
  return (
    <section className="space-y-5 rounded-2xl border border-border p-6">
      <h2 className="text-xl font-bold text-[#063b73]">Sua foto</h2>
      <ProfileImage src={src} name={name} />
      <form action={action} className="space-y-4">
        <label htmlFor="avatar" className="block text-sm font-medium">
          Escolher foto de perfil
        </label>
        <input
          id="avatar"
          name="avatar"
          type="file"
          accept={IMAGE_ACCEPT}
          required
          disabled={pending}
          className="block w-full min-w-0 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-primary"
          aria-describedby="avatar-help"
        />
        <p id="avatar-help" className="text-xs text-muted-foreground">
          JPEG, PNG ou WEBP. Até 5 MiB.
        </p>
        <FormFeedback state={state} />
        <Button disabled={pending} variant="outline" size="sm">
          {pending ? "Enviando…" : "Salvar foto"}
        </Button>
      </form>
    </section>
  );
}
