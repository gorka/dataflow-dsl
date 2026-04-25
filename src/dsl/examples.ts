export type Tier = 'Simple' | 'Moderate' | 'Advanced';

export interface Example {
  name: string;
  tier: Tier;
  code: string;
}

const REST_COUNTRIES_PIPELINE = `source("countries", {
  endpoint: "https://restcountries.com/v3.1/region/europe",
  method: "GET"
});

filter("large", "countries", "population > 10000000");

select("result", "large", ["name.common", "capital", "population"]);`;

const OPEN_METEO_PIPELINE = `source("weather", {
  endpoint: "https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
  method: "GET"
});

select("current", "weather", ["current.temperature_2m", "current.relative_humidity_2m", "current.wind_speed_10m", "current.weather_code"]);

map("result", "current", { tempC: "temperature_2m", humidity: "relative_humidity_2m", windKmh: "wind_speed_10m", weatherCode: "weather_code" });`;

const DND_PIPELINE = `source("dragon", {
  endpoint: "https://www.dnd5eapi.co/api/2014/monsters/adult-red-dragon",
  method: "GET"
});

select("stats", "dragon", ["name", "size", "hit_points", "challenge_rating", "strength", "dexterity", "constitution"]);

map("result", "stats", { monster: "name", size: "size", hp: "hit_points", cr: "challenge_rating", str: "strength", dex: "dexterity", con: "constitution" });`;

const RICK_AND_MORTY_PIPELINE = `source("character", {
  endpoint: "https://rickandmortyapi.com/api/character/1",
  method: "GET"
});

source("location", {
  endpoint: "{url}",
  params: { url: ref("character", "location.url") }
});

select("charInfo", "character", ["name", "status", "species", "gender"]);

select("locationInfo", "location", ["name", "type", "dimension"]);

join("result", "charInfo", "locationInfo", { as: "location" });`;

const POKEAPI_PIPELINE = `source("pokemon", {
  endpoint: "https://pokeapi.co/api/v2/pokemon/25",
  method: "GET"
});

source("species", {
  endpoint: "{url}",
  params: { url: ref("pokemon", "species.url") }
});

select("profile", "pokemon", ["name", "height", "weight", "base_experience"]);

map("speciesInfo", "species", { habitat: "habitat.name", generation: "generation.name", color: "color.name" });

join("result", "profile", "speciesInfo", { as: "species" });`;

const OPEN_LIBRARY_PIPELINE = `source("work", {
  endpoint: "https://openlibrary.org/works/OL45804W.json",
  method: "GET"
});

source("author", {
  endpoint: "https://openlibrary.org{authorPath}.json",
  params: { authorPath: ref("work", "authors.0.author.key") }
});

select("bookInfo", "work", ["title", "subjects"]);

select("authorInfo", "author", ["name", "birth_date", "death_date"]);

join("result", "bookInfo", "authorInfo", { as: "author" });`;

const ART_INSTITUTE_PIPELINE = `source("artwork", {
  endpoint: "https://api.artic.edu/api/v1/artworks/129884",
  method: "GET"
});

map("artworkData", "artwork", { "...": "data" });

source("artist", {
  endpoint: "https://api.artic.edu/api/v1/artists/{artistId}",
  params: { artistId: ref("artworkData", "artist_id") }
});

map("artistData", "artist", { "...": "data" });

select("artInfo", "artworkData", ["title", "date_display", "medium_display", "place_of_origin", "department_title"]);

select("artistInfo", "artistData", ["title", "birth_date", "death_date"]);

join("result", "artInfo", "artistInfo", { as: "artist" });`;

