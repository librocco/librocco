/** Content script */

import type { Result } from "../types";
import { BookEntry } from "@librocco/db";

// #region client_interface
//
// Receive and process messages from the plugin (part of the client app)
window.addEventListener("message", (event: MessageEvent<{ message: string }>) => {
	if (event.source !== window || !event.data?.message) return;
	const { message } = event.data;

	// message will be sent from client as such: window.postMessage(`BOOK_SCRAPER_REQ:${pluginName}:${isbn}`);
	if (message === "BOOK_FETCHER:PING") {
		window.postMessage({ message: "BOOK_FETCHER:PONG" }, "*");
	}

	if (message.startsWith("BOOK_FETCHER:REQ")) {
		// BOOK_FETCHER:REQ:32132
		const [, , isbn] = event.data.message.split(":");
		if (!isbn) return;

		// sent to background script
		chrome.runtime.sendMessage<{ kind: string; isbn: string }>({ kind: "FETCH_BOOK_DATA", isbn });
	}
});
// #endregion client_interface

// #region background_interface
//
// Receive and process messages from the background script
chrome.runtime.onMessage.addListener((message) => {
	// Message comes as stringified JSON so as to not mess up the HTML string, TODO: verify this is necessary
	const { serial, body } = JSON.parse(message) as { serial: string; body: string };
	const [source, isbn] = serial.split(":");

	const parser = new DOMParser();
	const htmlDoc = parser.parseFromString(body, "text/html");

	const res = (() => {
		switch (source) {
			case "annasArchive":
				return annasArchiveScraper(htmlDoc);
			default:
				return { ok: false } as ParsingResult;
		}
	})();

	// sent to client
	// serial being sent: `BOOK_FETCHER:RES:${isbn}`
	window.postMessage(
		{
			message: `BOOK_FETCHER:RES:${isbn}`,
			book: res.ok ? { ...res.data, isbn } : undefined
		},
		"*"
	);
});
// #endregion background_interface

function checkBackgroundScript(onError: (err: any) => void) {
	return () => {
		try {
			chrome.runtime.sendMessage({ kind: "PING" });
		} catch (err) {
			onError(err);
		}
	};
}

function pollBackgroundScript() {
	let interval: any = undefined;

	const handleError = (err: any) => {
		console.warn("Book data extension: pinging background script gave the following error:", err);
		window.postMessage({ message: "BOOK_FETCHER:ACTIVE", isActive: false }, "*");
		clearInterval(interval);
	};

	interval = setInterval(checkBackgroundScript(handleError), 1000);
}

pollBackgroundScript();

// #region scrapers
type ParsingResult = Result<BookEntry>;

function annasArchiveScraper(rawHTML: Document): ParsingResult {
	let ok = false;
	const book: BookEntry = {
		isbn: "",
		title: "",
		authors: "",
		price: 0,
		publisher: "",
		year: ""
	};

	// Ensure there's a second element with "ISBNdb"
	const isbndbElements = Array.from(rawHTML.querySelectorAll("div")).filter((div) => div.innerText.includes("ISBNdb"));
	if (isbndbElements.length < 2) {
		return { ok };
	}

	// Iterate over children of the second isbndb element
	for (const child of Array.from(isbndbElements[1].children)) {
		if (child instanceof HTMLDivElement && child.innerText.includes("ISBNdb")) {
			const isbn = child.innerText.replace(/[^0-9]/g, "");
			if (isbn) {
				ok = true;
				book.isbn = isbn;
			}

			const title = (child.nextElementSibling?.textContent ?? "").replace(/\u{1F50D}/gu, "").trim();
			if (title) {
				ok = true;
				book.title = title;
			}

			const authors = (child.nextElementSibling?.nextElementSibling?.nextElementSibling?.textContent ?? "")
				.replace(/\u{1F50D}/gu, "")
				.trim();
			if (authors) {
				ok = true;
				book.authors = authors;
			}

			const publisherText = child.nextElementSibling?.nextElementSibling?.textContent ?? "";
			const publisher = publisherText
				.split(",")
				.reduce((acc, part) => {
					// Check if the part contains only numbers and special characters (likely to be a year)
					if (/^[0-9\-–—/]+$/.test(part.trim())) {
						ok = true;
						book.year = part.trim();
					} else {
						acc.push(part.trim());
					}
					return acc;
				}, [] as string[])
				.join(", ");
			if (publisher) {
				ok = true;
				book.publisher = publisher;
			}
		}
	}

	return ok ? { ok, data: book } : { ok };
}
// #region scrapers
