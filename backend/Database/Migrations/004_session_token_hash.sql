DELETE FROM Sessions;

ALTER TABLE Sessions RENAME COLUMN Token TO TokenHash;

DROP INDEX IX_Sessions_Token;
CREATE UNIQUE INDEX IX_Sessions_TokenHash ON Sessions (TokenHash);
