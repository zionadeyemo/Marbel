export default function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-24">
      <div className="spinner h-9 w-9 rounded-full border-2 border-beige border-t-charcoal" />
      <p className="text-xs font-semibold uppercase tracking-widest text-taupe">
        Building execution plan…
      </p>
    </div>
  );
}
