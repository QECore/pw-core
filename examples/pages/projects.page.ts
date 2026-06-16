import type { Page } from "@playwright/test";
import { Table } from "pw-core/component/table";
import { registry } from "./registry";

type TableType = { title: string }

// To Override the page config to add custom methods for the page
export class ProjectsPage extends registry.pages.projectsPage {
  projectsTable = new Table<TableType>(this.table);

  constructor(page: Page) {
    super(page);
  }

  async createProject(title: string, description: string) {
    await this.click('newProject');
    await this.fill('formTitle', title);
    await this.fill('formDescription', description);
    await this.click('formSave');
  }

  async verifyProjectInTable(title: string) {
    const rows = await this.projectsTable.get();
    const titles = rows.getAll('title');
    if (!titles.includes(title)) {
      throw new Error(`Project "${title}" not found in projects table.`);
    }
  }
}