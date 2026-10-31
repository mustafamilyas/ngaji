import { TagChip } from "@/components/tags/tag-chip";
import type { GroupTag, GroupTagKey } from "@/lib/tag/group-tags";
import { KeyMenu, NewTagDialog, TagMenu } from "./tag-manage";

function Usage({ tag }: { tag: GroupTag }) {
  if (tag.members === undefined) return null;
  return (
    <span className="shrink-0 text-xs text-muted-foreground">
      {tag.members} anggota · {tag.activities} kegiatan
    </span>
  );
}

function TagRow({ tag, canManage }: { tag: GroupTag; canManage: boolean }) {
  return (
    <li className="flex min-h-11 items-center justify-between gap-3 py-1">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <TagChip tag={tag} />
        <Usage tag={tag} />
      </div>
      {canManage && <TagMenu tag={tag} />}
    </li>
  );
}

/**
 * The tags a group owns, by key: a simple tag is one row, a key lists its values. Everyone who can see the group
 * sees the list; managers (ADMIN or OWNER of this very group) also get the usage counts and the controls.
 */
export function TagTab({ keys, canManage }: { keys: GroupTagKey[]; canManage: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex">
          <NewTagDialog />
        </div>
      )}
      {keys.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Grup ini belum punya tag.{canManage && " Buat yang pertama dengan “Tag baru”."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y">
          {keys.map(({ key, tags }) =>
            tags.length === 1 && tags[0].value === null ? (
              <TagRow key={key} tag={tags[0]} canManage={canManage} />
            ) : (
              <li key={key} className="py-2">
                <div className="flex min-h-11 items-center justify-between gap-3">
                  <h3 className="text-sm font-medium">{key}</h3>
                  {canManage && (
                    <KeyMenu
                      keyName={key}
                      firstTagId={tags[0].id}
                      values={tags.length}
                      members={tags.reduce((sum, tag) => sum + (tag.members ?? 0), 0)}
                      activities={tags.reduce((sum, tag) => sum + (tag.activities ?? 0), 0)}
                    />
                  )}
                </div>
                <ul className="flex flex-col pl-3">
                  {tags.map((tag) => (
                    <TagRow key={tag.id} tag={tag} canManage={canManage} />
                  ))}
                </ul>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
