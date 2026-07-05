import { registry } from './registry';

export class PlaygroundPage extends registry.pages.playground {

  async fillInputForm(text: string, password: string, number: string) {
    await this.fill('playgroundText', text);
    await this.fill('playgroundPassword', password);
    await this.fill('playgroundNumber', number);
  }

  async fillOtp(code: string) {
    await this.click('playgroundOtp');
    await this.page.keyboard.type(code);
  }
}
