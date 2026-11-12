/* Creator onboarding (#setup). On the backend this is two calls:
   1. POST /v1/auth/signup/complete/ { role: "creator", fullName, displayName } for an account that hasn't finished sign-up;
   2. PATCH /v1/creators/me/ { displayName, bio, categories, location, primaryPlatform } for the public profile.
   The photo goes up as an "avatar" upload, which sets avatarUrl on its own. */
import { api, storedUser } from "./client";
import { completeSignup } from "./auth";
import { dataUrlToBlob, uploadFile } from "./uploads";

export function toProfilePatch(a) {
  const name = a.name.trim().replace(/\s+/g, " ");
  return {
    displayName: name,
    bio: a.bio.trim(),
    categories: a.categories,
    location: [a.city.trim(), a.region].filter(Boolean).join(", "),
    primaryPlatform: a.instagram ? "instagram" : a.youtube ? "youtube" : "instagram",
  };
}

export async function submitCreatorOnboarding(a) {
  const patch = toProfilePatch(a);
  const u = storedUser();
  if (!u || u.needsOnboarding || !u.role) {
    await completeSignup({ role: "creator", fullName: patch.displayName, displayName: patch.displayName });
  }
  const me = await api("/v1/creators/me/", { method: "PATCH", body: patch });
  if (a.photo && a.photo.startsWith("data:")) {
    try {
      await uploadFile("avatar", dataUrlToBlob(a.photo));
    } catch {
      /* the profile is saved; the photo can be added again from Profile */
    }
  }
  return { ok: true, user: { approvalStatus: me?.approvalStatus || me?.status } };
}
