import { APP_NAME, PRODUCT_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

// Static product copy from the auth references (1–3).
const SIX_STAGES = [
  "Order and deposit",
  "Receiving in China",
  "Container loading",
  "Clearing in India",
  "Transport",
  "India warehouse and landed cost",
];

/** Split layout for sign in, forgot and change password: 700 px navy panel plus a centered 440 px card (01–03). */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh bg-background">
      <aside className="hidden w-[700px] shrink-0 flex-col justify-between bg-linear-to-b from-sidebar-from to-sidebar-to px-16 pt-16 pb-[73px] text-white lg:flex">
        <div>
          <div className="flex items-center gap-4">
            <span className="flex size-11 items-center justify-center rounded-[10px] bg-primary text-[17px] font-bold">MR</span>
            <span className="text-xl font-bold">{APP_NAME}</span>
          </div>
          <p className="mt-[95px] text-[40px] leading-[48px] font-bold">{PRODUCT_NAME}</p>
          <p className="mt-[18px] max-w-[490px] text-[17px] leading-[26px] text-sidebar-foreground">
            Follow every order from China to your India warehouse, with the final cost in INR.
          </p>
        </div>
        <div>
          <p className="text-[13px] leading-4 tracking-[0.1em] text-sidebar-muted uppercase">Every order, six stages</p>
          <ol className="mt-[25px] flex flex-col gap-[18px]">
            {SIX_STAGES.map((stage, index) => {
              const last = index === SIX_STAGES.length - 1;
              return (
                <li key={stage} className="flex items-center gap-[15px] text-[15.5px]">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
                      last ? "bg-primary" : "border border-white/30",
                    )}
                  >
                    {index + 1}
                  </span>
                  {stage}
                </li>
              );
            })}
          </ol>
        </div>
      </aside>
      <main className="flex flex-1 items-center justify-center p-4">
        {/* The references draw the card from x 850 to 1290 with its content starting 41 px inside the left edge. */}
        <div className="w-full max-w-[440px] rounded-2xl border border-border-subtle bg-card p-6 shadow-[0_12px_40px_rgb(19_33_60/8%)] sm:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
