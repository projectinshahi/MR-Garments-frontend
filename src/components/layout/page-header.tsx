import Link from "next/link";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  /** The page's only h1. With `parent`, renders as the breadcrumb's current item ("Orders / PO-2028"). */
  title: string;
  /** Breadcrumb parent shown before the title in muted text. */
  parent?: { label: string; href: string };
  /** Inline content right after the title, such as a "Management only" pill. */
  titleAddon?: React.ReactNode;
  /** Right-aligned controls: search, filter selects, TodayPill, buttons. */
  actions?: React.ReactNode;
};

/** The 68 px white header bar at the top of every app page (references 4–53). */
export function PageHeader({ title, parent, titleAddon, actions }: PageHeaderProps) {
  return (
    <header className="sticky top-14 z-20 flex h-(--header-height) shrink-0 items-center gap-4 border-b bg-card px-4 md:top-0 md:px-(--page-padding)">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* 4 px gaps: the "/" sits 4.5 px after the parent and 5 px before the title (06, 15, 23, 29, 33). */}
        <div className="flex min-w-0 items-baseline gap-1">
          {parent ? (
            <>
              <Link href={parent.href} className="shrink-0 text-sm text-muted-foreground hover:text-foreground">
                {parent.label}
              </Link>
              <span aria-hidden className="text-sm text-muted-foreground">
                /
              </span>
            </>
          ) : null}
          <h1 className="truncate text-[21px] leading-7 font-bold">{title}</h1>
        </div>
        {titleAddon}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-3.5">{actions}</div> : null}
    </header>
  );
}

/** Page body: 22 px top / 32 px side padding and an 18 px gap between blocks. */
export function PageContainer({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-(--page-gap) px-4 pt-(--page-padding-top) pb-8 md:px-(--page-padding)",
        className,
      )}
      {...props}
    />
  );
}
