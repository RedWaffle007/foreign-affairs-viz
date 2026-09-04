namespace ForeignAffairs.Api.Data.Entities;

/// <summary>
/// A single classified relationship event between two countries, derived from an
/// article. Mirrors the <c>relationship_events</c> table.
/// </summary>
public class RelationshipEvent
{
    public int Id { get; set; }
    public string? CountryA { get; set; }
    public string? CountryB { get; set; }

    /// <summary>TRADE / DIPLOMACY / CONFLICT / OTHER.</summary>
    public string? EventType { get; set; }

    /// <summary>Sentiment score in the range -1.0 .. 1.0.</summary>
    public double? SentimentScore { get; set; }

    public string? Summary { get; set; }
    public int? ArticleId { get; set; }
    public DateTime? CreatedAt { get; set; }

    public Article? Article { get; set; }
}
