// A circular magnifier that surfaces a high-quality spacecraft render at the
// right story moment: the James Webb telescope in Act 0, Voyager 1 and 2 in
// Act 4 as the pearl string overtakes them. Images are real NASA renders
// (public domain). If one fails to load the loupe stays hidden, so the app
// still runs fully offline.

export class Loupe {
  private readonly el: HTMLElement;
  private readonly img: HTMLImageElement;
  private readonly title: HTMLElement;
  private readonly sub: HTMLElement;
  private currentSrc = '';
  private broken = new Set<string>();

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'loupe';
    this.el.setAttribute('aria-hidden', 'true');

    const frame = document.createElement('div');
    frame.className = 'loupe-frame';
    this.img = document.createElement('img');
    this.img.alt = '';
    this.img.decoding = 'async';
    this.img.addEventListener('error', () => {
      this.broken.add(this.img.src);
      this.hide();
    });
    frame.appendChild(this.img);

    const label = document.createElement('div');
    label.className = 'loupe-label';
    this.title = document.createElement('b');
    this.sub = document.createElement('span');
    label.append(this.title, this.sub);

    this.el.append(frame, label);
    parent.appendChild(this.el);
  }

  show(src: string, title: string, sub: string): void {
    if (this.broken.has(src)) return;
    if (src !== this.currentSrc) {
      this.img.src = src;
      this.currentSrc = src;
    }
    this.title.textContent = title;
    this.sub.textContent = sub;
    this.el.classList.add('visible');
    this.el.setAttribute('aria-hidden', 'false');
  }

  hide(): void {
    if (!this.el.classList.contains('visible')) return;
    this.el.classList.remove('visible');
    this.el.setAttribute('aria-hidden', 'true');
  }
}
