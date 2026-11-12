export interface ChapterInfo {
  id: number;
  title: string;
  available: boolean;
}

export class ChapterRail {
  readonly el: HTMLElement;
  // The same chapters as a native picker, for viewports too narrow for the rail.
  readonly select: HTMLSelectElement;
  private buttons = new Map<number, HTMLButtonElement>();

  constructor(parent: HTMLElement, chapters: ChapterInfo[], onSelect: (id: number) => void) {
    this.el = document.createElement('nav');
    this.el.className = 'chapter-rail';
    this.select = document.createElement('select');
    this.select.className = 'chapter-select';
    this.select.setAttribute('aria-label', 'Chapter');
    this.select.addEventListener('change', () => onSelect(Number(this.select.value)));
    for (const chapter of chapters) {
      const button = document.createElement('button');
      button.className = chapter.available ? 'chapter' : 'chapter locked';
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(chapter.id);
      button.appendChild(num);
      button.append(chapter.title);
      if (!chapter.available) {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = 'IN BUILD';
        button.appendChild(tag);
      } else {
        button.addEventListener('click', () => onSelect(chapter.id));
      }
      this.el.appendChild(button);
      const option = document.createElement('option');
      option.value = String(chapter.id);
      option.textContent = `${chapter.id} ${chapter.title}`;
      option.disabled = !chapter.available;
      this.select.appendChild(option);
      this.buttons.set(chapter.id, button);
    }
    parent.appendChild(this.el);
  }

  setActive(id: number): void {
    this.select.value = String(id);
    for (const [chapterId, button] of this.buttons) {
      const active = chapterId === id;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    }
  }
}
