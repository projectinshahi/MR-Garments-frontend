"use client";

import { useEffect, useRef, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatNumber, formatQty } from "@/lib/formatters";

import { type OrderProduct, productsOf, totalsByUnit } from "./order-products";

// The Orders list's Item and Quantity cells over every product of the order (order-products.ts): the first two
// products with their own quantities, then "+N more", which opens the full list (hover or click with a mouse, tap on
// a touch screen, Enter or Space from the keyboard). Clicks inside never open the order, as the rest of the row does.

/** How many products the Item cell names before "+N more". */
export const SHOWN_PRODUCTS = 2;

type ProductsSource = Parameters<typeof productsOf>[0] & { po: string };

const totalsText = (products: OrderProduct[]) =>
  totalsByUnit(products)
    .map((total) => formatQty(total.quantity, total.unit))
    .join(" · ");
const count = (products: OrderProduct[]) => `${formatNumber(products.length)} product${products.length === 1 ? "" : "s"}`;

export function OrderProductsCell({ order }: { order: ProductsSource }) {
  const products = productsOf(order);
  const more = products.length - SHOWN_PRODUCTS;
  return (
    // Long names wrap within the column instead of widening the table.
    <div className="flex max-w-[190px] flex-col gap-0.5 leading-[18px]">
      {products.slice(0, SHOWN_PRODUCTS).map((product) => (
        <span key={`${product.item} ${product.unit}`}>
          {product.item} <span className="whitespace-nowrap text-muted-foreground">· {formatQty(product.quantity, product.unit)}</span>
        </span>
      ))}
      {more > 0 ? <AllProducts po={order.po} products={products} label={`+${formatNumber(more)} more`} /> : null}
    </div>
  );
}

/** The order's total quantity per unit and, for more than one product, how many there are. */
export function OrderQuantityCell({ order }: { order: ProductsSource }) {
  const products = productsOf(order);
  return (
    <div className="flex flex-col leading-[18px]">
      {totalsByUnit(products).map((total) => (
        <span key={total.unit} className="whitespace-nowrap">
          {formatQty(total.quantity, total.unit)}
        </span>
      ))}
      {products.length > 1 ? <span className="text-[12.5px] whitespace-nowrap text-muted-foreground">{count(products)}</span> : null}
    </div>
  );
}

/**
 * "+N more" and the popover with every product. A mouse opens it on hover (and closes it on leaving, unless it was
 * clicked open); a click or tap toggles it; Escape or a click outside closes it. Opening on hover never takes focus.
 */
function AllProducts({ po, products, label }: { po: string; products: OrderProduct[]; label: string }) {
  const [open, setOpen] = useState(false);
  const mode = useRef<"hover" | "click" | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const change = (next: boolean) => {
    window.clearTimeout(timer.current);
    mode.current = next ? (mode.current ?? "click") : null;
    setOpen(next);
  };
  const enter = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    window.clearTimeout(timer.current);
    if (!open)
      timer.current = window.setTimeout(() => {
        mode.current = "hover";
        setOpen(true);
      }, 120);
  };
  const leave = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    window.clearTimeout(timer.current);
    if (mode.current !== "click") timer.current = window.setTimeout(() => change(false), 150);
  };

  return (
    <Popover open={open} onOpenChange={change}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: show all ${products.length} products of ${po}`}
          className="w-fit rounded-sm text-[12.5px] leading-[18px] font-bold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
          onPointerEnter={enter}
          onPointerLeave={leave}
          onClick={(event) => {
            event.stopPropagation();
            // Hovered open, then clicked: it stays open (pinned) instead of closing under the pointer.
            if (open && mode.current === "hover") {
              event.preventDefault();
              mode.current = "click";
            }
          }}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        aria-label={`Products of ${po}`}
        className="w-72 max-w-[calc(100vw-2rem)] p-0"
        onOpenAutoFocus={(event) => {
          if (mode.current === "hover") event.preventDefault();
        }}
        onClick={(event) => event.stopPropagation()}
        onPointerEnter={enter}
        onPointerLeave={leave}
      >
        <p className="border-b px-3 py-2 text-[12.5px] leading-[18px] text-muted-foreground">
          <span className="font-bold text-foreground">{po}</span> · {count(products)} · {totalsText(products)}
        </p>
        <ul className="max-h-64 overflow-y-auto py-1">
          {products.map((product) => (
            <li key={`${product.item} ${product.unit}`} className="flex items-baseline justify-between gap-4 px-3 py-1.5 text-sm leading-[18px]">
              <span className="min-w-0">{product.item}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">{formatQty(product.quantity, product.unit)}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
