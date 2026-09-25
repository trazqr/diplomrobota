using DndForum.Models;

namespace DndForum;

public static class Seed
{
    public const string SeedAuthorLogin = "dnd-archive";

    public static User CreateAuthor() => new()
    {
        Login = SeedAuthorLogin,
        PasswordHash = Auth.HashPassword(Auth.NewToken()),
        Name = "Adventurer",
        CharClass = "Wizard",
        Race = "Elf",
        Level = 5,
    };

    public static IReadOnlyList<Article> CreateArticles(int authorId) =>
    [
        new Article
        {
            Title = "Як стати хорошим Майстром Підземель",
            Category = "rules",
            AuthorId = authorId,
            CreatedAt = new DateTime(2026, 7, 15, 0, 0, 0, DateTimeKind.Utc),
            Content =
                "Роль Майстра Підземель (DM) — одна з найскладніших і водночас найцікавіших у D&D. " +
                "Ви одночасно режисер, актор, суддя і оповідач.\n\n" +
                "**1. Підготуйтеся, але не переборщуйте**\nЗаздалегідь сплануйте основні події, " +
                "але залишайте простір для імпровізації.\n\n" +
                "**2. Слухайте гравців**\nНайкращі сесії народжуються зі взаємодії.\n\n" +
                "**3. Використовуйте описи**\nЗамість «ви бачите ворога» — «з темряви з'являється " +
                "велетенська тінь, від якої пахне сіркою й іржавим металом».",
        },
        new Article
        {
            Title = "Лор: Іллітіди — Пожирачі Розуму",
            Category = "lore",
            AuthorId = authorId,
            CreatedAt = new DateTime(2026, 7, 22, 0, 0, 0, DateTimeKind.Utc),
            Content =
                "Іллітіди, відомі також як Пожирачі Розуму (Mind Flayers), — одні з найбільш " +
                "моторошних істот у світі D&D.\n\n" +
                "**Походження**\nЗгідно з більшістю джерел, іллітіди прийшли з далекого майбутнього.\n\n" +
                "**Псіонічні здібності**\nМайстри телепатії та псіонічного контролю.\n\n" +
                "**Суспільство**\nКожна колонія підпорядковується Elder Brain.",
        },
        new Article
        {
            Title = "Топ-5 заклинань для початківців",
            Category = "characters",
            AuthorId = authorId,
            CreatedAt = new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc),
            Content =
                "Якщо ви тільки починаєте грати чаклуном або магом, вибір заклинань може " +
                "здатися складним завданням.\n\n" +
                "**1. Fireball**\n8d6 пошкоджень по площі.\n\n" +
                "**2. Shield**\nРеакція на атаку: +5 до AC.\n\n" +
                "**3. Counterspell**\nСкасовує заклинання ворога.\n\n" +
                "**4. Misty Step**\nПереміщення до 18 метрів бонусною дією.\n\n" +
                "**5. Detect Magic**\nПошук магічних предметів.",
        },
    ];
}
