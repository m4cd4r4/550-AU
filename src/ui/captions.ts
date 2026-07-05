// Tour captions: short declarative lines, faded in and out.

export class Captions {
  readonly el: HTMLElement;
  private hideTimer: number | undefined;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'captions';
    parent.appendChild(this.el);
  }

  show(text: string, holdS = 6): void {
    window.clearTimeout(this.hideTimer);
    this.el.textContent = text;
    this.el.classList.add('visible');
    this.hideTimer = window.setTimeout(() => this.clear(), holdS * 1000);
  }

  clear(): void {
    window.clearTimeout(this.hideTimer);
    this.el.classList.remove('visible');
  }
}
