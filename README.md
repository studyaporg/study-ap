# studyap.org

```bash
pnpm install
pnpm dev
pnpm db:push
pnpm tsx cmd/generator/dummy
```

## environment variables

you should use a file called `.dev.vars` to keep your environment variables.

```ini
# note: openai and google are mutually exclusive, you cannot specify both api keys at the same time
OPENAI_API_KEY="..."
GOOGLE_API_KEY="..."

DATABASE_URL="..."
DATABASE_AUTH_TOKEN="..."
```

> note that in svelte only `VITE_` prefixed environment variables will be exposed by `import.meta.env`.

## scripts

- `dev` - run a dev environment
- `test` - run unit tests **(note: as of 2024 you have to run this like `NODE_OPTIONS="--experimental-vm-modules" pnpm test`), this is due to some strange things with ESM/CJS**
- `db:generate` - generates database sql migrations
- `db:push` - pushes migrations to a database
- `tsx` - executes a typescript script, usually used to execute scripts under `cmd/...`

## ap test question generation

the packages under `cmd/generator/` can be executed directly to generate ap test questions and push them to the currently configured database.

