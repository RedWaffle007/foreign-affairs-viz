using ForeignAffairs.Api.Data;
using ForeignAffairs.Api.Models;
using ForeignAffairs.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------------------
// Configuration & logging
// ---------------------------------------------------------------------------
// Secrets/connection strings come from configuration (appsettings + environment
// variables + user-secrets), never from source. Environment variables use the
// standard ASP.NET Core "__" separator, e.g. ConnectionStrings__Default.
builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole(o =>
{
    o.SingleLine = true;
    o.TimestampFormat = "yyyy-MM-dd HH:mm:ss ";
});

// ---------------------------------------------------------------------------
// Database provider switch (SQLite by default, PostgreSQL opt-in)
// ---------------------------------------------------------------------------
var provider = builder.Configuration.GetValue<string>("Database:Provider") ?? "Sqlite";
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? "Data Source=foreign_affairs.db";

builder.Services.AddDbContext<AppDbContext>(options =>
{
    if (string.Equals(provider, "Postgres", StringComparison.OrdinalIgnoreCase)
        || string.Equals(provider, "PostgreSQL", StringComparison.OrdinalIgnoreCase))
    {
        options.UseNpgsql(connectionString);
    }
    else
    {
        options.UseSqlite(connectionString);
    }
});

builder.Services.AddScoped<GraphBuilder>();

// Typed HttpClient used to proxy the write-side /api/refresh to the Python
// ingestion service (service-to-service communication).
builder.Services.AddHttpClient("python", (sp, client) =>
{
    var cfg = sp.GetRequiredService<IConfiguration>();
    var baseUrl = cfg.GetValue<string>("PythonService:BaseUrl");
    if (!string.IsNullOrWhiteSpace(baseUrl))
        client.BaseAddress = new Uri(baseUrl);
    client.Timeout = TimeSpan.FromMinutes(5);
});

// CORS for the Vite dev server.
const string CorsPolicy = "frontend";
builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
            ?? new[] { "http://localhost:5173", "http://127.0.0.1:5173" };
        policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod();
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(o =>
{
    o.SwaggerDoc("v1", new()
    {
        Title = "AI Foreign Affairs Visualization API (.NET)",
        Version = "v1",
        Description = "Typed ASP.NET Core read API over the Foreign Affairs Viz database. "
                    + "The Python service remains the ingestion/NLP writer; this service is the query layer consumed by React.",
    });
});

builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

// Swagger is always on so the API is self-documenting in every environment.
app.UseSwagger();
app.UseSwaggerUI(o => o.SwaggerEndpoint("/swagger/v1/swagger.json", "Foreign Affairs API v1"));

app.UseCors(CorsPolicy);

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

app.MapGet("/api/graph", async (GraphBuilder builder, CancellationToken ct) =>
    Results.Ok(await builder.BuildAsync(ct)))
    .WithName("GetGraph")
    .WithSummary("Full current relations graph (nodes, links, coalitions).")
    .Produces<GraphResponse>();

app.MapGet("/api/countries", async (AppDbContext db, CancellationToken ct) =>
{
    var a = await db.RelationshipEvents.Select(e => e.CountryA).Distinct().ToListAsync(ct);
    var b = await db.RelationshipEvents.Select(e => e.CountryB).Distinct().ToListAsync(ct);
    var names = a.Concat(b)
        .Where(n => !string.IsNullOrEmpty(n))
        .Select(n => n!)
        .Distinct()
        .OrderBy(n => n, StringComparer.Ordinal)
        .ToList();
    return Results.Ok(new CountriesResponse { Countries = names, Count = names.Count });
})
    .WithName("GetCountries")
    .Produces<CountriesResponse>();

