# Contributing to Kothon

Thanks for helping make Bengali dictation better.

- **Bugs:** open an issue with the bug template, and include your Kothon version, macOS version and the model you use.
- **Ideas and questions:** use [Discussions](https://github.com/Omnixima/kothon/discussions).
- **Code:** fork the repo, make a branch, and open a pull request. Before you push, run:
  ```bash
  bun run lint && bun run format:check
  cd src-tauri && cargo test --lib
  ```
- **Bengali accuracy:** if a word or name keeps coming out wrong, the most useful report includes what you said, what Kothon wrote, and which model was in use.

See [BUILD.md](BUILD.md) to build from source. Kothon-specific code lives in `src-tauri/src/kothon*.rs`, `src/components/home`, `src/components/onboarding/KothonOnboarding.tsx` and `scripts/kothon`.
