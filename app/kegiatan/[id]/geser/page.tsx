import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { authorize } from "@/lib/authz";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { resolveActivity } from "@/lib/resolve";
import { today } from "@/lib/dates";
import type { ActivityUpdateInput } from "@/lib/validation/activity";
import { ActivityForm } from "../../activity-form";

export default async function SplitActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activityId = Number(id);
  if (!Number.isInteger(activityId)) notFound();

  const session = await auth();
  if (!session) redirect("/login");

  let activity;
  try {
    activity = await resolveActivity(session.user, activityId);
    authorize(session.user, "activity.split", { groupId: activity.groupId });
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  if (activity.freq === "ONCE") {
    throw new ValidationError('Kegiatan sekali tidak bisa digeser "ini & seterusnya"');
  }

  const defaultValues: ActivityUpdateInput = {
    name: activity.name,
    location: activity.location,
    notes: activity.notes ?? undefined,
    startTime: activity.startTime,
    durationMinutes: activity.durationMinutes,
    freq: activity.freq as ActivityUpdateInput["freq"],
    interval: activity.interval,
    weekdays: activity.weekdays as number[],
    monthDay: activity.monthDay ?? undefined,
    startsOn: today(),
    endsOn: activity.endsOn ?? undefined,
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-muted-foreground">{activity.name}</p>
        <h1 className="text-lg font-semibold">Ubah ini &amp; seterusnya</h1>
        <p className="text-sm text-muted-foreground">
          Perubahan berlaku mulai tanggal yang dipilih; jadwal sebelum tanggal itu tidak berubah.
        </p>
      </div>
      <ActivityForm mode="split" activityId={activity.id} defaultValues={defaultValues} />
    </div>
  );
}
