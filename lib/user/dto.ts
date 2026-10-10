import type { Role } from "@/lib/validation/enums";

/** The only user fields that may cross the Server Action boundary (user-management spec: credential data never leaves the server). */
export type UserDto = {
  id: number;
  username: string;
  name: string;
  isActive: boolean;
  mustChangePassword: boolean;
};

export type CreatedUserDto = UserDto & { role: Role; groupId: number };

/** Explicit pick, not a spread or a `delete`: a column added to `User` later is not exposed until listed here. */
export function toUserDto(user: UserDto): UserDto {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  };
}

export function toCreatedUserDto(user: UserDto, role: { role: Role; groupId: number }): CreatedUserDto {
  return { ...toUserDto(user), role: role.role, groupId: role.groupId };
}
