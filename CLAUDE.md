@AGENTS.md

# Claude Code notes

- Start each session by reading `STATUS.md` (if present) and the phase prompt you were given; do not start the next phase on your own.
- Use plan mode for anything touching the payload shape, config schemas or AWS resources; the contract in `docs/05-DATA-CONTRACTS.md` is shared with the other session.
- When a task is large, work in small commits and run `make test` and `make lint` between them.
- For UI work, check your own screenshots at 360 px and 1024 px against `docs/02-UX-SPEC.md` before reporting done, and remove anything in the banned list.
- Prefer reading `docs/04-ALGORITHMS.md` over re-deriving a formula. If a formula looks wrong, say so rather than silently changing it.
- Do not run `sam deploy`, create AWS resources, or change IAM without telling the human what will be created. Never put credentials in files.
- Commit messages end with the attribution lines the session asks for.
