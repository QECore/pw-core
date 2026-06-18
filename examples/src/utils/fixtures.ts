import { ProjectsPage } from "@pages/projects.page";
import { registry } from "@pages/registry";

// Extend registry with overridden ProjectsPage class
export const scenario = registry.extend({
  projectsPage: ProjectsPage,
});
