# Ordforråd

A Chrome extension for building vocabulary cards with an LLM and exporting them to Anki.

I've been using Anki for years. Back when I was still working through textbooks, making cards by hand was fine. You're already in learning mode, so switching to Anki and back doesn't feel like an interruption.

Reading native content online is different. You want to capture the words, but every time you stop to create a card you lose your place in the text. The overhead per word is just too high.

So I built this. Right-click any word on any page and a complete card comes back: translation, pronunciation, grammar notes, an example sentence in context, a memory tip. When you have enough cards, export to Anki and start reviewing.

![Popup showing saved cards](docs/screenshots/popup-cards.png)

---

## Getting Started

Follow the [setup guide](https://u8array.github.io/ordforraad/guide.html).

---

## Development

```bash
npm install && npm run build
```

Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the project folder.

![Extension loaded in chrome://extensions](docs/screenshots/chrome-extensions.png)

## Contributing

Pull requests are welcome.

## Libraries

[sql.js](https://github.com/sql-js/sql.js) and [JSZip](https://stuk.github.io/jszip/) are vendored locally in the `libs/` folder. No requests are made to any CDN at runtime.