app.MapGet("/api/countries/{name}/history", async (
    string name,
    AppDbContext db,
    int months,
    CancellationToken ct) =>
{
    if (months < 1) months = 1;
    if (months > 60) months = 60;
    var cutoff = DateTime.UtcNow.AddDays(-30 * months);

    var rows = await db.RelationshipEvents.AsNoTracking()
        .Where(e => (e.CountryA == name || e.CountryB == name) && e.CreatedAt >= cutoff)
        .Select(e => new { e.CreatedAt, e.SentimentScore })
        .ToListAsync(ct);

    var history = rows
        .Where(r => r.CreatedAt.HasValue)
        .GroupBy(r => r.CreatedAt!.Value.ToString("yyyy-MM"))
        .OrderBy(g => g.Key, StringComparer.Ordinal)
        .Select(g => new HistoryPoint
        {
            Month = g.Key,
            Score = Math.Round(g.Average(x => x.SentimentScore ?? 0.0), 3),
            Events = g.Count(),
        })
        .ToList();

    return Results.Ok(new CountryHistoryResponse { Country = name, History = history });
})
    .WithName("GetCountryHistory")
    .Produces<CountryHistoryResponse>();

app.MapGet("/api/events", async (
    AppDbContext db,
    string? country,
    int? limit,
    CancellationToken ct) =>
{
    var take = limit ?? 20;
    if (take < 1) take = 1;
    if (take > 100) take = 100;

    var query = db.RelationshipEvents.AsNoTracking().AsQueryable();
    if (!string.IsNullOrEmpty(country))
        query = query.Where(e => e.CountryA == country || e.CountryB == country);

    var rows = await query
        .OrderByDescending(e => e.CreatedAt)
        .Take(take)
        .ToListAsync(ct);

    var events = rows.Select(ev => new EventDto
    {
        Id = ev.Id,
        CountryA = ev.CountryA,
        CountryB = ev.CountryB,
        EventType = ev.EventType,
        SentimentScore = Math.Round(ev.SentimentScore ?? 0.0, 3),
        Summary = ev.Summary,
        CreatedAt = IsoFormat(ev.CreatedAt),
    }).ToList();

    return Results.Ok(new EventsResponse { Events = events, Count = events.Count });
})
    .WithName("GetEvents")
    .Produces<EventsResponse>();

app.MapGet("/api/health", async (AppDbContext db, CancellationToken ct) =>
{
    var events = await db.RelationshipEvents.CountAsync(ct);
    var rels = await db.CountryRelationships.CountAsync(ct);
    return Results.Ok(new HealthResponse { Status = "ok", Events = events, Relationships = rels });
})
    .WithName("GetHealth")
    .Produces<HealthResponse>();

// Write-side refresh is owned by the Python ingestion service. This endpoint
// proxies to it so the existing React "Refresh" button keeps working against
// the .NET base URL. Returns 503 with a clear message when unconfigured.
app.MapPost("/api/refresh", async (IHttpClientFactory factory, IConfiguration cfg, ILogger<Program> log, CancellationToken ct) =>
{
    var baseUrl = cfg.GetValue<string>("PythonService:BaseUrl");
    if (string.IsNullOrWhiteSpace(baseUrl))
    {
        return Results.Problem(
            title: "Refresh unavailable",
            detail: "Ingestion is owned by the Python service. Set PythonService:BaseUrl to enable proxying /api/refresh.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    try
    {
        var client = factory.CreateClient("python");
        using var resp = await client.PostAsync("/api/refresh", content: null, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);
        return Results.Content(body, "application/json", statusCode: (int)resp.StatusCode);
    }
    catch (Exception ex)
    {
        log.LogError(ex, "Proxying /api/refresh to the Python service failed");
        return Results.Problem(
            title: "Refresh failed",
            detail: "Could not reach the Python ingestion service.",
            statusCode: StatusCodes.Status502BadGateway);
    }
})
    .WithName("Refresh");

app.Run();

// Mimic Python's datetime.isoformat(): omit fractional seconds when zero.
static string? IsoFormat(DateTime? dt)
{
    if (dt is null) return null;
    var d = dt.Value;
    return d.Millisecond == 0 && d.Ticks % TimeSpan.TicksPerSecond == 0
        ? d.ToString("yyyy-MM-ddTHH:mm:ss")
        : d.ToString("yyyy-MM-ddTHH:mm:ss.ffffff");
}

// Exposed so the integration-test WebApplicationFactory can boot the app.
public partial class Program { }
