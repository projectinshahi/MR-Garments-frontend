import type {
  Access,
  ClearingAgent,
  CurrentUser,
  ItemMaster,
  Location,
  Role,
  RoleMatrixRow,
  ShippingAgent,
  Supplier,
  Team,
  TransportCompany,
  User,
} from "@/types/domain";

// Shared master data (D1, D2), transcribed from the Settings (40–46) and Users (47, 49) references.
// Orchestrator-owned. Screen fixtures may reference these but never edit them. Import via src/lib/data.

export const suppliers: Supplier[] = [
  { id: "sup-guangzhou-textile", name: "Guangzhou Textile Co.", contactPerson: "Mr. Zhao Lin", phone: "+86 138 0013 2244", city: "Guangzhou", currency: "CNY", openOrders: 4, status: "Active" },
  { id: "sup-shenzhen-apparel", name: "Shenzhen Apparel", contactPerson: "Ms. Liu Yan", phone: "+86 139 2266 8810", city: "Shenzhen", currency: "CNY", openOrders: 4, status: "Active" },
  { id: "sup-foshan-fabrics", name: "Foshan Fabrics", contactPerson: "Mr. Chen Hao", phone: "+86 137 2288 5501", city: "Foshan", currency: "CNY", openOrders: 3, status: "Active" },
  { id: "sup-yiwu-trims", name: "Yiwu Trims Ltd.", contactPerson: "Ms. Wu Mei", phone: "+86 135 5799 3120", city: "Yiwu", currency: "CNY", openOrders: 4, status: "Active" },
  { id: "sup-hangzhou-knits", name: "Hangzhou Knits", contactPerson: "Mr. Sun Jie", phone: "+86 136 5711 4092", city: "Hangzhou", currency: "CNY", openOrders: 1, status: "Active" },
];

export const shippingAgents: ShippingAgent[] = [
  { id: "ship-sino-freight", name: "Sino Freight", contactPerson: "Ms. Zhang Min", phone: "+86 20 8123 4567", officeCity: "Guangzhou", activeContainers: 4, status: "Active" },
  { id: "ship-dragon-cargo", name: "Dragon Cargo", contactPerson: "Mr. Huang Bo", phone: "+86 755 8899 1200", officeCity: "Shenzhen", activeContainers: 2, status: "Active" },
];

export const clearingAgents: ClearingAgent[] = [
  { id: "clr-kochi-clearing", name: "Kochi Clearing Services", contactPerson: "Mr. Anil Kumar", phone: "+91 98470 12345", port: "Kochi", containersCleared: 2, status: "Active" },
  { id: "clr-southern-port", name: "Southern Port Agents", contactPerson: "Mr. Rajesh Nair", phone: "+91 98950 44210", port: "Kochi", containersCleared: 2, status: "Active" },
];

export const transportCompanies: TransportCompany[] = [
  { id: "trn-kerala-roadways", name: "Kerala Roadways", contactPerson: "Mr. Biju Thomas", phone: "+91 94470 30011", tripsSoFar: 3, status: "Active" },
  { id: "trn-malabar-carriers", name: "Malabar Carriers", contactPerson: "Mr. Salim P", phone: "+91 98460 77120", tripsSoFar: 1, status: "Active" },
];

export const locations: Location[] = [
  { id: "loc-guangzhou-office", name: "Guangzhou office", type: "China office", country: "China", address: "Guangzhou", staff: ["Wang Fang", "Chen Yu", "Li Wei"], status: "Active" },
  { id: "loc-india-office", name: "India office", type: "India office", country: "India", address: "Kochi", staff: ["Anil Sharma"], status: "Active" },
  { id: "loc-main-warehouse", name: "Main warehouse", type: "Warehouse", country: "India", address: "Kochi", staff: ["Joseph M"], status: "Active" },
];

export const teams: Team[] = [
  { id: "team-retail", name: "Retail team", piecesInStock: 6000, landedCostOfStock: 1695080, averagePerPiece: 282.51, status: "Active" },
  { id: "team-wholesale", name: "Wholesale team", piecesInStock: 5900, landedCostOfStock: 1575410, averagePerPiece: 267.02, status: "Active" },
  { id: "team-online", name: "Online team", piecesInStock: 3900, landedCostOfStock: 951070, averagePerPiece: 243.86, status: "Active" },
];

