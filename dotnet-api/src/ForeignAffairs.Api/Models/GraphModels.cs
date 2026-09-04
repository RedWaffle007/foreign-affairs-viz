using System.Text.Json.Serialization;

namespace ForeignAffairs.Api.Models;

/// <summary>Full relations graph payload consumed by the React client.</summary>
public record GraphResponse
{
    [JsonPropertyName("nodes")]
    public required IReadOnlyList<GraphNode> Nodes { get; init; }

    [JsonPropertyName("links")]
    public required IReadOnlyList<GraphLink> Links { get; init; }

    [JsonPropertyName("coalitions")]
    public required IReadOnlyDictionary<string, Coalition> Coalitions { get; init; }

    [JsonPropertyName("status")]
    public required string Status { get; init; }
}

public record GraphNode
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("country")]
    public required string Country { get; init; }

    [JsonPropertyName("event_count")]
    public int EventCount { get; init; }

    [JsonPropertyName("avg_sentiment")]
    public double AvgSentiment { get; init; }

    [JsonPropertyName("coalitions")]
    public required IReadOnlyList<string> Coalitions { get; init; }

    [JsonPropertyName("primary_coalition")]
    public string? PrimaryCoalition { get; init; }

    [JsonPropertyName("primary_color")]
    public required string PrimaryColor { get; init; }
}

public record GraphLink
{
    [JsonPropertyName("source")]
    public required string Source { get; init; }

    [JsonPropertyName("target")]
    public required string Target { get; init; }

    [JsonPropertyName("weight")]
    public int Weight { get; init; }

    [JsonPropertyName("event_count")]
    public int EventCount { get; init; }

    [JsonPropertyName("sentiment")]
    public double Sentiment { get; init; }

    [JsonPropertyName("sentiment_score")]
    public double SentimentScore { get; init; }

    [JsonPropertyName("event_breakdown")]
    public required IReadOnlyDictionary<string, int> EventBreakdown { get; init; }
}

public record Coalition
{
    [JsonPropertyName("color")]
    public required string Color { get; init; }

    [JsonPropertyName("description")]
    public required string Description { get; init; }

    [JsonPropertyName("members")]
    public required IReadOnlyList<string> Members { get; init; }
}
