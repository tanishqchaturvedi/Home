# Tanishk Chaturvedi — Portfolio

Personal site for Tanishk Chaturvedi, Solutions Architect for Data & AI at Fivetran.

Built with **Vite + TypeScript + Three.js** and deployed to GitHub Pages by GitHub Actions (`.github/workflows/deploy.yml`) on every push to `main`.

```bash
npm install
npm run dev        # local dev server
npm run build      # typecheck + production build into dist/
```

- `index.html`, `book.html`: page content
- `src/main.ts`: fit-to-width type, pinned scroll chapters, reveals, clock
- `src/flow3d.ts`: the "Raw to ready" WebGL particle scene (lazy-loaded)
- `src/styles/style.css`: design system and layout
- `public/`: static assets and the résumé PDF (replace `Tanishk_Chaturvedi_CV.pdf` to update it)
