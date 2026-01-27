# Markdown Translator Preview

A VS Code / Google Antigravity extension that shows translated previews of Markdown files without modifying the original file. The extension also generates a concise summary of the translated content.

## Features

- 🚀 **Automatic Preview**: Shows translated preview when a Markdown file is opened
- 🌍 **Multiple Languages**: Supports translation to any language (default: Hebrew)
- 📝 **Summary Generation**: Generates concise summaries of translated content
- 🎨 **Clean UI**: Side-by-side view with translation and summary
- 🛠️ **Configuration Options**: Customize target language, service, and summary length

## Installation

### From VSIX (Recommended)

1. Build the extension:
   ```bash
   npm run package
   ```

2. In VS Code/Antigravity:
   - Open Extensions view (Ctrl+Shift+X)
   - Click "Install from VSIX..."
   - Select the generated `md-translator-0.0.1.vsix` file

### Development Mode

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the extension:
   - Press F5 (or select "Run Extension" from the Run view)
   - This will open a new VS Code window with the extension activated

## Configuration

Open Settings (Ctrl+,) and search for "Markdown Translator" to configure:

- **Target Language**: Language code for translation (e.g., 'he', 'en', 'fr')
- **Summary Length**: Length of the summary ('short', 'medium', 'long')
- **Translation Service**: Service to use for translation ('google-translate', 'gemini', 'openai')

## Usage

1. Open any Markdown file (.md)
2. The extension will automatically show a translated preview in a side panel
3. You can also manually open the preview using the command palette:
   - Press Ctrl+Shift+P
   - Type "Markdown: Show Translated Preview"
   - Press Enter

## Architecture

```
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Markdown File   │    │  Extension Logic │    │  Webview Panel   │
└────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
         │                       │                       │
         ├──────────────────────►│                       │
         │ Read file content     │                       │
         │                       │                       │
         │                       ├──────────────────────►│
         │                       │ Display translation   │
         │                       │ and summary           │
         │                       │                       │
         │                       │                       │
         │                       │                       │
         │                       │                       │
└────────┴─────────┘    └────────┴─────────┘    └────────┴─────────┘
```

## Development

### Project Structure

```
md-translator/
├─ .vscode/          # VS Code configuration
├─ out/              # Compiled output
├─ src/              # Source files
│  └─ extension.ts   # Main extension logic
├─ package.json      # Extension manifest
├─ tsconfig.json     # TypeScript configuration
└─ README.md         # Documentation
```

### Building from Source

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Package as VSIX
npm run package
```

## Supported Translation Services

### Google Translate

- Requires API key from Google Cloud Platform
- Follow [Google Cloud Translation API](https://cloud.google.com/translate) documentation

### OpenAI

- Requires API key from OpenAI
- Follow [OpenAI API documentation](https://platform.openai.com/docs/introduction)

### Gemini

- Requires API key from Google AI Studio
- Follow [Google AI Studio](https://ai.google.dev/) documentation

## Customization

You can customize the behavior by modifying the following files:

- **`src/extension.ts`**: Main extension logic
- **`package.json`**: Extension configuration and commands
- **Webview HTML**: Modify `getWebviewContent()` function

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test the extension
5. Submit a pull request

## License

MIT License

## Support

For issues, suggestions, or questions:

1. Open an issue on GitHub
2. Contact the maintainer
3. Check the [VS Code Extension API](https://code.visualstudio.com/api) documentation