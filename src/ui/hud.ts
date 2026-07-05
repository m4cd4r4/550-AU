// Persistent telemetry block. Acts supply rows each frame; labels are
// stable so the DOM is only rebuilt when the row set changes.

export class Hud {
  readonly el: HTMLElement;
  private keys: string[] = [];
  private values: HTMLElement[] = [];

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hud panel';
    parent.appendChild(this.el);
  }

  setRows(rows: [string, string][]): void {
    const sameShape =
      rows.length === this.keys.length && rows.every(([k], i) => this.keys[i] === k);
    if (!sameShape) {
      this.el.innerHTML = '';
      this.keys = rows.map(([k]) => k);
      this.values = rows.map(([k]) => {
        const row = document.createElement('div');
        row.className = 'row';
        const key = document.createElement('span');
        key.className = 'k';
        key.textContent = k;
        const value = document.createElement('span');
        value.className = 'v';
        row.append(key, value);
        this.el.appendChild(row);
        return value;
      });
    }
    rows.forEach(([, v], i) => {
      const el = this.values[i];
      if (el && el.textContent !== v) el.textContent = v;
    });
  }
}
