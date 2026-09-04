# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ForeignAffairs.Api.csproj ./
RUN dotnet restore ForeignAffairs.Api.csproj
COPY . ./
RUN dotnet publish ForeignAffairs.Api.csproj -c Release -o /app /p:UseAppHost=false

# ---- Runtime stage ----
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=build /app ./
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
# Provide ConnectionStrings__Default / Database__Provider at run time.
ENTRYPOINT ["dotnet", "ForeignAffairs.Api.dll"]
