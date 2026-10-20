# Open-source hygiene (always applies: this repo is public)

- **Never commit LD Didactic material**: PDFs, page renders or screenshots, copied figures, verbatim paragraphs.
  `refs/` is gitignored. Paraphrased facts, numerical values and our own data are fine when cited
  ("LD leaflet P6.1.4.1").
- Cite sources in the README and in doc comments: the LD leaflet P6.1.4.1 and literature values.
- No secrets, tokens, local absolute paths (`/home/...`) or machine-specific settings in committed files.
  `.claude/settings.local.json` stays local.
- Licensing: MIT for code (`LICENSE`), CC BY 4.0 for educational content (`LICENSE-CONTENT`). New dependencies must be
  MIT/BSD/Apache/ISC; ask before adding GPL/AGPL or anything unclear.
- Prefer few, small, well-maintained dependencies. Every dependency ships to students' phones.
- Write for strangers: clear README, reproducible setup (`package-lock.json`), commit messages that explain why.
- Not affiliated with LD Didactic; say so in the README.
