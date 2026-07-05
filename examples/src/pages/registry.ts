import { createPageRegistry, PageConfig } from 'pw-core/page';

export const registry = createPageRegistry({
  loginPage: {
    url: '/login',
    testIds: {
      defaultUserLogin: 'login-default-user',
      email: 'email-input',
      password: 'password-input',
      submit: 'login-submit'
    }
  },
  dashboardPage: {
    url: '/app',
    selectors: {
      heading: 'h1:has-text("Dashboard")'
    }
  },
  projectsPage: {
    url: '/app/projects',
    testIds: {
      newProject: 'new-project-button',
      table: 'projects-table',
      'form{item}': {
        item: ['title', 'description', 'save'],
        testId: 'form-item'
      }
    }
  },
  sidebar: {
    testIds: {
      'item{page}': {
        page: ['projects', 'tasks'],
        testId: 'sidebar-page'
      }
    }
  },
  playground: {
    url: '/playground',
    testIds: {
      'tabTrigger{item}': {
        item: ['charts', 'tables', 'inputs', 'buttons', 'overlays', 'advanced'],
        testId: 'tab-trigger-item'
      }
    },
    selectors: {
      // Input elements use HTML id selectors
      'playground{item}': {
        item: ['text', 'password', 'number', 'switch', 'textarea', 'otp', 'select', 'toggle'],
        selector: '#playground-{item}'
      },
      // Button variant elements
      'btnVariant{item}': {
        item: ['default', 'secondary', 'outline', 'destructive', 'ghost', 'link'],
        selector: '#btn-variant-{item}'
      },
      // Toggle alignment group
      'toggleAlign{item}': {
        item: ['left', 'center', 'right'],
        selector: '#toggle-align-{item}'
      },
      termsCheckbox: '#terms'
    }
  }
});
