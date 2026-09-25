CREATE TABLE Discussions (
    Id INTEGER NOT NULL CONSTRAINT PK_Discussions PRIMARY KEY AUTOINCREMENT,
    ArticleId INTEGER NULL,
    NewsId INTEGER NULL,
    CONSTRAINT CK_Discussions_OneTarget CHECK (
        (ArticleId IS NOT NULL AND NewsId IS NULL)
        OR (ArticleId IS NULL AND NewsId IS NOT NULL)
    ),
    CONSTRAINT FK_Discussions_Articles_ArticleId
        FOREIGN KEY (ArticleId) REFERENCES Articles (Id) ON DELETE CASCADE,
    CONSTRAINT FK_Discussions_News_NewsId
        FOREIGN KEY (NewsId) REFERENCES News (Id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IX_Discussions_ArticleId
    ON Discussions (ArticleId) WHERE ArticleId IS NOT NULL;
CREATE UNIQUE INDEX IX_Discussions_NewsId
    ON Discussions (NewsId) WHERE NewsId IS NOT NULL;

INSERT INTO Discussions (ArticleId)
SELECT Id FROM Articles;

INSERT INTO Discussions (NewsId)
SELECT Id FROM News;

CREATE TABLE Comments_v2 (
    Id INTEGER NOT NULL CONSTRAINT PK_Comments PRIMARY KEY AUTOINCREMENT,
    DiscussionId INTEGER NOT NULL,
    ParentId INTEGER NULL,
    Body TEXT NOT NULL,
    AuthorId INTEGER NOT NULL,
    CreatedAt TEXT NOT NULL,
    IsDeleted INTEGER NOT NULL,
    CONSTRAINT FK_Comments_Discussions_DiscussionId
        FOREIGN KEY (DiscussionId) REFERENCES Discussions (Id) ON DELETE CASCADE,
    CONSTRAINT FK_Comments_Comments_ParentId
        FOREIGN KEY (ParentId) REFERENCES Comments_v2 (Id) ON DELETE SET NULL,
    CONSTRAINT FK_Comments_Users_AuthorId
        FOREIGN KEY (AuthorId) REFERENCES Users (Id) ON DELETE CASCADE
);

INSERT INTO Comments_v2 (
    Id, DiscussionId, ParentId, Body, AuthorId, CreatedAt, IsDeleted
)
SELECT
    c.Id,
    d.Id,
    c.ParentId,
    c.Body,
    c.AuthorId,
    c.CreatedAt,
    c.IsDeleted
FROM Comments c
LEFT JOIN Discussions d
    ON (c.TargetType = 'article' AND d.ArticleId = c.TargetId)
    OR (c.TargetType = 'news' AND d.NewsId = c.TargetId);

DROP TABLE Comments;
ALTER TABLE Comments_v2 RENAME TO Comments;

CREATE INDEX IX_Comments_DiscussionId_CreatedAt
    ON Comments (DiscussionId, CreatedAt);
CREATE INDEX IX_Comments_AuthorId ON Comments (AuthorId);
CREATE INDEX IX_Comments_ParentId ON Comments (ParentId);
