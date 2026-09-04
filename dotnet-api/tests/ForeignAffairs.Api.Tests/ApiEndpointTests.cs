using System.Net;
using System.Net.Http.Json;
using ForeignAffairs.Api.Models;
using Xunit;

namespace ForeignAffairs.Api.Tests;

public class ApiEndpointTests : IClassFixture<TestWebAppFactory>
{
    private readonly HttpClient _client;

    public ApiEndpointTests(TestWebAppFactory factory) => _client = factory.CreateClient();

    [Fact]
    public async Task Health_reports_seeded_counts()
    {
        var health = await _client.GetFromJsonAsync<HealthResponse>("/api/health");
        Assert.NotNull(health);
        Assert.Equal("ok", health!.Status);
        Assert.Equal(3, health.Events);
        Assert.Equal(1, health.Relationships);
    }

    [Fact]
    public async Task Graph_aggregates_events_into_nodes_and_links()
    {
        var graph = await _client.GetFromJsonAsync<GraphResponse>("/api/graph");
        Assert.NotNull(graph);
        Assert.Equal("ready", graph!.Status);

        // US<->China events are canonicalised into one undirected link with weight 2.
        var usChina = Assert.Single(graph.Links, l =>
            (l.Source == "China" && l.Target == "United States") ||
            (l.Source == "United States" && l.Target == "China"));
        Assert.Equal(2, usChina.Weight);
        Assert.Equal(1, usChina.EventBreakdown["TRADE"]);
        Assert.Equal(1, usChina.EventBreakdown["CONFLICT"]);

        // Nodes carry coalition metadata.
        var china = Assert.Single(graph.Nodes, n => n.Id == "China");
        Assert.Contains("BRICS", china.Coalitions);
        Assert.Equal(4, graph.Nodes.Count); // US, China, India, Russia
        Assert.NotEmpty(graph.Coalitions);
    }

    [Fact]
    public async Task Countries_returns_sorted_distinct_names()
    {
        var countries = await _client.GetFromJsonAsync<CountriesResponse>("/api/countries");
        Assert.NotNull(countries);
        Assert.Equal(new[] { "China", "India", "Russia", "United States" }, countries!.Countries);
        Assert.Equal(4, countries.Count);
    }

    [Fact]
    public async Task Events_filters_by_country_and_respects_limit()
    {
        var all = await _client.GetFromJsonAsync<EventsResponse>("/api/events?limit=100");
        Assert.Equal(3, all!.Count);

        var china = await _client.GetFromJsonAsync<EventsResponse>("/api/events?country=China");
        Assert.Equal(2, china!.Count);
        Assert.All(china.Events, e => Assert.True(e.CountryA == "China" || e.CountryB == "China"));

        // Ordered newest-first.
        Assert.True(string.CompareOrdinal(china.Events[0].CreatedAt, china.Events[1].CreatedAt) >= 0);

        var limited = await _client.GetFromJsonAsync<EventsResponse>("/api/events?limit=1");
        Assert.Equal(1, limited!.Count);
    }

    [Fact]
    public async Task History_buckets_events_by_month()
    {
        var history = await _client.GetFromJsonAsync<CountryHistoryResponse>("/api/countries/China/history?months=60");
        Assert.NotNull(history);
        Assert.Equal("China", history!.Country);
        // Two China events, both in 2026-08.
        var aug = Assert.Single(history.History, p => p.Month == "2026-08");
        Assert.Equal(2, aug.Events);
    }

    [Fact]
    public async Task Refresh_without_python_service_returns_503()
    {
        var resp = await _client.PostAsync("/api/refresh", content: null);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, resp.StatusCode);
    }

    [Fact]
    public async Task Swagger_document_is_served()
    {
        var resp = await _client.GetAsync("/swagger/v1/swagger.json");
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadAsStringAsync();
        Assert.Contains("/api/graph", body);
    }
}
