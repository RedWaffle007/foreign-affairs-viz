namespace ForeignAffairs.Api.Data.Entities;

/// <summary>
/// Aggregate, current-state relationship between a canonical country pair.
/// Mirrors the <c>country_relationships</c> table.
/// </summary>
public class CountryRelationship
{
    public int Id { get; set; }
    public string? CountryA { get; set; }
    public string? CountryB { get; set; }
    public double CurrentScore { get; set; }
    public DateTime? LastUpdated { get; set; }
    public int EventCount { get; set; }
}
