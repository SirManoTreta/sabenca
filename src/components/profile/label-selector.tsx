"use client";
import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchProfileLabels } from "@/app/(community)/profile/actions";
import { labelKey, normalizeLabel } from "@/lib/validations/profile";
import type { LabelKind, ProfileLabel } from "@/types/profile";

export function LabelSelector({
  kind,
  initial,
}: {
  kind: LabelKind;
  initial: ProfileLabel[];
}) {
  const [selected, setSelected] = useState(initial.map((item) => item.name));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileLabel[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const title = kind === "skills" ? "habilidades" : "interesses";
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await searchProfileLabels(kind, query);
        if (active) {
          setResults(result.labels);
          setError(result.error ?? "");
        }
      } catch {
        if (active) setError("Não foi possível pesquisar. Tente novamente.");
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [kind, query]);
  const add = (value: string) => {
    const name = normalizeLabel(value);
    if (
      !name ||
      selected.length >= 20 ||
      selected.some((item) => labelKey(item) === labelKey(name))
    )
      return;
    setSelected([...selected, name]);
    setQuery("");
  };
  const matching = results.filter(
    (item) => !selected.some((name) => labelKey(name) === labelKey(item.name)),
  );
  const canCreate =
    query.trim() &&
    ![...selected, ...results.map((item) => item.name)].some(
      (name) => labelKey(name) === labelKey(query),
    );
  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-2" aria-label={`${title} selecionados`}>
        {selected.map((name) => (
          <li
            key={labelKey(name)}
            className="flex max-w-full items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm text-primary"
          >
            <input type="hidden" name={kind} value={name} />
            <span className="min-w-0 break-words">{name}</span>
            <button
              type="button"
              onClick={() =>
                setSelected(selected.filter((item) => item !== name))
              }
              aria-label={`Remover ${name}`}
              className="shrink-0 rounded p-1 hover:bg-white"
            >
              <X size={15} />
            </button>
          </li>
        ))}
      </ul>
      <label htmlFor={`${kind}-search`} className="block text-sm font-medium">
        Pesquisar {title}
      </label>
      <Input
        id={`${kind}-search`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        maxLength={kind === "skills" ? 60 : 80}
        placeholder={
          kind === "skills"
            ? "Ex.: React, Docker, fotografia"
            : "Ex.: jogos, design, tecnologia"
        }
        autoComplete="off"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (query.trim())
              add(
                results.find((item) => labelKey(item.name) === labelKey(query))
                  ?.name ?? query,
              );
          }
        }}
      />
      <p className="text-xs text-muted-foreground">
        {selected.length}/20 selecionados. As alterações serão aplicadas ao
        salvar o perfil.
      </p>
      <div aria-live="polite" className="text-sm text-muted-foreground">
        {loading ? "Pesquisando…" : error}
      </div>
      <div className="flex flex-wrap gap-2">
        {matching.slice(0, 8).map((item) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            key={item.id}
            disabled={selected.length >= 20}
            className="h-auto max-w-full py-2 whitespace-normal text-left"
            onClick={() => add(item.name)}
          >
            <Plus className="shrink-0" />
            {item.name}
          </Button>
        ))}
        {canCreate && (
          <Button
            type="button"
            size="sm"
            disabled={selected.length >= 20 || loading || !!error}
            className="h-auto max-w-full break-all py-2 whitespace-normal"
            onClick={() => add(query)}
          >
            <Plus className="shrink-0" />
            Criar “{normalizeLabel(query)}”
          </Button>
        )}
      </div>
    </div>
  );
}
