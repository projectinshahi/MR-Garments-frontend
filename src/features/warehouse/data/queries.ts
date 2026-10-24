import { listLocations, listTeams } from "@/lib/data/master";

import * as fixtures from "./fixtures";

export type { ReceiveGoods, WarehouseReceipt } from "./fixtures";

export type WarehouseListData = Awaited<ReturnType<typeof getWarehouseList>>;
export type ReceiveGoodsData = Awaited<ReturnType<typeof getReceiveGoods>>;

const warehouses = async () => (await listLocations()).filter((l) => l.type === "Warehouse").map((l) => l.name);

/** Warehouse list: receipts plus the warehouse and team filter options. Async and copied so a real API can replace it. */
export async function getWarehouseList() {
  const [names, teams] = await Promise.all([warehouses(), listTeams()]);
  return structuredClone({ receipts: fixtures.warehouseReceipts, warehouses: names, teams: teams.map((t) => t.name) });
}

/** Receive goods form, prefilled for PO-2028 as in the reference. Teams come from master data, in master order. */
export async function getReceiveGoods() {
  const [names, teams] = await Promise.all([warehouses(), listTeams()]);
  const { split, ...rest } = fixtures.receiveGoods;
  return structuredClone({
    ...rest,
    warehouses: names,
    teams: teams.map((t) => ({ id: t.id, name: t.name, pieces: split[t.id] ?? 0 })),
  });
}
