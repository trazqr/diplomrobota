using DndForum.Models;

namespace DndForum;

public static class SeedContent
{
    public static IReadOnlyList<CharacterPreset> CreatePresets() =>
    [
            new CharacterPreset
            {
                Slug = "preset-1", SortOrder = 1,
                NameUa = "Елора Світлоносна", NameEn = "Elora Sunstrider",
                ClassUa = "Чародій", ClassEn = "Wizard",
                RaceUa = "Ельф", RaceEn = "Elf",
                Level = 3,
                AvatarKey = "ranger_green", BgKey = "rules_hero_bg",
                DescUa = "Майстер арканної магії, що прагне розкрити прадавні таємниці забутих королівств.",
                DescEn = "Master of arcane arts seeking to uncover ancient secrets of forgotten realms.",
                Str = 8, Dex = 14, Con = 12, Int = 18, Wis = 13, Cha = 10,
                SpellsUa = "Фаєрбол;Щит;Магічна стріла",
                SpellsEn = "Fireball;Shield;Magic Missile",
            },
            new CharacterPreset
            {
                Slug = "preset-2", SortOrder = 2,
                NameUa = "Торін Залізноуст", NameEn = "Thorin Ironjaw",
                ClassUa = "Воїн", ClassEn = "Fighter",
                RaceUa = "Дворф", RaceEn = "Dwarf",
                Level = 5,
                AvatarKey = "skeleton_warrior", BgKey = "skeleton_warrior",
                DescUa = "Незламний захисник гірських фортець з палаючим молотом та важкою бронею.",
                DescEn = "Stalwart defender of mountain holds with a blazing warhammer and heavy plate.",
                Str = 17, Dex = 10, Con = 16, Int = 9, Wis = 12, Cha = 8,
                SpellsUa = "Друге дихання;Всплеск дій",
                SpellsEn = "Second Wind;Action Surge",
            },
            new CharacterPreset
            {
                Slug = "preset-3", SortOrder = 3,
                NameUa = "Каеліс Тіньокрок", NameEn = "Kaelis Shadowstep",
                ClassUa = "Слідопит", ClassEn = "Rogue",
                RaceUa = "Напівпалун", RaceEn = "Halfling",
                Level = 4,
                AvatarKey = "illithid_lair", BgKey = "illithid_lair",
                DescUa = "Прихований шукач пригод, здатний прослизнути через будь-які пастки та варту.",
                DescEn = "Stealthy explorer capable of slipping through any trap and guard post.",
                Str = 10, Dex = 18, Con = 13, Int = 12, Wis = 14, Cha = 11,
                SpellsUa = "Прихована атака;Хитрість",
                SpellsEn = "Sneak Attack;Cunning Action",
            },
            new CharacterPreset
            {
                Slug = "preset-4", SortOrder = 4,
                NameUa = "Валерій Сонячний", NameEn = "Valerius Sunshield",
                ClassUa = "Паладин", ClassEn = "Paladin",
                RaceUa = "Людина", RaceEn = "Human",
                Level = 4,
                AvatarKey = "blue_dragon", BgKey = "blue_dragon",
                DescUa = "Священний воїн праведності, що присягнув захищати слабких від сил темряви.",
                DescEn = "Holy warrior of righteousness sworn to defend the weak against evil.",
                Str = 16, Dex = 9, Con = 14, Int = 10, Wis = 12, Cha = 16,
                SpellsUa = "Божественна кара;Накладення рук",
                SpellsEn = "Divine Smite;Lay on Hands",
            }];

