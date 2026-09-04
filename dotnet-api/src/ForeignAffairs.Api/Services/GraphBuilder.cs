using ForeignAffairs.Api.Data;
using ForeignAffairs.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace ForeignAffairs.Api.Services;

/// <summary>
/// Builds the nodes/links/coalitions graph from stored relationship events.
/// Port of the Python <c>graph_builder.build_graph</c>. Aggregation runs
/// in-memory because the event set is small and this keeps the logic identical
/// across the SQLite and PostgreSQL providers.
/// </summary>
public class GraphBuilder
{
    private readonly AppDbContext _db;

    public GraphBuilder(AppDbContext db) => _db = db;

    /// <summary>Return a canonical (ordinally sorted) ordering for a country pair.</summary>
    public static (string, string) PairKey(string a, string b) =>
        string.CompareOrdinal(a, b) <= 0 ? (a, b) : (b, a);

    public async Task<GraphResponse> BuildAsync(CancellationToken ct = default)
    {
        var events = await _db.RelationshipEvents.AsNoTracking().ToListAsync(ct);

        var nodeEventCount = new Dictionary<string, int>();
        var nodeSentimentSum = new Dictionary<string, double>();

        var linkWeight = new Dictionary<(string, string), int>();
        var linkSentimentSum = new Dictionary<(string, string), double>();
        var linkBreakdown = new Dictionary<(string, string), Dictionary<string, int>>();

        foreach (var ev in events)
        {
            if (string.IsNullOrEmpty(ev.CountryA) || string.IsNullOrEmpty(ev.CountryB))
                continue;

            var key = PairKey(ev.CountryA, ev.CountryB);
            var sentiment = ev.SentimentScore ?? 0.0;

            linkWeight[key] = linkWeight.GetValueOrDefault(key) + 1;
            linkSentimentSum[key] = linkSentimentSum.GetValueOrDefault(key) + sentiment;

            if (!linkBreakdown.TryGetValue(key, out var breakdown))
            {
                breakdown = new Dictionary<string, int>
                {
                    ["TRADE"] = 0,
                    ["DIPLOMACY"] = 0,
                    ["CONFLICT"] = 0,
                    ["OTHER"] = 0,
                };
                linkBreakdown[key] = breakdown;
            }
            var etype = ev.EventType is not null && breakdown.ContainsKey(ev.EventType) ? ev.EventType : "OTHER";
            breakdown[etype] += 1;

            foreach (var country in new[] { key.Item1, key.Item2 })
            {
                nodeEventCount[country] = nodeEventCount.GetValueOrDefault(country) + 1;
                nodeSentimentSum[country] = nodeSentimentSum.GetValueOrDefault(country) + sentiment;
            }
        }

        var nodes = new List<GraphNode>();
        foreach (var (country, count) in nodeEventCount)
        {
            var memberOf = CoalitionRegistry.CoalitionsFor(country);
            var primary = memberOf.Count > 0 ? memberOf[0] : null;
            nodes.Add(new GraphNode
            {
                Id = country,
                Country = country,
                EventCount = count,
                AvgSentiment = count > 0 ? Math.Round(nodeSentimentSum[country] / count, 3) : 0.0,
                Coalitions = memberOf,
                PrimaryCoalition = primary,
                PrimaryColor = CoalitionRegistry.PrimaryColor(primary),
            });
        }

        var links = new List<GraphLink>();
        foreach (var ((a, b), weight) in linkWeight)
        {
            var avg = weight > 0 ? Math.Round(linkSentimentSum[(a, b)] / weight, 3) : 0.0;
            links.Add(new GraphLink
            {
                Source = a,
                Target = b,
                Weight = weight,
                EventCount = weight,
                Sentiment = avg,
                SentimentScore = avg,
                EventBreakdown = linkBreakdown[(a, b)],
            });
        }

        return new GraphResponse
        {
            Nodes = nodes,
            Links = links,
            Coalitions = CoalitionRegistry.All,
            Status = nodes.Count > 0 ? "ready" : "empty",
        };
    }
}
