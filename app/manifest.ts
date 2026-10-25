import type { MetadataRoute } from "next";

// "Add to Home Screen": opens full screen like an app
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nado",
    short_name: "Nado",
    description: "Plans with NYU students who are free when you are.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfafd",
    theme_color: "#57068C",
    icons: [{ src: "/mascot.webp", sizes: "any", type: "image/webp" }],
  };
}