export const items: ItemMaster[] = [
  { id: "item-denim-jeans", name: "Denim jeans", countedIn: "Pieces", perBundle: 50, usedInOrders: ["PO-2028", "PO-2050"], status: "Active" },
  { id: "item-track-pants", name: "Track pants", countedIn: "Pieces", perBundle: 50, usedInOrders: ["PO-2030", "PO-2057"], status: "Active" },
  { id: "item-kids-t-shirts", name: "Kids t-shirts", countedIn: "Pieces", perBundle: 50, usedInOrders: ["PO-2029"], status: "Active" },
  { id: "item-ladies-kurtis", name: "Ladies kurtis", countedIn: "Pieces", perBundle: 50, usedInOrders: ["PO-2032", "PO-2060"], status: "Active" },
  { id: "item-polo-shirts", name: "Polo shirts", countedIn: "Pieces", perBundle: 50, usedInOrders: ["PO-2033", "PO-2059"], status: "Active" },
  { id: "item-mens-shorts", name: "Men's shorts", countedIn: "Pieces", perBundle: 50, usedInOrders: ["PO-2034"], status: "Active" },
  { id: "item-mens-jackets", name: "Men's jackets", countedIn: "Pieces", perBundle: 50, usedInOrders: ["PO-2035"], status: "Active" },
  { id: "item-cotton-fabric", name: "Cotton fabric", countedIn: "Metres", perBundle: "Roll", usedInOrders: ["PO-2027", "PO-2058"], status: "Active" },
];

export const users: User[] = [
  { id: "usr-suresh", name: "Suresh Menon", email: "suresh@mrgarments.com", role: "Management", office: "Head office", lastSignIn: "Today, 09:12", status: "Active" },
  { id: "usr-priya", name: "Priya Nair", email: "priya@mrgarments.com", role: "Procurement", office: "Head office", lastSignIn: "Today, 08:40", status: "Active" },
  { id: "usr-anita", name: "Anita Joseph", email: "anita@mrgarments.com", role: "Accounts", office: "Head office", lastSignIn: "Yesterday, 17:05", status: "Active" },
  { id: "usr-wang", name: "Wang Fang", email: "wang@mrgarments.com", role: "China staff", office: "Guangzhou office", lastSignIn: "Today, 10:20", status: "Active" },
  { id: "usr-chen", name: "Chen Yu", email: "chen@mrgarments.com", role: "China staff", office: "Guangzhou office", lastSignIn: "Yesterday, 15:31", status: "Active" },
  { id: "usr-li", name: "Li Wei", email: "li@mrgarments.com", role: "China staff", office: "Guangzhou office", lastSignIn: "26 Sep, 14:02", status: "Active" },
  { id: "usr-anil", name: "Anil Sharma", email: "anil@mrgarments.com", role: "India staff", office: "India office", lastSignIn: "Today, 11:48", status: "Active" },
  { id: "usr-joseph", name: "Joseph M", email: "joseph@mrgarments.com", role: "Warehouse staff", office: "Main warehouse", lastSignIn: "28 Sep, 16:05", status: "Active" },
];

export const ROLES: Role[] = ["Management", "Procurement", "Accounts", "China staff", "India staff", "Warehouse staff"];

// Roles matrix (49), columns in ROLES order. "Roles are fixed in this first version."
const matrix: [string, Access[]][] = [
  ["Dashboard", ["Full", "Full", "Full", "None", "None", "None"]],
  ["Orders: view", ["Full", "Full", "View", "None", "None", "None"]],
  ["Orders: create and edit", ["Full", "Enter", "None", "None", "None", "None"]],
  ["Deposits and payments", ["Full", "View", "Enter", "None", "None", "None"]],
  ["Delivery calendar", ["Full", "Full", "None", "None", "None", "None"]],
  ["Receiving (China)", ["Full", "View", "None", "Enter", "None", "None"]],
  ["Container loading", ["Full", "None", "None", "Enter", "None", "None"]],
  ["Clearing (India)", ["Full", "None", "None", "None", "Enter", "None"]],
  ["Transport", ["Full", "None", "None", "None", "Enter", "None"]],
  ["Warehouse", ["Full", "None", "None", "None", "None", "Enter"]],
  ["Landed cost", ["Full", "None", "None", "None", "None", "None"]],
  ["Reports", ["Full", "None", "None", "None", "None", "None"]],
  ["Settings and users", ["Full", "None", "None", "None", "None", "None"]],
];

export const roleMatrix: RoleMatrixRow[] = matrix.map(([capability, access]) => ({
  capability,
  access: Object.fromEntries(ROLES.map((role, i) => [role, access[i]])) as Record<Role, Access>,
}));

// Sidebar footer users as shown in the references (4 and others; 39).
export const managementUser: CurrentUser = { name: "Management", detail: "Full access", initials: "MG", variant: "management" };
export const staffUser: CurrentUser = { name: "Chen Yu", detail: "China office · Entry only", initials: "CY", variant: "staff" };
