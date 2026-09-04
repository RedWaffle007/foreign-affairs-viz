using ForeignAffairs.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace ForeignAffairs.Api.Data;

/// <summary>
/// EF Core context mapped onto the schema created by the Python ingestion
/// service. Table and column names are pinned to snake_case so the .NET read
/// API and the Python writer can share the exact same database file/instance.
/// </summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Article> Articles => Set<Article>();
    public DbSet<RelationshipEvent> RelationshipEvents => Set<RelationshipEvent>();
    public DbSet<CountryRelationship> CountryRelationships => Set<CountryRelationship>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Article>(e =>
        {
            e.ToTable("articles");
            e.HasKey(a => a.Id);
            e.Property(a => a.Id).HasColumnName("id");
            e.Property(a => a.Title).HasColumnName("title");
            e.Property(a => a.Description).HasColumnName("description");
            e.Property(a => a.Url).HasColumnName("url");
            e.Property(a => a.PublishedAt).HasColumnName("published_at");
            e.Property(a => a.Source).HasColumnName("source");
            e.Property(a => a.RawText).HasColumnName("raw_text");
            e.HasIndex(a => a.Url).IsUnique();
        });

        modelBuilder.Entity<RelationshipEvent>(e =>
        {
            e.ToTable("relationship_events");
            e.HasKey(r => r.Id);
            e.Property(r => r.Id).HasColumnName("id");
            e.Property(r => r.CountryA).HasColumnName("country_a");
            e.Property(r => r.CountryB).HasColumnName("country_b");
            e.Property(r => r.EventType).HasColumnName("event_type");
            e.Property(r => r.SentimentScore).HasColumnName("sentiment_score");
            e.Property(r => r.Summary).HasColumnName("summary");
            e.Property(r => r.ArticleId).HasColumnName("article_id");
            e.Property(r => r.CreatedAt).HasColumnName("created_at");
            e.HasOne(r => r.Article)
                .WithMany(a => a.Events)
                .HasForeignKey(r => r.ArticleId);
            e.HasIndex(r => r.CountryA);
            e.HasIndex(r => r.CountryB);
            e.HasIndex(r => r.EventType);
            e.HasIndex(r => r.CreatedAt);
        });

        modelBuilder.Entity<CountryRelationship>(e =>
        {
            e.ToTable("country_relationships");
            e.HasKey(c => c.Id);
            e.Property(c => c.Id).HasColumnName("id");
            e.Property(c => c.CountryA).HasColumnName("country_a");
            e.Property(c => c.CountryB).HasColumnName("country_b");
            e.Property(c => c.CurrentScore).HasColumnName("current_score");
            e.Property(c => c.LastUpdated).HasColumnName("last_updated");
            e.Property(c => c.EventCount).HasColumnName("event_count");
        });
    }
}
