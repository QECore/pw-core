import { registry } from '../pages/registry';
import { PlaygroundPage } from '../pages/playground.page';

// Extend base registry with overridden class
export const scenario = registry.extend({
  playground: PlaygroundPage
});
