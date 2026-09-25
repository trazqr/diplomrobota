using DndForum.Models;

namespace DndForum;

public static class SeedNews
{
    public static IReadOnlyList<NewsItem> CreateNews() =>
    [

            new NewsItem
            {
                Section = "main", SortOrder = 1, ImageKey = "wizard_spells", BgPos = "top center",
                TitleUa = "НОВІ ПРАВИЛА: ОГЛЯД ЗАКЛИНАНЬ D&D",
                TitleEn = "NEW RULES: OVERVIEW OF D&D SPELLS",
                DescUa = "Глибоке занурення у зміни. Порівняння старої та нової механіки. Як це вплине на вашу наступну сесію?",
                DescEn = "Deep dive into changes. Comparison of old and new mechanics. How will this affect your next session?",
            },
            new NewsItem
            {
                Section = "main", SortOrder = 2, ImageKey = "chris_perkins", BgPos = "top center",
                TitleUa = "ІНТЕРВ'Ю З ДИЗАЙНЕРОМ: КРІС ПЕРКІНС",
                TitleEn = "INTERVIEW WITH DESIGNER: CHRIS PERKINS",
                DescUa = "Офіційне оголошення дат виходу та подробиці про нові локації та монстрів. Ексклюзивно для Мультивсесвіту!",
                DescEn = "Official announcement of release dates and details about new locations and monsters. Multiverse News Exclusive!",
            },
            new NewsItem
            {
                Section = "main", SortOrder = 3, ImageKey = "dnd_celebration", BgPos = "top center",
                TitleUa = "СВЯТКУВАННЯ D&D: ПОВНИЙ ОГЛЯД ПОДІЇ",
                TitleEn = "D&D CELEBRATION: FULL EVENT OVERVIEW",
                DescUa = "Всі анонси, інтерв'ю та найкращі моменти. Записи стрімів та матеріали вже доступні!",
                DescEn = "All announcements, interviews, and best moments. Stream recordings and materials are now available!",
            },
            new NewsItem
            {
                Section = "main", SortOrder = 4, ImageKey = "magic_theory", BgPos = "top right",
                TitleUa = "КНИГА «ТЕОРІЯ МАГІЇ»: ВСІ ПРАВИЛА ТА МАГІЯ",
                TitleEn = "BOOK \"THE THEORY OF MAGIC\": ALL RULES AND MAGIC",
                DescUa = "Розкрийте глибини аркани в цьому вичерпному посібнику. Опануйте складнощі нових шкіл магії та унікальних магічних предметів.",
                DescEn = "Uncover the depths of the arcane in this definitive guide. Master the complexities of the new magic schools and unique magical items.",
            },

            new NewsItem
            {
                Section = "community", SortOrder = 1, ImageKey = "white_hair_warrior", BgPos = "top center",
                TitleUa = "Найважливіші події та новини спільноти",
                TitleEn = "Key events and community news",
                DescUa = "Офіційні оновлення правил, презентації саморобних ігор гравців та розбір найцікавіших знахідок спільноти.",
                DescEn = "Official rule updates, player homebrew showcases and a review of the community's best finds.",
            },
            new NewsItem
            {
                Section = "community", SortOrder = 2, ImageKey = "dungeon_hall", BgPos = "center",
                TitleUa = "Історія та знання про істот у D&D",
                TitleEn = "History and lore of D&D creatures",
                DescUa = "Поглиблені профілі монстрів, історія забутих істот та їхнє місце у світах Забутих Королівств.",
                DescEn = "In-depth monster profiles, the history of forgotten creatures and their place in the Forgotten Realms.",
            },
            new NewsItem
            {
                Section = "community", SortOrder = 3, ImageKey = "illithid_lair", BgPos = "center",
                TitleUa = "Лігво Іллітідів: Псіонічні таємниці",
                TitleEn = "Illithid Lair: Psionic secrets",
                DescUa = "Розкрийте заборонені знання конклавів Пожирачів Розуму та дізнайтеся, як протистояти їхньому впливу.",
                DescEn = "Uncover the forbidden knowledge of Mind Flayer conclaves and learn how to resist their influence.",
            },
            new NewsItem
            {
                Section = "community", SortOrder = 4, ImageKey = "dice_hydra", BgPos = "center",
                TitleUa = "Орда Залізного Дракона: Механічні скарби",
                TitleEn = "Iron Dragon Hoard: Mechanical treasures",
                DescUa = "Вирушайте у загублену цитадель Залізного Дракона по артефакти, яких не бачив жоден шукач пригод.",
                DescEn = "Venture into the lost citadel of the Iron Dragon for artifacts no adventurer has ever seen.",
            },
            new NewsItem
            {
                Section = "community", SortOrder = 5, ImageKey = "blue_dragon", BgPos = "center",
                TitleUa = "Відлуння Півночі: Шепіт із замерзлого фортелю",
                TitleEn = "Echoes of the North: Whispers from the frozen hold",
                DescUa = "Дивні повідомлення доносяться з віддаленої північної тундри. Що ховається під кригою?",
                DescEn = "Strange reports arrive from the remote northern tundra. What lies beneath the ice?",
            }];

}
