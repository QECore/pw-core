import { createPageRegistry } from 'pw-core/page';

export const registry = createPageRegistry({
  loginPage: {
    url: '/login',
    testIds: {
      defaultUserLogin: 'login-default-user'
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
      'form{item}': {
        item: ['title', 'description', 'save'],
        testId: 'form-item'
      },
      newProject: 'new-project-button',
      table: 'projects-table'
    }
  },
  sidebar: {
    testIds: {
      'item{page}': {
        page: ['projects'],
        testId: 'sidebar-page'
      }
    }
  },
  playground: {
    url: '/playground',
    testIds: {
      'tabTrigger{item}': {
        item: ['inputs', 'buttons', 'tables', 'charts', 'overlays', 'advanced'],
        testId: 'tab-trigger-item'
      }
    },
    selectors: {
      'btnVariant{item}': {
        item: ['default', 'secondary', 'outline', 'destructive'],
        selector: '#btn-variant-{item}'
      },
      'toggleAlign{item}': {
        item: ['left', 'center', 'right'],
        selector: '#toggle-align-{item}'
      },
      'playground{item}': {
        item: ['text', 'password', 'number', 'switch', 'textarea', 'otp'],
        selector: '#playground-{item}'
      }
    },
    checkbox: ['Accept terms']
  }
});
