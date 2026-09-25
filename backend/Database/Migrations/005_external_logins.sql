ALTER TABLE Users ADD COLUMN Email TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS IX_Users_Email
    ON Users (Email)
    WHERE Email <> '';

CREATE TABLE IF NOT EXISTS ExternalLogins (
    Provider TEXT NOT NULL,
    ProviderKey TEXT NOT NULL,
    UserId INTEGER NOT NULL,
    CreatedAt TEXT NOT NULL,
    CONSTRAINT PK_ExternalLogins PRIMARY KEY (Provider, ProviderKey),
    CONSTRAINT FK_ExternalLogins_Users_UserId
        FOREIGN KEY (UserId) REFERENCES Users (Id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS IX_ExternalLogins_UserId ON ExternalLogins (UserId);
