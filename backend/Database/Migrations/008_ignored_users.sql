CREATE TABLE IgnoredUsers (
    Id INTEGER NOT NULL CONSTRAINT PK_IgnoredUsers PRIMARY KEY AUTOINCREMENT,
    UserId INTEGER NOT NULL,
    IgnoredId INTEGER NOT NULL,
    CreatedAt TEXT NOT NULL,
    CONSTRAINT CK_IgnoredUsers_NotSelf CHECK (UserId <> IgnoredId),
    CONSTRAINT FK_IgnoredUsers_Users_UserId
        FOREIGN KEY (UserId) REFERENCES Users (Id) ON DELETE CASCADE,
    CONSTRAINT FK_IgnoredUsers_Users_IgnoredId
        FOREIGN KEY (IgnoredId) REFERENCES Users (Id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IX_IgnoredUsers_Pair ON IgnoredUsers (UserId, IgnoredId);

CREATE INDEX IX_IgnoredUsers_Ignored ON IgnoredUsers (IgnoredId);
