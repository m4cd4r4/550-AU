// In-app credits overlay: a modal listing every bundled asset and its
// licence, mirroring CREDITS.md. Opened from a topbar button. The HYG
// attribution (CC BY-SA 4.0) is mandatory, so it is listed first.

interface CreditEntry {
  asset: string;
  source: string;
  href: string;
  licence: string;
}

const CREDITS: CreditEntry[] = [
  {
    asset: 'HYG star database v4.1 (trimmed subset)',
    source: 'astronexus/HYG-Database, David Nash',
    href: 'https://github.com/astronexus/HYG-Database',
    licence: 'CC BY-SA 4.0 (attribution required)'
  },
  {
    asset: 'Sun photosphere texture',
    source: 'Solar System Scope textures',
    href: 'https://www.solarsystemscope.com/textures/',
    licence: 'CC BY 4.0'
  },
  {
    asset: 'Corona backdrop (LASCO C2 frame)',
    source: 'SOHO/LASCO, ESA and NASA',
    href: 'https://soho.nascom.nasa.gov/',
    licence: 'Free for education with credit'
  },
  {
    asset: 'Planetary orbital elements',
    source: 'JPL approximate elements (E M Standish)',
    href: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
    licence: 'Public domain (US Govt)'
  },
  {
    asset: 'Mission facts and figures',
    source: 'Turyshev et al 2020, NIAC Phase III (arXiv:2002.11871)',
    href: 'https://arxiv.org/abs/2002.11871',
    licence: 'Facts not copyrightable; prose original'
  },
  {
    asset: 'Exoplanet surface',
    source: 'Procedural, watermarked speculative',
    href: '',
    licence: 'Original, MIT with the repo'
  }
];

export class Credits {
  private readonly overlay: HTMLElement;

  constructor(parent: HTMLElement, private readonly button: HTMLButtonElement) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'credits-overlay';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-label', 'Credits and asset licences');

    const panel = document.createElement('div');
    panel.className = 'credits-panel panel';

    const head = document.createElement('div');
    head.className = 'credits-head';
    head.innerHTML =
      '<div class="credits-title">CREDITS AND ASSET LICENCES</div>' +
      '<div class="credits-sub">Every asset runs with a procedural fallback, so the app works offline.</div>';
    const close = document.createElement('button');
    close.className = 'credits-close';
    close.textContent = 'CLOSE';
    close.addEventListener('click', () => this.hide());
    head.appendChild(close);
    panel.appendChild(head);

    for (const c of CREDITS) {
      const row = document.createElement('div');
      row.className = 'credits-row';
      const name = document.createElement('div');
      name.className = 'credits-asset';
      name.textContent = c.asset;
      const src = document.createElement('div');
      src.className = 'credits-source';
      if (c.href) {
        const link = document.createElement('a');
        link.href = c.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = c.source;
        src.appendChild(link);
      } else {
        src.textContent = c.source;
      }
      const lic = document.createElement('div');
      lic.className = 'credits-licence';
      lic.textContent = c.licence;
      row.append(name, src, lic);
      panel.appendChild(row);
    }

    const foot = document.createElement('div');
    foot.className = 'credits-foot';
    foot.textContent = 'Code MIT licensed. Three.js, Vite, Vitest, TypeScript under their own licences.';
    panel.appendChild(foot);

    this.overlay.appendChild(panel);
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });
    parent.appendChild(this.overlay);

    this.button.addEventListener('click', () => this.toggle());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
  }

  toggle(): void {
    this.overlay.classList.toggle('visible');
  }

  hide(): void {
    this.overlay.classList.remove('visible');
  }
}
