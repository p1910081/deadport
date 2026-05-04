# Documentation

| Document                                       | What it is                                     | When to read              |
| ---------------------------------------------- | ---------------------------------------------- | ------------------------- |
| [PRD.md](./PRD.md)                             | Product requirements, scope, roadmap           | Start here                |
| [CLI.md](./CLI.md)                             | Canonical CLI specification (the public API)   | Before changing any flag  |
| [ARCHITECTURE.md](./ARCHITECTURE.md)           | Project layout, module rules, testing strategy | Before writing code       |
| [PORTING-TO-GO.md](./PORTING-TO-GO.md)         | The v2 Go rewrite plan                         | When v1 is shipped        |
| [GLOSSARY.md](./GLOSSARY.md)                   | Shared vocabulary                              | Reference                 |

---

## How these docs relate

```
PRD.md ──────────► what & why
   │
   ├──► CLI.md ────────────► public contract (do not break)
   │
   ├──► ARCHITECTURE.md ───► how we build it
   │       │
   │       └──► GLOSSARY.md (shared terms)
   │
   └──► PORTING-TO-GO.md ──► future
```

If you change something in code, ask: which doc is now stale? Update it in the same PR.
