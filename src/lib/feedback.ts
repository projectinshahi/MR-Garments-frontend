import { toast } from "sonner";

import { SESSION_ENDED_URL } from "@/config/navigation";

import { ApiError } from "./api/errors";

export { SESSION_ENDED_URL };

// Approved Batch 1 wording (U36.2 M1-M26, U37.2 K3-K7). Coordinator-owned: screens import these and never reword
// them. Field messages for the user forms arrive from the API in `fields` with the same text.

export const MESSAGES = {
  signInEmpty: "Enter your email and password.", // M1
  signInWrong: "Email or password is incorrect.", // M2
  tooManyAttempts: "Too many attempts. Try again in 15 minutes.", // M3
  sessionEnded: "Your session has ended. Please sign in again.", // M4
  currentPasswordEmpty: "Enter your current password.", // M5
  currentPasswordWrong: "Current password is incorrect.", // M6
  newPasswordEmpty: "Enter a new password.", // M7
  passwordRules: "Use at least 8 characters, a number and a capital letter.", // M8
  passwordTooLong: "Use 128 characters or fewer.", // M9
  confirmEmpty: "Confirm your new password.", // M10
  confirmMismatch: "New passwords do not match.", // M11
  linkInvalid: "This link is invalid or has expired. Ask your manager for a new one.", // M12
  fullNameEmpty: "Enter the full name.", // M13
  emailInvalid: "Enter a valid email address.", // M14
  emailTaken: "A user with this email already exists.", // M15
  roleEmpty: "Choose a role.", // M16
  officeInvalid: "Choose an office from the list.", // M17
  stageOutsideRole: (role: string, stage: string) => `${role} can't enter data for ${stage}. Untick it first.`, // M18
  stagesNotUsed: (role: string) => `${role} doesn't use stage access. Untick all stages first.`, // M19
  lastManagement: "At least one active Management user is required.", // M20
  supplierNameEmpty: "Enter the supplier name.", // M21 (existing)
  supplierNameTaken: "A supplier with this name already exists.", // M22
  noAccess: "You don't have access to do that.", // M23
  somethingWrong: "Something went wrong.", // M24 title (existing ErrorState default)
  tryAgain: "Please try again.", // M24 description (existing ErrorState default)
  signOutFailed: "Couldn't sign you out. Please try again.", // M26
} as const;

export const SUCCESS = {
  passwordChanged: "Password changed", // K3
  passwordSet: "Password set. You can sign in now.", // K4
  userAdded: "User added", // K5
  userSaved: "User saved", // K6
  supplierAdded: "Supplier added", // K7
} as const;


export const notifySuccess = (message: string) => toast.success(message);

/**
 * Handles a failed request per E1-E14 and returns any field errors for the form to show under its fields.
 * - 401: the session ended, so go to sign-in with M4 (E6).
 * - 403: toast M23 (E8).
 * - 409/422 with `fields`: returned for the form (E1-E3); nothing else is shown.
 * - Anything else (400, 5xx, network): toast M24 and keep the entered values (E11, E12).
 */
export function handleApiError(error: unknown): Record<string, string> | undefined {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      window.location.assign(SESSION_ENDED_URL);
      return undefined;
    }
    if (error.status === 403) {
      toast.error(MESSAGES.noAccess);
      return undefined;
    }
    if ((error.status === 409 || error.status === 422) && error.fields) return error.fields;
  }
  toast.error(MESSAGES.somethingWrong, { description: MESSAGES.tryAgain });
  return undefined;
}
