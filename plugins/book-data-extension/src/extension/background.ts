// #region content_script_interface
chrome.runtime.onMessage.addListener(
	async (
		{ kind, isbn }: { kind: string; isbn: string },
		sender: chrome.runtime.MessageSender,
		senderResponse: (response?: any) => void
	) => {
		switch (kind) {
			case "FETCH_BOOK_DATA":
				return handleFetchBookData(isbn, sender, senderResponse);
			case "PING":
				return handlePing(senderResponse);
			default:
				return;
		}
	}
);

const handleFetchBookData = (isbn: string, sender: chrome.runtime.MessageSender, senderResponse: (response?: any) => void) => {
	fetchUrl(isbn, sender, senderResponse);
	return true;
};

const handlePing = (senderResponse: (res?: any) => void) => {
	senderResponse();
	return true;
};
// #endregion content_script_interface

// #region helpers
const urls: Record<string, string> = {
	annasArchive: `https://annas-archive.org/isbndb/`
};

const cache: { [key: string]: string } = {};

function fetchUrl(isbn: string, sender: chrome.runtime.MessageSender, senderResponse: (response?: any) => void) {
	// If the `isbn` is already in the cache, return it
	if (cache[isbn]) {
		senderResponse(cache[isbn]);
		return;
	}
	try {
		const source = "annasArchive";
		const url = `${urls[source]}${isbn}`;
		fetch(url).then((res) =>
			res
				.text()
				.then((text) => ({ serial: `${source}:${isbn}`, body: text }))
				.then((res) => {
					// handle serialization here because otherwise
					// the html gets messed up in the sending process

					const result = JSON.stringify(res);
					cache[isbn] = result;
					if (sender.tab?.id) {
						// to content script
						chrome.tabs.sendMessage(sender.tab?.id, result);
					}
					senderResponse(`message sent back from ${url}`);
				})
		);
	} catch (error: any) {
		console.log({ error });
	}
}
// #endregion helpers
export {};
