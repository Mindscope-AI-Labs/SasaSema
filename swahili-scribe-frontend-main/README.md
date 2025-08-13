# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/d3c237c1-a910-45c9-88bf-b2153344006c

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/d3c237c1-a910-45c9-88bf-b2153344006c) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Testing

This project uses Vitest and React Testing Library for unit/integration tests.

Run tests:

```sh
# install deps
npm i

# run the test suite once
npm test

# watch mode
npm run test:watch

# with coverage
npm run test:coverage
```

### Component under test: TranscribeForm

Key behaviors covered by tests:

- File selection and drag-and-drop of supported audio types (`WAV`, `MP3`, `OGG`).
- Immediate display of the audio player after selecting a file.
- Submitting the form triggers transcription and renders the result.
- Inline error for unsupported file types.

Accessible/data attributes used for robust testing:

- `data-testid="drop-zone"` for the drag-and-drop area.
- `data-testid="file-input"` for the hidden file input.
- `data-testid="audio-player"` for the audio player container.
- Result is rendered in a read-only `<Textarea>` so tests can assert via `getByDisplayValue`.

### Error handling

- Unsupported file types show an inline message under the drop zone and a toast.
- New file selection clears previous errors and results.
- Upload and playback errors surface a toast with a helpful message.

### Test environment compatibility (jsdom)

The component creates object URLs for audio previews. Some jsdom environments do not implement `URL.revokeObjectURL`. To prevent crashes in tests, the cleanup effect in `TranscribeForm` guards this call:

```ts
if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
  URL.revokeObjectURL(audio.url);
}
```

Tests also typically mock:

- `URL.createObjectURL` to return a stable blob URL.
- The global `Audio` constructor to immediately fire `loadedmetadata` and avoid real media loading.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/d3c237c1-a910-45c9-88bf-b2153344006c) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
