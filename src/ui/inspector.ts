// Data card for clickable objects in Explore mode. Slice 4 extends this
// into the pearl inspector.

export class Inspector {
  readonly el: HTMLElement;
  private title: HTMLElement;
  private rows: HTMLElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'inspector panel';

    const close = document.createElement('button');
    close.className = 'close';
    close.textContent = 'X';
    close.addEventListener('click', () => this.hide());

    this.title = document.createElement('div');
    this.title.className = 'title';

    this.rows = document.createElement('div');

    this.el.append(close, this.title, this.rows);
    parent.appendChild(this.el);
  }

  show(title: string, rows: [string, string][]): void {
    this.title.textContent = title;
    this.rows.innerHTML = '';
    for (const [k, v] of rows) {
      const row = document.createElement('div');
      row.className = 'row';
      const key = document.createElement('span');
      key.className = 'k';
      key.textContent = k;
      const value = document.createElement('span');
      value.className = 'v';
      value.textContent = v;
      row.append(key, value);
      this.rows.appendChild(row);
    }
    this.el.classList.add('visible');
  }

  hide(): void {
    this.el.classList.remove('visible');
  }
}