const SPACEX_PIPELINE = `source("launch", {
  endpoint: "https://api.spacexdata.com/v4/launches/latest",
  method: "GET"
});

source("rocket", {
  endpoint: "https://api.spacexdata.com/v4/rockets/{rocketId}",
  params: { rocketId: ref("launch", "rocket") }
});

source("launchpad", {
  endpoint: "https://api.spacexdata.com/v4/launchpads/{padId}",
  params: { padId: ref("launch", "launchpad") }
});

select("mission", "launch", ["name", "date_utc", "success", "details"]);

select("rocketInfo", "rocket", ["name", "description", "cost_per_launch", "success_rate_pct"]);

map("rocketCard", "rocketInfo", { rocketName: "name", description: "description", costUsd: "cost_per_launch", successRate: "success_rate_pct" });

select("padInfo", "launchpad", ["full_name", "locality", "region", "launch_successes", "launch_attempts"]);

join("withRocket", "mission", "rocketCard", { as: "rocket" });

join("result", "withRocket", "padInfo", { as: "launchpad" });`;

const SWAPI_PIPELINE = `source("person", {
  endpoint: "https://www.swapi.tech/api/people/{id}",
  method: "GET",
  params: { id: 1 }
});

map("personData", "person", { "...": "result.properties" });

source("films", {
  endpoint: "{url}",
  params: { url: ref("personData", "films") }
});

map("filmData", "films", { "...": "result.properties" });

source("homeworld", {
  endpoint: "{url}",
  params: { url: ref("personData", "homeworld") }
});

map("homeworldData", "homeworld", { "...": "result.properties" });

select("personInfo", "personData", ["name", "height", "mass", "birth_year"]);

select("filmDetails", "filmData", ["title", "director", "release_date"]);

filter("classicFilms", "filmDetails", "release_date < '1990-01-01'");

map("filmSummary", "classicFilms", { title: "title", directedBy: "director" });

join("withFilms", "personInfo", "filmSummary", { as: "films" });

join("result", "withFilms", "homeworldData", { as: "homeworld" });`;

const TVMAZE_PIPELINE = `source("show", {
  endpoint: "https://api.tvmaze.com/singlesearch/shows?q=the+office",
  method: "GET"
});

source("episodes", {
  endpoint: "https://api.tvmaze.com/shows/{id}/episodes",
  params: { id: ref("show", "id") }
});

source("cast", {
  endpoint: "https://api.tvmaze.com/shows/{id}/cast",
  params: { id: ref("show", "id") }
});

select("showInfo", "show", ["name", "genres", "rating", "language"]);

filter("topEpisodes", "episodes", "rating && rating.average >= 8");

select("episodeInfo", "topEpisodes", ["name", "season", "number", "rating"]);

map("episodeSummary", "episodeInfo", { title: "name", season: "season", episode: "number", score: "rating.average" });

join("withEpisodes", "showInfo", "episodeSummary", { as: "top_episodes" });

join("result", "withEpisodes", "cast", { as: "cast" });`;

export const EXAMPLES: Example[] = [
  { name: 'REST Countries — European Countries', tier: 'Simple', code: REST_COUNTRIES_PIPELINE },
  { name: 'Open-Meteo — Paris Weather', tier: 'Simple', code: OPEN_METEO_PIPELINE },
  { name: 'D&D 5e — Dragon Stats', tier: 'Simple', code: DND_PIPELINE },
  { name: 'Rick & Morty — Character & Location', tier: 'Moderate', code: RICK_AND_MORTY_PIPELINE },
  { name: 'PokeAPI — Pokemon Profile', tier: 'Moderate', code: POKEAPI_PIPELINE },
  { name: 'Open Library — Book & Author', tier: 'Moderate', code: OPEN_LIBRARY_PIPELINE },
  { name: 'Art Institute — Artwork Deep Dive', tier: 'Moderate', code: ART_INSTITUTE_PIPELINE },
  { name: 'SpaceX — Launch Details', tier: 'Advanced', code: SPACEX_PIPELINE },
  { name: 'SWAPI — Star Wars People', tier: 'Advanced', code: SWAPI_PIPELINE },
  { name: 'TVMaze — The Office', tier: 'Advanced', code: TVMAZE_PIPELINE },
];
