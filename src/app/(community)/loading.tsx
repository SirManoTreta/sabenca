export default function Loading() {
  return (
    <div role="status" className="animate-pulse py-10">
      <span className="sr-only">Carregando sua comunidade...</span>
      <div className="h-10 w-64 rounded bg-secondary" />
      <div className="mt-6 h-5 w-80 max-w-full rounded bg-secondary" />
      <div className="mt-12 h-72 rounded-2xl bg-secondary/50" />
    </div>
  );
}
