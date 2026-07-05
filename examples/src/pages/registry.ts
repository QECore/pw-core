import { createPageRegistry } from 'pw-core/page';

export const registry = createPageRegistry({

  pwCore: {
    url: '/pw-core',
    selectors: {
      '{item}': {
        item: ['why-pw-core', 'registry', 'typed-page', 'features'],
        selector: '[data-parent-id="{item}"]'
      }
    }
  },
  workspace: {
    url: '/workspace',
    testIds: {
      'QA-WorkspaceBtn': 'active-workspace-btn'
    }
  },
  playground: {
    url: '/playground',
    testIds: {
      'otp-input': 'otp-input',
      'tabTrigger{item}': {
        item: ['charts', 'tables', 'inputs', 'buttons', 'overlays', 'advanced'],
        testId: 'tab-trigger-item'
      },
      wsPlayground: 'ws-option-playground'
    }
  },
  swagger: {
    url: '/swagger',
    testIds: {
      'swaggerEndpointGetApiApp{item}': {
        item: ['activity', 'projects'],
        testId: 'swagger-endpoint-get--api-app-item'
      },
      'swaggerExecuteGetApiApp{item}': {
        item: ['activity', 'projects'],
        testId: 'swagger-execute-get--api-app-item'
      },
      'swaggerTab{item}': {
        item: ['models', 'endpoints'],
        testId: 'swagger-tab-item'
      },
      wsSwagger: 'ws-option-swagger'
    },
    selectors: {
      codeBlockInset: '.code-block-inset'
    }
  }
});
