# Spec Delta

## ADDED Requirements

### Requirement: Member view permissions
`authorize` SHALL support the actions `member_view.view`, `member_view.create`, `member_view.update`, `member_view.delete` and `member_view.transfer`, with these rules (see `member-views` for detail):

| Action | OWNER | ADMIN | USER | Condition |
|---|:-:|:-:|:-:|---|
| `member_view.view` | ✅ | ✅ | ✅ | view group = user's group exactly |
| `member_view.create` | ✅ | ✅ | ✅ | view group = user's group |
| `member_view.update`, `member_view.delete` | ✅ | ✅ | ✅ | view group = user's group and user is the view's owner |
| `member_view.transfer` | ✅ | ✅ | ❌ | view group = user's group and the view is orphaned |

A view whose group is not exactly the user's group SHALL yield 404 (including ancestors and descendants); a visible view the user may not act on SHALL yield 403.

#### Scenario: Ancestor view denied as not found
- **WHEN** `authorize(ownerOfRoot, 'member_view.view', viewOfKelompok)` is called
- **THEN** it throws NotFoundError

#### Scenario: Descendant view denied as not found
- **WHEN** `authorize(userOfKelompok, 'member_view.view', viewOfParentDesa)` is called
- **THEN** it throws NotFoundError

#### Scenario: Non-owner update forbidden
- **WHEN** `authorize(adminOfK, 'member_view.update', viewOfKOwnedByActiveUser)` is called
- **THEN** it throws ForbiddenError

#### Scenario: Non-owner delete forbidden
- **WHEN** `authorize(userOfK, 'member_view.delete', viewOfKOwnedByOther)` is called
- **THEN** it throws ForbiddenError

#### Scenario: Transfer by USER forbidden
- **WHEN** `authorize(userOfK, 'member_view.transfer', orphanedViewOfK)` is called
- **THEN** it throws ForbiddenError

#### Scenario: Transfer of non-orphaned view forbidden
- **WHEN** `authorize(adminOfK, 'member_view.transfer', viewOfKWithActiveOwnerInK)` is called
- **THEN** it throws ForbiddenError

#### Scenario: Transfer from another group not found
- **WHEN** `authorize(adminOfDesa, 'member_view.transfer', orphanedViewOfChildKelompok)` is called
- **THEN** it throws NotFoundError

#### Scenario: Owner allowed
- **WHEN** `authorize(ownerUser, 'member_view.update', theirViewInTheirGroup)` is called
- **THEN** it returns without throwing
