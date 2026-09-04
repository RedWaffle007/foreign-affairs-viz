using ForeignAffairs.Api.Models;

namespace ForeignAffairs.Api.Services;

/// <summary>
/// Static coalition membership, mirroring <c>graph_builder.COALITIONS</c> in the
/// Python service. Insertion order is preserved so a country's "primary"
/// coalition matches the Python output exactly.
/// </summary>
public static class CoalitionRegistry
{
    /// <summary>Ordered coalition definitions.</summary>
    public static readonly IReadOnlyList<KeyValuePair<string, Coalition>> Ordered = new List<KeyValuePair<string, Coalition>>
    {
        Make("NATO", "#3b82f6",
            "North Atlantic Treaty Organization — a military alliance of 32 North American and European nations committed to collective defense.",
            "United States", "United Kingdom", "Germany", "France", "Canada", "Italy", "Spain", "Poland", "Turkey", "Netherlands", "Belgium", "Norway", "Denmark", "Portugal", "Greece", "Czech Republic", "Romania", "Hungary", "Bulgaria", "Slovakia", "Slovenia", "Croatia", "Albania", "Montenegro", "North Macedonia", "Estonia", "Latvia", "Lithuania", "Luxembourg", "Iceland", "Finland", "Sweden"),
        Make("BRICS", "#f97316",
            "An intergovernmental organization of major emerging economies including Brazil, Russia, India, China, South Africa and new members.",
            "Brazil", "Russia", "India", "China", "South Africa", "Iran", "Egypt", "Ethiopia", "United Arab Emirates", "Saudi Arabia", "Argentina"),
        Make("SCO", "#a855f7",
            "Shanghai Cooperation Organisation — a Eurasian political, economic, and security organization.",
            "China", "Russia", "India", "Pakistan", "Kazakhstan", "Uzbekistan", "Kyrgyzstan", "Tajikistan", "Iran", "Belarus"),
        Make("GCC", "#eab308",
            "Gulf Cooperation Council — a regional intergovernmental political and economic union of Arab Gulf states.",
            "Saudi Arabia", "United Arab Emirates", "Qatar", "Kuwait", "Bahrain", "Oman"),
        Make("ASEAN", "#22c55e",
            "Association of Southeast Asian Nations — promoting economic growth, social progress and regional stability.",
            "Indonesia", "Malaysia", "Philippines", "Singapore", "Thailand", "Vietnam", "Myanmar", "Cambodia", "Laos", "Brunei"),
        Make("African Union", "#f59e0b",
            "A continental body of 55 African member states focused on promoting unity, peace and development across Africa.",
            "Nigeria", "South Africa", "Ethiopia", "Egypt", "Kenya", "Ghana", "Tanzania", "Algeria", "Morocco", "Senegal"),
        Make("Quad", "#06b6d4",
            "Quadrilateral Security Dialogue — an informal strategic forum between the United States, India, Japan and Australia.",
            "United States", "India", "Japan", "Australia"),
        Make("EU", "#6366f1",
            "European Union — a political and economic union of 27 European countries with a single market and shared policies.",
            "Germany", "France", "Italy", "Spain", "Poland", "Netherlands", "Belgium", "Sweden", "Austria", "Denmark", "Finland", "Ireland", "Portugal", "Czech Republic", "Romania", "Hungary", "Bulgaria", "Slovakia", "Slovenia", "Croatia", "Estonia", "Latvia", "Lithuania", "Luxembourg", "Malta", "Cyprus", "Greece"),
        Make("Arab League", "#84cc16",
            "A regional organization of Arab states in and around North Africa, the Horn of Africa and Arabia.",
            "Saudi Arabia", "Egypt", "Iraq", "Jordan", "Lebanon", "Syria", "Yemen", "Libya", "Tunisia", "Algeria", "Morocco", "Sudan", "Kuwait", "United Arab Emirates", "Qatar", "Bahrain", "Oman"),
    };

    /// <summary>Coalition name -> definition, in insertion order.</summary>
    public static readonly IReadOnlyDictionary<string, Coalition> All =
        Ordered.ToDictionary(kv => kv.Key, kv => kv.Value);

    private static readonly Dictionary<string, List<string>> CountryToCoalitions = BuildReverseIndex();

    private const string DefaultColor = "#94a3b8";

    /// <summary>Coalitions a country belongs to, in coalition-declaration order.</summary>
    public static IReadOnlyList<string> CoalitionsFor(string country) =>
        CountryToCoalitions.TryGetValue(country, out var list) ? list : Array.Empty<string>();

    public static string PrimaryColor(string? primaryCoalition) =>
        primaryCoalition is not null && All.TryGetValue(primaryCoalition, out var c) ? c.Color : DefaultColor;

    private static KeyValuePair<string, Coalition> Make(string name, string color, string description, params string[] members) =>
        new(name, new Coalition { Color = color, Description = description, Members = members });

    private static Dictionary<string, List<string>> BuildReverseIndex()
    {
        var index = new Dictionary<string, List<string>>();
        foreach (var (name, coalition) in Ordered)
        {
            foreach (var member in coalition.Members)
            {
                if (!index.TryGetValue(member, out var list))
                {
                    list = new List<string>();
                    index[member] = list;
                }
                list.Add(name);
            }
        }
        return index;
    }
}
