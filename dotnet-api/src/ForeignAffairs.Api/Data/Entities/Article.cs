namespace ForeignAffairs.Api.Data.Entities;

/// <summary>
/// A collected foreign-affairs news article. Mirrors the <c>articles</c> table
/// produced by the existing Python ingestion pipeline.
/// </summary>
public class Article
{
    public int Id { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? Url { get; set; }
    public DateTime? PublishedAt { get; set; }
    public string? Source { get; set; }
    public string? RawText { get; set; }

    public List<RelationshipEvent> Events { get; set; } = new();
}
