# nextjs-unused-finder

Find and clean up unused files in your Next.js project.

## Features

- 🔍 Detects unused components, utilities, and media files
- 🎯 Smart detection of Next.js special files (pages, layouts, etc.)
- 📊 Shows potential space savings
- 🚀 Fast and reliable analysis
- 💡 Intelligent import/export tracking

## Installation

```bash
npm install -g nextjs-unused-finder
```

Or use directly with npx:

```bash
npx nextjs-unused-finder
```

## Usage

Navigate to your Next.js project root and run:

```bash
find-unused
```

## What it checks

- Components (*.tsx, *.jsx)
- Utility functions (*.ts, *.js)
- Media files in public directory
- Stylesheets (*.css, *.scss)
- Custom hooks
- Context providers

## What it ignores

- Next.js system files (pages, layouts, etc.)
- SEO-related files (robots.txt, sitemap.xml, etc.)
- node_modules
- .next directory
- Build artifacts

## Output

The tool will show:
- Unused files grouped by type
- File sizes
- Total potential space savings
- Suggestions for cleanup

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.