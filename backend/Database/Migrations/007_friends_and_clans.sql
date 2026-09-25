CREATE TABLE Friendships (
    Id INTEGER NOT NULL CONSTRAINT PK_Friendships PRIMARY KEY AUTOINCREMENT,
    RequesterId INTEGER NOT NULL,
    AddresseeId INTEGER NOT NULL,
    Status TEXT NOT NULL,
    CreatedAt TEXT NOT NULL,
    RespondedAt TEXT NULL,
    CONSTRAINT CK_Friendships_NotSelf CHECK (RequesterId <> AddresseeId),
    CONSTRAINT CK_Friendships_Status CHECK (Status IN ('pending', 'accepted')),
    CONSTRAINT FK_Friendships_Users_RequesterId
        FOREIGN KEY (RequesterId) REFERENCES Users (Id) ON DELETE CASCADE,
    CONSTRAINT FK_Friendships_Users_AddresseeId
        FOREIGN KEY (AddresseeId) REFERENCES Users (Id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IX_Friendships_Pair
    ON Friendships (
        MIN(RequesterId, AddresseeId),
        MAX(RequesterId, AddresseeId)
    );

CREATE INDEX IX_Friendships_Addressee ON Friendships (AddresseeId, Status);
CREATE INDEX IX_Friendships_Requester ON Friendships (RequesterId, Status);

CREATE TABLE Clans (
    Id INTEGER NOT NULL CONSTRAINT PK_Clans PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    Tag TEXT NOT NULL,
    Description TEXT NOT NULL DEFAULT '',
    Emblem TEXT NOT NULL DEFAULT '',
    OwnerId INTEGER NOT NULL,
    CreatedAt TEXT NOT NULL,
    CONSTRAINT FK_Clans_Users_OwnerId
        FOREIGN KEY (OwnerId) REFERENCES Users (Id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IX_Clans_Name ON Clans (Name COLLATE NOCASE);
CREATE UNIQUE INDEX IX_Clans_Tag ON Clans (Tag COLLATE NOCASE);

CREATE TABLE ClanMembers (
    Id INTEGER NOT NULL CONSTRAINT PK_ClanMembers PRIMARY KEY AUTOINCREMENT,
    ClanId INTEGER NOT NULL,
    UserId INTEGER NOT NULL,
    Role TEXT NOT NULL,
    Status TEXT NOT NULL,
    RequestedAt TEXT NOT NULL,
    JoinedAt TEXT NULL,
    CONSTRAINT CK_ClanMembers_Role CHECK (Role IN ('owner', 'officer', 'member')),
    CONSTRAINT CK_ClanMembers_Status CHECK (Status IN ('pending', 'active')),
    CONSTRAINT FK_ClanMembers_Clans_ClanId
        FOREIGN KEY (ClanId) REFERENCES Clans (Id) ON DELETE CASCADE,
    CONSTRAINT FK_ClanMembers_Users_UserId
        FOREIGN KEY (UserId) REFERENCES Users (Id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IX_ClanMembers_ClanUser ON ClanMembers (ClanId, UserId);

CREATE UNIQUE INDEX IX_ClanMembers_ActiveUser
    ON ClanMembers (UserId) WHERE Status = 'active';

CREATE UNIQUE INDEX IX_ClanMembers_Owner
    ON ClanMembers (ClanId) WHERE Role = 'owner';

CREATE INDEX IX_ClanMembers_Clan ON ClanMembers (ClanId, Status);