    public static IReadOnlyList<RuleCard> CreateRules() =>
    [
            new RuleCard
            {
                Slug = "vtt", Section = "rule", SortOrder = 1, ImageKey = "skeleton_warrior", Alt = "Party at table",
                TitleUa = "ПАРТІЯ ЗА ІГРОВИМ СТОЛОМ", TitleEn = "PARTY AT THE GAME TABLE",
                DescUa = "Ігрові сесії проходять через віртуальні ігрові столи, такі як Roll20 або Foundry VTT, які дозволяють гравцям взаємодіяти з об'єктами в грі та зручно керувати своїми персонажами відповідно до правил Dungeons & Dragons.",
                DescEn = "Game sessions take place via virtual tabletops like Roll20 or Foundry VTT, which allow players to interact with objects in the game and conveniently manage their characters according to Dungeons & Dragons rules.",
            },
            new RuleCard
            {
                Slug = "dice", Section = "rule", SortOrder = 2, ImageKey = "ranger_green", Alt = "Dice role",
                TitleUa = "РОЛЬ КУБИКІВ У ГРІ", TitleEn = "THE ROLE OF DICE IN THE GAME",
                DescUa = "Кубики в Dungeons & Dragons відіграють ключову роль у визначенні результатів дій гравців та розвитку подій. Кожен тип кубика має свої унікальні характеристики та використовується для різних ситуацій у грі.",
                DescEn = "Dice in Dungeons & Dragons play a key role in determining the outcomes of player actions and the progression of events. Each type of die has its own unique characteristics and is used for different situations.",
            },
            new RuleCard
            {
                Slug = "start", Section = "rule", SortOrder = 3, ImageKey = "dungeon_hall", Alt = "Start of game",
                TitleUa = "ПОЧАТОК ГРИ", TitleEn = "START OF THE GAME",
                DescUa = "Незалежно від того, чи граєте ви у великій кампанії, чи в одноразовому епізоді, перш ніж зануритися в сюжет, ведучий гри запропонує вам представити свого персонажа команді.",
                DescEn = "Regardless of whether you are playing a large campaign or a one-shot, before diving into the story the game master will suggest that you introduce your character to the team.",
            },
            new RuleCard
            {
                Slug = "session", Section = "rule", SortOrder = 4, ImageKey = "dice_hydra", Alt = "Game session",
                TitleUa = "ХОД ІГРОВОГО СЕАНСУ", TitleEn = "GAME SESSION PROGRESS",
                DescUa = "Під час сесії гравці взаємодіють один з одним та з непередбачуваним світом, керуючи діями своїх персонажів відповідно до правил Dungeons & Dragons. Кожна дія впливає на хід подій та відкриває нові можливості.",
                DescEn = "During the session, players interact with each other and with the unpredictable world, managing their characters' actions in accordance with the Dungeons & Dragons rules.",
            },

            new RuleCard
            {
                Slug = "no-loners", Section = "forbidden", SortOrder = 1, ImageKey = "soldiers_snow", Alt = "Team communication",
                TitleUa = "НЕ СТВОРЮЙТЕ ОДИНАКІВ", TitleEn = "DON'T CREATE LONERS",
                DescUa = "D&D — це командна гра. Герої повинні працювати разом, щоб вижити та досягти спільної мети. Персонажі-одинаки руйнують командний дух та ускладнюють пригоду для всіх.",
                DescEn = "D&D is a team game. Heroes must work together to survive and achieve a common goal. Loner characters disrupt team spirit and make the adventure harder for everyone.",
            },
            new RuleCard
            {
                Slug = "no-metagaming", Section = "forbidden", SortOrder = 2, ImageKey = "blue_dragon", Alt = "Dungeon Master",
                TitleUa = "НЕ МЕТАГЕЙМІТЬ", TitleEn = "NO METAGAMING",
                DescUa = "Використовуйте лише ті знання, якими володіє ваш персонаж. Не переносьте інформацію з реального світу або з книг правил у дії героя.",
                DescEn = "Only use the knowledge that your character possesses. Do not transfer information from the real world or rulebooks into the hero's actions.",
            },
            new RuleCard
            {
                Slug = "no-ooc-conflicts", Section = "forbidden", SortOrder = 3, ImageKey = "white_hair_warrior", Alt = "Roleplay",
                TitleUa = "УНИКАЙТЕ КОНФЛІКТІВ", TitleEn = "AVOID OUT-OF-CHARACTER CONFLICTS",
                DescUa = "Намагайтеся вирішувати суперечності між персонажами в рамках гри та не переносьте ігрові конфлікти на особисті стосунки гравців.",
                DescEn = "Try to resolve disputes between characters within the game and do not transfer in-game conflicts to the players' personal relationships.",
            }];

