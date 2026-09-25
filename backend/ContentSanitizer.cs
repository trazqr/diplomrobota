using System.Text;
using Ganss.Xss;

namespace DndForum;

public static class ContentSanitizer
{
    private static readonly HtmlSanitizer Sanitizer = CreateSanitizer();

    private static HtmlSanitizer CreateSanitizer()
    {
        var s = new HtmlSanitizer();

        s.AllowedTags.Clear();
        foreach (var tag in new[]
        {
            "p", "br", "hr",
            "h2", "h3", "h4",
            "strong", "b", "em", "i", "u", "s", "mark",
            "ul", "ol", "li",
            "blockquote", "code", "pre",
            "a", "figure", "figcaption",
            "table", "thead", "tbody", "tr", "th", "td",
            "span", "div",
        }) s.AllowedTags.Add(tag);

        s.AllowedAttributes.Clear();

        foreach (var attr in new[] { "href", "title", "class", "style", "colspan", "rowspan" })
            s.AllowedAttributes.Add(attr);

        s.AllowedCssProperties.Clear();
        foreach (var prop in new[] { "color", "background-color", "text-align", "font-style", "font-weight", "text-decoration" })
            s.AllowedCssProperties.Add(prop);

        s.AllowedSchemes.Clear();
        s.AllowedSchemes.Add("http");
        s.AllowedSchemes.Add("https");
        s.AllowedSchemes.Add("mailto");

        s.AllowDataAttributes = false;

        s.PostProcessNode += (_, e) =>
        {
            if (e.Node is AngleSharp.Html.Dom.IHtmlAnchorElement a && !string.IsNullOrEmpty(a.GetAttribute("href")))
            {
                a.SetAttribute("target", "_blank");
                a.SetAttribute("rel", "noopener noreferrer nofollow");
            }
        };

        return s;
    }

    public static string SanitizeHtml(string? html) =>
        string.IsNullOrWhiteSpace(html) ? "" : Sanitizer.Sanitize(html);

    public static string MarkdownToHtml(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return "";

        var sb = new StringBuilder();
        foreach (var block in text.Replace("\r\n", "\n").Split("\n\n", StringSplitOptions.RemoveEmptyEntries))
        {
            var escaped = System.Net.WebUtility.HtmlEncode(block.Trim());
            escaped = System.Text.RegularExpressions.Regex.Replace(
                escaped, @"\*\*(.+?)\*\*", "<strong>$1</strong>",
                System.Text.RegularExpressions.RegexOptions.Singleline);
            escaped = escaped.Replace("\n", "<br />");
            sb.Append("<p>").Append(escaped).Append("</p>");
        }
        return sb.ToString();
    }

    public static string ToSafeHtml(string? content, string? format) =>
        format == "html" ? SanitizeHtml(content) : MarkdownToHtml(content);

    public static bool IsSafeImageReference(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return true;

        var candidate = value.Trim();

        if (candidate.Any(char.IsControl)) return false;

        if (candidate.StartsWith("site:", StringComparison.Ordinal))
            return IsSiteImageKey(candidate[5..]);

        if (!candidate.Contains(':'))
            return IsSiteImageKey(candidate);

        return IsRasterDataImage(candidate);
    }

    public static string SafeImageReferenceOrEmpty(string? value) =>
        IsSafeImageReference(value) ? value?.Trim() ?? "" : "";

    private static bool IsSiteImageKey(string key) =>
        key.Length is > 0 and <= 64
        && key.All(character =>
            character is >= 'a' and <= 'z'
            or >= '0' and <= '9'
            or '_' or '-');

    private static bool IsRasterDataImage(string value)
    {
        string[] prefixes =
        [
            "data:image/png;base64,",
            "data:image/jpeg;base64,",
            "data:image/gif;base64,",
            "data:image/webp;base64,",
        ];

        var prefix = prefixes.FirstOrDefault(value.StartsWith);
        if (prefix is null) return false;

        var payload = value.AsSpan(prefix.Length);
        if (payload.Length == 0 || payload.Length % 4 != 0) return false;

        foreach (var character in payload)
            if (!char.IsAsciiLetterOrDigit(character)
                && character is not ('+' or '/' or '='))
                return false;

        return true;
    }

    public static string Excerpt(string? html, int length = 200)
    {
        if (string.IsNullOrWhiteSpace(html)) return "";
        var text = System.Text.RegularExpressions.Regex.Replace(html, "<.*?>", " ");
        text = System.Net.WebUtility.HtmlDecode(text);
        text = System.Text.RegularExpressions.Regex.Replace(text, @"\s+", " ").Trim();
        return text.Length <= length ? text : text[..length].TrimEnd() + "…";
    }
}
