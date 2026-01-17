export interface Project {
  slug: string;
  name: string;
  year: number;
  previousSlug: string;
  previousName: string;
  previousYear: number;
  resultsApi: {
    url: string;
    api_key: string;
  };
  heuristicsApi: {
    url: string;
    api_key: string;
  };
}

export const projects: Project[] = [
  {
    slug: "retail6",
    name: "Flashblack 6 (Retail)",
    year: 2025,
    previousSlug: "retail-5",
    previousName: "Flashblack 5",
    previousYear: 2024,
    resultsApi: {
      url: "https://heuristic-v4.vercel.app/api/result?current=retail6&previous=retail-5",
      api_key: "20rga25",
    },
    heuristicsApi: {
      url: "https://heuristic-v4.vercel.app/api/heuristics?project=retail6",
      api_key: "20rga25",
    },
  },
  {
    slug: "rspla2",
    name: "Garage SPLA 2",
    year: 2025,
    previousSlug: "latam-1",
    previousName: "Garage SPLA 1",
    previousYear: 2024,
    resultsApi: {
      url: "https://heuristic-v4.vercel.app/api/result?current=rspla2&previous=latam-2",
      api_key: "20rga25",
    },
    heuristicsApi: {
      url: "https://heuristic-v4.vercel.app/api/heuristics?project=rspla2",
      api_key: "20rga25",
    },
  },
];