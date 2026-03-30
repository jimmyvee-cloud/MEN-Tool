/** Dispatched after follow/unfollow so Profile can refresh the Following strip. */
export const FOLLOWING_UPDATED_EVENT = "mentool-following-updated";

export function notifyFollowingUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FOLLOWING_UPDATED_EVENT));
  }
}
