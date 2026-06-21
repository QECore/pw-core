import { createPageRegistry } from 'pw-core/page';

// Initialize registry (mostly automatic, defining base configs as siblings)
export const registry = createPageRegistry({
  loginPage: {
    url: '/login',
    testIds: {
      defaultUserLogin: 'login-default-user',
    },
  },
  dashboardPage: {
    url: '/app',
    selectors: {
      heading: 'h1:has-text("Dashboard")',
    },
  },
  projectsPage: {
    url: '/app/projects',
    testIds: {
      newProject: 'new-project-button',
      formTitle: 'form-title',
      formDescription: 'form-description',
      formSave: 'form-save',
      table: 'projects-table',
    },
  },
  tasksPage: {
    url: '/app/tasks',
    testIds: {
      newTask: 'new-task-button',
      formTitle: 'form-title',
      formDescription: 'form-description',
      formSave: 'form-save',
      table: 'tasks-table',
    },
  },
  sidebar: {
    testIds: {
      itemProjects: 'sidebar-projects',
      itemTasks: 'sidebar-tasks',
    },
  },
  topNav: {
    testIds: {
      workspaceDropdown: 'active-workspace-btn',
      logoutBtn: 'ws-option-logout',
    },
  },
});
