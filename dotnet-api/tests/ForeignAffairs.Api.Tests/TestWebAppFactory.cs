using ForeignAffairs.Api.Data;
using ForeignAffairs.Api.Data.Entities;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace ForeignAffairs.Api.Tests;

/// <summary>
/// Boots the real application against an isolated in-memory SQLite database that
/// is seeded with deterministic fixture data. The connection is held open for
/// the lifetime of the factory so the in-memory database survives between
/// requests.
/// </summary>
public class TestWebAppFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        _connection.Open();

        builder.ConfigureServices(services =>
        {
            // Replace the app's DbContext registration with the shared in-memory one.
            var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<AppDbContext>));
            if (descriptor is not null) services.Remove(descriptor);

            services.AddDbContext<AppDbContext>(o => o.UseSqlite(_connection));

            using var scope = services.BuildServiceProvider().CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Database.EnsureCreated();
            Seed(db);
        });
    }

    private static void Seed(AppDbContext db)
    {
        if (db.RelationshipEvents.Any()) return;

        var article = new Article
        {
            Title = "Fixture article",
            Url = "https://example.com/fixture",
            Source = "test",
            PublishedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Unspecified),
        };
        db.Articles.Add(article);
        db.SaveChanges();

        db.RelationshipEvents.AddRange(
            new RelationshipEvent
            {
                CountryA = "United States", CountryB = "China", EventType = "TRADE",
                SentimentScore = 0.5, Summary = "Trade deal", ArticleId = article.Id,
                CreatedAt = new DateTime(2026, 8, 1, 12, 0, 0, DateTimeKind.Unspecified),
            },
            new RelationshipEvent
            {
                CountryA = "China", CountryB = "United States", EventType = "CONFLICT",
                SentimentScore = -0.9, Summary = "Tariff dispute", ArticleId = article.Id,
                CreatedAt = new DateTime(2026, 8, 15, 12, 0, 0, DateTimeKind.Unspecified),
            },
            new RelationshipEvent
            {
                CountryA = "India", CountryB = "Russia", EventType = "DIPLOMACY",
                SentimentScore = 0.3, Summary = "Summit", ArticleId = article.Id,
                CreatedAt = new DateTime(2026, 7, 10, 12, 0, 0, DateTimeKind.Unspecified),
            });

        db.CountryRelationships.Add(new CountryRelationship
        {
            CountryA = "China", CountryB = "United States", CurrentScore = -0.2,
            EventCount = 2, LastUpdated = new DateTime(2026, 8, 15, 12, 0, 0, DateTimeKind.Unspecified),
        });

        db.SaveChanges();
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing) _connection.Dispose();
    }
}
