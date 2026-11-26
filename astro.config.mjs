import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://moe.oral.brid.pw',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // No home page: the site opens on the student walkthrough.
  redirects: { '/': '/student/', '/introduction/': '/student/' },
});
