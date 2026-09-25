using System.ComponentModel.DataAnnotations;

namespace DndForum.Models;

public class CharacterPreset
{
    public int Id { get; set; }

    [Required, MaxLength(64)]
    public string Slug { get; set; } = "";

    [Required, MaxLength(120)] public string NameUa { get; set; } = "";
    [Required, MaxLength(120)] public string NameEn { get; set; } = "";
    [MaxLength(64)] public string ClassUa { get; set; } = "";
    [MaxLength(64)] public string ClassEn { get; set; } = "";
    [MaxLength(64)] public string RaceUa { get; set; } = "";
    [MaxLength(64)] public string RaceEn { get; set; } = "";

    public int Level { get; set; } = 1;

    [MaxLength(600)] public string DescUa { get; set; } = "";
    [MaxLength(600)] public string DescEn { get; set; } = "";

    [Required, MaxLength(64)] public string AvatarKey { get; set; } = "";
    [MaxLength(64)] public string BgKey { get; set; } = "";

    public int Str { get; set; } = 10;
    public int Dex { get; set; } = 10;
    public int Con { get; set; } = 10;
    public int Int { get; set; } = 10;
    public int Wis { get; set; } = 10;
    public int Cha { get; set; } = 10;

    [MaxLength(500)] public string SpellsUa { get; set; } = "";
    [MaxLength(500)] public string SpellsEn { get; set; } = "";

    public int SortOrder { get; set; }
}

public class RuleCard
{
    public int Id { get; set; }

    [Required, MaxLength(64)] public string Slug { get; set; } = "";

    [Required, MaxLength(16)] public string Section { get; set; } = "rule";

    [Required, MaxLength(200)] public string TitleUa { get; set; } = "";
    [Required, MaxLength(200)] public string TitleEn { get; set; } = "";
    [MaxLength(1200)] public string DescUa { get; set; } = "";
    [MaxLength(1200)] public string DescEn { get; set; } = "";

    [Required, MaxLength(64)] public string ImageKey { get; set; } = "";

    [MaxLength(200)] public string Alt { get; set; } = "";

    public int SortOrder { get; set; }
}

public class Campaign
{
    public int Id { get; set; }

    [Required, MaxLength(64)] public string Slug { get; set; } = "";

    [Required, MaxLength(200)] public string TitleUa { get; set; } = "";
    [Required, MaxLength(200)] public string TitleEn { get; set; } = "";
    [MaxLength(1200)] public string DescUa { get; set; } = "";
    [MaxLength(1200)] public string DescEn { get; set; } = "";

    [MaxLength(120)] public string BtnUa { get; set; } = "";
    [MaxLength(120)] public string BtnEn { get; set; } = "";

    [MaxLength(120)] public string TagUa { get; set; } = "";
    [MaxLength(120)] public string TagEn { get; set; } = "";

    [Required, MaxLength(64)] public string ImageKey { get; set; } = "";
    [MaxLength(32)] public string BgPos { get; set; } = "center";

    [MaxLength(200)] public string LocationUa { get; set; } = "";
    [MaxLength(200)] public string LocationEn { get; set; } = "";
    [MaxLength(64)] public string PartySize { get; set; } = "";
    [MaxLength(1000)] public string DmNotesUa { get; set; } = "";
    [MaxLength(1000)] public string DmNotesEn { get; set; } = "";

    [MaxLength(800)] public string HighlightsUa { get; set; } = "";
    [MaxLength(800)] public string HighlightsEn { get; set; } = "";

    public int SortOrder { get; set; }
}