    public static IReadOnlyList<Campaign> CreateCampaigns() =>
    [
            new Campaign
            {
                Slug = "phandelver", SortOrder = 1,
                ImageKey = "skeleton_warrior", BgPos = "top center",
                TagUa = "ДЛЯ ПЕРСОНАЖІВ 1–ГО РІВНЯ", TagEn = "FOR 1ST LEVEL CHARACTERS",
                TitleUa = "ВТРАЧЕНІ КОПАЛЬНІ ФАНДАЛВЕРА", TitleEn = "LOST MINES OF PHANDELVER",
                DescUa = "У цій вступній пригоді ви вирушаєте до маленького містечка Фандален, де лютують лиходії та монстри. Чи зможете ви розгадати таємницю втраченої копальні та захистити Фандален від лиха?",
                DescEn = "In this introductory adventure, you travel to the small town of Phandalin, where villains and monsters run rampant. Can you unravel the mystery of the lost mine and protect Phandalin from evil?",
                BtnUa = "ДОСЛІДИТИ ФАНДАЛВЕР", BtnEn = "EXPLORE PHANDELVER",
                LocationUa = "Узбережжя Мечів, Фандален", LocationEn = "Sword Coast, Phandalin",
                PartySize = "3–5 Players (Lvl 1-5)",
                DmNotesUa = "Ідеальна стартова пригода з гоблінами, стародавніми руїнами, зустрічами з драконом та магією забутих кузень.",
                DmNotesEn = "An ideal starter campaign packed with goblins, ancient ruins, dragon encounters, and forgotten forge magic.",
                HighlightsUa = "Засідка біля сховку Крагмо;Вулична сутичка з Червоними плащами;Дослідження Печери Хвильового Відлуння",
                HighlightsEn = "Cragmaw Hideout infiltration;Redbrand Ruffians street fight;Wave Echo Cave exploration",
            },
            new Campaign
            {
                Slug = "frozen-plague", SortOrder = 2,
                ImageKey = "soldiers_snow", BgPos = "top center",
                TagUa = "ДЛЯ ПЕРСОНАЖІВ 1–ГО РІВНЯ", TagEn = "FOR 1ST LEVEL CHARACTERS",
                TitleUa = "ЗАМЕРЗЛА ХВОРОБА", TitleEn = "FROZEN PLAGUE",
                DescUa = "Щось вбиває людей у селищі Пейнлбенк, і якщо ви не зупините це, наступними можете стати ви. Киньте виклик суворим арктичним землям Півночі, шукаючи ліки від цієї смертельної недуги.",
                DescEn = "Something is killing people in the village of Painlbend, and if you don't stop it, you could be next. Challenge the harsh arctic lands of the North, seeking a cure for this deadly plague.",
                BtnUa = "ДОСЛІДИТИ ЗАМЕРЗЛУ ХВОРОБУ", BtnEn = "EXPLORE FROZEN PLAGUE",
                LocationUa = "Вайлдмаунт, Селище Пейнлбенк", LocationEn = "Wildemount, Palebank Village",
                PartySize = "2–4 Players (Lvl 1-3)",
                DmNotesUa = "Розслідуйте смертельне прокляття, що заморожує жертв у синій лід. Суворе арктичне виживання та загадкові таємниці.",
                DmNotesEn = "Investigate a deadly curse encasing victims in blue ice. Deadly arctic survival and mystery investigation.",
                HighlightsUa = "Розслідування Замерзлої Скорботи;Експедиція до аванпосту Сірінля;Руїни еоріанської лабораторії",
                HighlightsEn = "Investigation of Frigid Woe;Syrinlya outpost expedition;Aeorian laboratory ruins",
            },
            new Campaign
            {
                Slug = "prisoner-13", SortOrder = 3,
                ImageKey = "blue_dragon", BgPos = "center",
                TagUa = "ДЛЯ ПЕРСОНАЖІВ 4–ГО РІВНЯ", TagEn = "FOR 4TH LEVEL CHARACTERS",
                TitleUa = "В'ЯЗЕНЬ 13", TitleEn = "PRISONER 13",
                DescUa = "Зануртесь у світ майбутнього фільму «Підземелля та дракони». Ваша місія: проникнути до в'язниці «Кінець Одкровення» та зустрітися з особливо небезпечним в'язнем.",
                DescEn = "Dive into the world of the upcoming Dungeons & Dragons movie. Your mission: infiltrate the prison \"Revel's End\" and meet a particularly dangerous prisoner.",
                BtnUa = "ДОСЛІДИТИ В'ЯЗЕНЬ 13", BtnEn = "EXPLORE PRISONER 13",
                LocationUa = "Море Рухомого Льоду, В’язниця Кінець Одкровення", LocationEn = "Sea of Moving Ice, Revel's End",
                PartySize = "4–6 Players (Lvl 4-6)",
                DmNotesUa = "Високоризиковане пограбування: проникнення в неприступну в’язницю на скелі та викрадення секретних шифрів.",
                DmNotesEn = "High-stakes heist campaign: infiltrate an impregnable cliffside panopticon prison and extract secret codes.",
                HighlightsUa = "Планування проникнення та маскування;Уникнення патрулів в’язниці;Злам сховища В’язня 13",
                HighlightsEn = "Infiltration & disguise planning;Prison guard patrol avoidance;Prisoner 13 vault robbery",
            }];
}
