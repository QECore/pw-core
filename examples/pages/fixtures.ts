import { ProjectsPage } from "./projects.page";
import { registry } from "./registry";

// Extend registry with overridden ProjectsPage class
export const scenario = registry.extend({
  projectsPage: ProjectsPage,
});
