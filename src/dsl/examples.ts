export interface Example {
  name: string;
  code: string;
}

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
  { name: 'SWAPI — Star Wars People', code: SWAPI_PIPELINE },
  { name: 'TVMaze — The Office', code: TVMAZE_PIPELINE },
];
