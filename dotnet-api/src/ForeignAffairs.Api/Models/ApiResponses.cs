using System.Text.Json.Serialization;

namespace ForeignAffairs.Api.Models;

public record CountriesResponse
{
    [JsonPropertyName("countries")]
    public required IReadOnlyList<string> Countries { get; init; }

    [JsonPropertyName("count")]
    public int Count { get; init; }
}

public record HistoryPoint
{
    [JsonPropertyName("month")]
    public required string Month { get; init; }

    [JsonPropertyName("score")]
    public double Score { get; init; }

    [JsonPropertyName("events")]
    public int Events { get; init; }
}

public record CountryHistoryResponse
{
    [JsonPropertyName("country")]
    public required string Country { get; init; }

    [JsonPropertyName("history")]
    public required IReadOnlyList<HistoryPoint> History { get; init; }
}

public record EventDto
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("country_a")]
    public string? CountryA { get; init; }

    [JsonPropertyName("country_b")]
    public string? CountryB { get; init; }

    [JsonPropertyName("event_type")]
    public string? EventType { get; init; }

    [JsonPropertyName("sentiment_score")]
    public double SentimentScore { get; init; }

    [JsonPropertyName("summary")]
    public string? Summary { get; init; }

    [JsonPropertyName("created_at")]
    public string? CreatedAt { get; init; }
}

public record EventsResponse
{
    [JsonPropertyName("events")]
    public required IReadOnlyList<EventDto> Events { get; init; }

    [JsonPropertyName("count")]
    public int Count { get; init; }
}

public record HealthResponse
{
    [JsonPropertyName("status")]
    public required string Status { get; init; }

    [JsonPropertyName("events")]
    public int Events { get; init; }

    [JsonPropertyName("relationships")]
    public int Relationships { get; init; }
}
