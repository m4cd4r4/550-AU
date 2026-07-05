export interface ChapterInfo {
  id: number;
  title: string;
  available: boolean;
}

export class ChapterRail {
  readonly el: HTMLElement;
  private buttons = new Map<number, HTMLButtonElement>();

  constructor(parent: HTMLElement, chapters: ChapterInfo[], onSelect: (id: number) => void) {
    this.el = document.createElement('nav');
    this.el.className = 'chapter-rail';
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
      this.buttons.set(chapter.id, button);
    }
    parent.appendChild(this.el);
  }

  setActive(id: number): void {
    for (const [chapterId, button] of this.buttons) {
      button.classList.toggle('active', chapterId === id);
    }
  }
}
