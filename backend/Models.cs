using System.ComponentModel.DataAnnotations;

namespace DndForum.Models;

public class User
{
    public int Id { get; set; }

    [Required, MaxLength(32)]
    public string Login { get; set; } = "";

    [Required, MaxLength(200)]
    public string PasswordHash { get; set; } = "";

    [MaxLength(320)] public string Email { get; set; } = "";

    [Required, MaxLength(40)]
    public string Name { get; set; } = "Adventurer";

    [Required, MaxLength(16)]
    public string Role { get; set; } = "user";

    [MaxLength(40)] public string CharClass { get; set; } = "Wizard";
    [MaxLength(40)] public string Race { get; set; } = "Elf";

    public int Level { get; set; } = 1;

    [MaxLength(2000)] public string Bio { get; set; } = "";

    public const string DefaultAvatar = "site:ranger_green";

    [MaxLength(300_000)] public string Avatar { get; set; } = DefaultAvatar;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [MaxLength(32)] public string Cursor { get; set; } = "";

    public bool ShowWanderers { get; set; } = true;

    public bool ShowDragon { get; set; } = true;

    public bool IsOwner { get; set; }

    public bool IsBanned { get; set; }

    [MaxLength(300)] public string BanReason { get; set; } = "";

    public DateTime? BannedAt { get; set; }
}

public class Friendship
{
    public int Id { get; set; }
    public int RequesterId { get; set; }
    public int AddresseeId { get; set; }
    [Required, MaxLength(16)] public string Status { get; set; } = "pending";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RespondedAt { get; set; }
}

public class Clan
{
    public int Id { get; set; }
    [Required, MaxLength(40)] public string Name { get; set; } = "";
    [Required, MaxLength(6)] public string Tag { get; set; } = "";
    [MaxLength(500)] public string Description { get; set; } = "";
    [MaxLength(300_000)] public string Emblem { get; set; } = "";
    public int OwnerId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ClanMember
{
    public int Id { get; set; }
    public int ClanId { get; set; }
    public int UserId { get; set; }
    [Required, MaxLength(16)] public string Role { get; set; } = "member";
    [Required, MaxLength(16)] public string Status { get; set; } = "pending";
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public DateTime? JoinedAt { get; set; }
}

public class Session
{
    public int Id { get; set; }

    [Required, MaxLength(64)]
    public string TokenHash { get; set; } = "";

    public int UserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddDays(30);
}

public class NewsItem
{
    public int Id { get; set; }

    [Required, MaxLength(64)]
    public string ImageKey { get; set; } = "";

    [Required, MaxLength(200)] public string TitleUa { get; set; } = "";
    [Required, MaxLength(200)] public string TitleEn { get; set; } = "";
    [MaxLength(1000)] public string DescUa { get; set; } = "";
    [MaxLength(1000)] public string DescEn { get; set; } = "";

    [Required, MaxLength(16)]
    public string Section { get; set; } = "main";

    [MaxLength(32)]
    public string BgPos { get; set; } = "center";

    public int SortOrder { get; set; }
    public DateTime PublishedAt { get; set; } = DateTime.UtcNow;
}

public class Article
{
    public int Id { get; set; }

    [Required, MaxLength(120)]
    public string Title { get; set; } = "";

    [Required, MaxLength(24)]
    public string Category { get; set; } = "lore";

    [Required]
    public string Content { get; set; } = "";

    [Required, MaxLength(16)]
    public string Format { get; set; } = "markdown";

    [MaxLength(300_000)]
    public string CoverImage { get; set; } = "";

    public int AuthorId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public class Comment
{
    public int Id { get; set; }

    public int DiscussionId { get; set; }

    public int? ParentId { get; set; }

    [Required, MaxLength(4000)]
    public string Body { get; set; } = "";

    public int AuthorId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsDeleted { get; set; }
}

public class ArticleLike
{
    public int ArticleId { get; set; }

    public int UserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
