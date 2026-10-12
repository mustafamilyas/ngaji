import type { LandingContent } from "./content";

export function HowItWorks({ steps }: { steps: LandingContent["steps"] }) {
  return (
    <section aria-labelledby="cara-kerja" className="border-t border-(--l-ink)/10 px-4 py-14 sm:px-8 lg:py-20">
      <h2 id="cara-kerja" className="font-(family-name:--font-landing) text-3xl font-bold tracking-tight">
        Cara kerjanya
      </h2>
      <ol className="mt-10 flex max-w-2xl flex-col">
        {steps.map((step, index) => (
          <li key={step.title} className="relative flex gap-5 pb-10 last:pb-0">
            {index < steps.length - 1 && (
              <span aria-hidden="true" className="absolute top-10 bottom-0 left-[1.1rem] w-0.5 bg-(--l-leaf)/35" />
            )}
            <span
              aria-hidden="true"
              className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-(--l-ink) text-sm font-semibold text-(--l-paper)"
            >
              {index + 1}
            </span>
            <div className="pt-1">
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="mt-1 leading-relaxed text-(--l-muted)">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
