import { updateTag } from "next/cache";

export function revalidateMeetupData(): void {
  updateTag("meetup-data");
  updateTag("attendance");
}

export function revalidateAfterpartyData(): void {
  updateTag("afterparty-data");
  updateTag("attendance");
}

export function revalidateMemberData(): void {
  updateTag("member-data");
  updateTag("attendance");
}
