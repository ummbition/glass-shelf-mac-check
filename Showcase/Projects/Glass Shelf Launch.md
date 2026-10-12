---
status: in progress
due: 2026-10-20
owner: Umm
progress: 68
tags: [project, release]
---
> [!info] Goal
> Publish the theme and its companion plugin to the community directory.

## Milestones

- [x] Name the project
- [x] Write the license
- [/] Draft the README
- [ ] Take screenshots
- [ ] Create the first release
- [>] Announce on the forum

## Checklist by area

| Area | Owner | State |
|---|---|---|
| Theme CSS | Umm | ✅ Ready |
| Plugin | Umm | 🟡 Testing |
| Docs | Umm | 🟡 Drafting |
| Screenshots | Umm | ⏳ Waiting |

> [!warning] Before release
> Bump the version in `manifest.json` and make the tag match exactly.

```json
{
  "id": "glass-shelf",
  "version": "1.0.0",
  "minAppVersion": "1.9.0"
}
```

Related: [[Design Principles]], [[Release Notes]]
