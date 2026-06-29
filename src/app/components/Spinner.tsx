export default function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <div className="spinner h-10 w-10 rounded-full border-[3px] border-zinc-700 border-t-orange-500" />
      <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
        Building execution plan…
      </p>
    </div>
  );
}
