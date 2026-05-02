import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  highlight?: string;
  description: string;
  actions?: ReactNode;
  aside?: ReactNode;
  alertBanner?: ReactNode;
}

export default function PageHeader({
  eyebrow,
  title,
  highlight,
  description,
  actions,
  aside,
  alertBanner,
}: PageHeaderProps) {
  return (
    <section className="hero-panel mb-8 px-6 py-6 lg:px-8 lg:py-7">
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="panel-kicker">{eyebrow}</p>
          <h1 className="mt-3 font-outfit text-3xl font-bold tracking-tight text-[#f4f7ff] sm:text-4xl">
            {title}
            {highlight ? <> <span className="text-gradient">{highlight}</span></> : null}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#9db0d6] sm:text-[15px]">
            {description}
          </p>
          {alertBanner && (
            <div className="mt-5 max-w-2xl">
              {alertBanner}
            </div>
          )}
        </div>

        {actions || aside ? (
          <div className="relative z-10 flex flex-col gap-3 lg:items-end">
            {aside}
            {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
