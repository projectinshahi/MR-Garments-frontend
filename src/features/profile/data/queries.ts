import { apiGet } from "@/lib/api/server";
import type { ProfileResponse } from "@/lib/api/types";

// My profile (51_17.2) reads PRF-1: the signed-in user's own profile (the API takes the user from the session). The
// call reads the session cookie, so the page renders inside the shell's Suspense boundary; a failure throws to the
// (app) error.tsx.
export const getProfile = () => apiGet<ProfileResponse>("/profile");
