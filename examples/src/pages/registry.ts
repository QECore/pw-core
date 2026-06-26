import { createPageRegistry } from 'pw-core/page';

// Initialize registry (mostly automatic, defining base configs as siblings)
export const registry = createPageRegistry({
  loginPage: {
    url: '/login',
    testIds: {
      defaultUserLogin: 'login-default-user',
      email: 'email-input',
      password: 'password-input',
      submit: 'login-submit',
    }
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
      table: 'projects-table',
      "form{item}": {
        item: ['title', 'description', 'save'],
        testId: "form-item"
      }
    }
  },
  tasksPage: {
    url: '/app/tasks',
    testIds: {
      newTask: 'new-task-button',
      table: 'tasks-table',
      "form{item}": {
        item: ['title', 'description', 'save'],
        testId: "form-item"
      }
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
  playground: {
    url: '/playground',
    testIds: {
      // Dynamic testIds: Keys converted to camelCase (e.g. activeLineChart), values kebab-cased (e.g. "active-line-chart")
      "{status}{id}Chart": {
        id: ['line', 'bar'],
        status: ['active', 'inactive'],
        testId: "status-id-chart"
      }
    },
    selectors: {
      card: ".skeu-card",
      // Dynamic selectors: Keys camelCased (e.g. safe, danger), values preserve original casing (e.g. "#Safe", "#Danger")
      "{status}": {
        status: ['Safe', 'Danger'],
        selector: "#status"
      },
    }
  }
});
