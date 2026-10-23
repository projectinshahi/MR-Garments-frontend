import { toast } from "sonner";

/**
 * D5: the single behavior for actions that have no reference design (Print order, Record payment, exports, …).
 * Never build a page, dialog or flow for such actions. Replace call sites by searching for `notInPrototype`.
 */
export function notInPrototype(action: string) {
  toast.info(`${action} is not included in the current prototype.`, { id: "not-in-prototype" });
}
