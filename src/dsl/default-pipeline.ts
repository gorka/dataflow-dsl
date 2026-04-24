export const DEFAULT_PIPELINE = `const person = source("person", {
  endpoint: "https://www.swapi.tech/api/people/{id}",
  method: "GET",
  params: { id: 1 }
});

const films = source("films", {
  endpoint: ref(person, "films"),
  method: "GET"
});

const homeworld = source("homeworld", {
  endpoint: ref(person, "homeworld"),
  method: "GET"
});

const species = source("species", {
  endpoint: ref(person, "species"),
  method: "GET"
});

const starships = source("starships", {
  endpoint: ref(person, "starships"),
  method: "GET"
});

const vehicles = source("vehicles", {
  endpoint: ref(person, "vehicles"),
  method: "GET"
});

const personInfo = person.select(["name", "height", "mass", "birth_year", "gender"]);

const result = personInfo
  .join(films, { as: "films" })
  .join(homeworld, { as: "homeworld" })
  .join(species, { as: "species" })
  .join(starships, { as: "starships" })
  .join(vehicles, { as: "vehicles" });`;
