import * as master from "@/mocks/data/master";

// Master-data accessors (orchestrator-owned, D2). Async and returning copies so a real API can replace
// the fixtures without changing callers, and no caller can mutate the shared data.

const copy = <T>(value: T): Promise<T> => Promise.resolve(structuredClone(value));

export const listSuppliers = () => copy(master.suppliers);
export const listShippingAgents = () => copy(master.shippingAgents);
export const listClearingAgents = () => copy(master.clearingAgents);
export const listTransportCompanies = () => copy(master.transportCompanies);
export const listLocations = () => copy(master.locations);
export const listTeams = () => copy(master.teams);
export const listItems = () => copy(master.items);
export const listUsers = () => copy(master.users);
export const getRoleMatrix = () => copy({ roles: master.ROLES, rows: master.roleMatrix });
export const getCurrentUser = (variant: "management" | "staff" = "management") =>
  copy(variant === "staff" ? master.staffUser : master.managementUser);
