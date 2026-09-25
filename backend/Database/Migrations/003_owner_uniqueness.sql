CREATE UNIQUE INDEX UX_Users_OneOwner
ON Users (IsOwner)
WHERE IsOwner = 1;
