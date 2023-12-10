import EventEmitter from "events";

import type { Adapter } from "./adapter";

import {
	DeviceStatus,
	ErrorCauseStatus,
	OfflineCauseStatus,
	PrinterStatus,
	RollPaperSensorStatus,
	type StatusClassConstructor
} from "./statuses";
import * as _ from "./commands";
import * as utils from "./utils";
import type { AnyCase } from "./utils";

export interface PrinterOptions {
	encoding?: string | undefined;
	width?: number | undefined;
}

export type PrinterModel = null | "qsprinter";

/**
 * 'dhdw', 'dwh' and 'dhw' are treated as 'dwdh'
 */
export type RasterMode = AnyCase<"normal" | "dw" | "dh" | "dwdh" | "dhdw" | "dwh" | "dhw">;

export type BitmapDensity = AnyCase<"s8" | "d8" | "s24" | "d24">;

export type StyleString = AnyCase<"normal" | `${"b" | ""}${"i" | ""}${"u" | "u2" | ""}`>;

export type FeedControlSequence = AnyCase<"lf" | "glf" | "ff" | "cr" | "ht" | "vt">;

export type Alignment = AnyCase<"lt" | "ct" | "rt">;

export type FontFamily = AnyCase<"a" | "b" | "c">;

export type HardwareCommand = AnyCase<"init" | "select" | "reset">;

export type BarcodeType = AnyCase<
	"UPC_A" | "UPC-A" | "UPC-E" | "UPC_E" | "EAN13" | "EAN8" | "CODE39" | "ITF" | "NW7" | "CODE93" | "CODE128"
>;
export type BarcodePosition = AnyCase<"off" | "abv" | "blw" | "bth">;
export type BarcodeFont = AnyCase<"a" | "b">;
export interface BarcodeOptions {
	width: number;
	height: number;
	position?: BarcodePosition | undefined;
	font?: BarcodeFont | undefined;
	includeParity?: boolean | undefined;
}
export type LegacyBarcodeArguments = [
	width: number,
	height: number,
	position?: BarcodePosition | undefined,
	font?: BarcodeFont | undefined
];

export type TableAlignment = AnyCase<"left" | "center" | "right">;
export type CustomTableItem = {
	text: string;
	align?: TableAlignment;
	style?: StyleString | undefined;
} & ({ width: number } | { cols: number });

export interface CustomTableOptions {
	size: [number, number];
	encoding: string;
}

export class Printer<AdapterCloseArgs extends []> extends EventEmitter {
	public adapter: Adapter<AdapterCloseArgs>;
	public buffer = new MutBuf();
	protected options: PrinterOptions;
	protected encoding: string;
	protected width: number;
	protected _model: PrinterModel = null;

	/**
	 * [function ESC/POS Printer]
	 * @param  {[Adapter]} adapter [eg: usb, network, or serialport]
	 * @param {[PrinterOptions]} options
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	constructor(adapter: Adapter<AdapterCloseArgs>, options: PrinterOptions = {}) {
		super();
		this.adapter = adapter;
		this.options = options;
		this.encoding = options.encoding ?? "GB18030";
		this.width = options.width ?? 48;
	}

	/**
	 * Set printer model to recognize model-specific commands.
	 * Supported models: [ null, 'qsprinter' ]
	 *
	 * For generic printers, set model to null
	 *
	 * [function set printer model]
	 * @param  {[String]} model [mandatory]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	model(model: PrinterModel) {
		this._model = model;
		return this;
	}

	/**
	 * Set character code table
	 * @param  {[Number]} codeTable
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	setCharacterCodeTable(codeTable: number) {
		this.buffer.write(_.ESC);
		this.buffer.write(_.TAB);
		this.buffer.writeUInt8(codeTable);
		return this;
	}

	/**
	 * Fix bottom margin
	 * @param  {[String]} size
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	marginBottom(size: number) {
		this.buffer.write(_.MARGINS.BOTTOM);
		this.buffer.writeUInt8(size);
		return this;
	}

	/**
	 * Fix left margin
	 * @param  {[String]} size
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	marginLeft(size: number) {
		this.buffer.write(_.MARGINS.LEFT);
		this.buffer.writeUInt8(size);
		return this;
	}

	/**
	 * Fix right margin
	 * @param  {[String]} size
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	marginRight(size: number) {
		this.buffer.write(_.MARGINS.RIGHT);
		this.buffer.writeUInt8(size);
		return this;
	}

	/**
	 * [function print]
	 * @param  {[String]}  content  [mandatory]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	print(content: string | Uint8Array) {
		this.buffer.write(content);
		return this;
	}
	/**
	 * [function print pure content with End Of Line]
	 * @param  {[String]}  content  [mandatory]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	println(content: string) {
		return this.print(content + _.EOL);
	}

	/**
	 * [function print End Of Line]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	newLine() {
		return this.print(_.EOL);
	}

	/**
	 * [function Print encoded alpha-numeric text with End Of Line]
	 * @param  {[String]}  content  [mandatory]
	 * @param  {[String]}  encoding [optional]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	text(content: string) {
		return this.print(`${content}${_.EOL}`);
	}

	/**
	 * [function Print draw line End Of Line]
	 * @param  {[String]}  character [optional]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	drawLine(character = "-") {
		for (let i = 0; i < this.width; i++) {
			this.buffer.write(new TextEncoder().encode(character));
		}
		this.newLine();

		return this;
	}

	/**
	 * [function Print  table   with End Of Line]
	 * @param  {[data]}  data  [mandatory]
	 * @param  {[String]}  encoding [optional]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	table(data: (string | number)[]) {
		const cellWidth = this.width / data.length;
		let lineTxt = "";

		for (let i = 0; i < data.length; i++) {
			lineTxt += data[i].toString();

			const spaces = cellWidth - data[i].toString().length;
			for (let j = 0; j < spaces; j++) lineTxt += " ";
		}
		this.buffer.write(lineTxt + _.EOL);
		return this;
	}

	/**
	 * [function Print  custom table  with End Of Line]
	 * @param  {[data]}  data  [mandatory]
	 * @param  {[String]}  options [optional]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	tableCustom(data: CustomTableItem[], options: CustomTableOptions = { size: [1, 1], encoding: this.encoding }): this {
		const [width, height] = options.size;
		const baseWidth = Math.floor(this.width / width);
		let cellWidth = Math.floor(baseWidth / data.length);
		let leftoverSpace = baseWidth - cellWidth * data.length; // by only data[].width
		let lineStr = "";
		let secondLineEnabled = false;
		const secondLine = [];

		for (let i = 0; i < data.length; i++) {
			const obj = data[i];
			const align = utils.upperCase(obj.align || "left");

			const textLength = utils.textLength(obj.text);

			if ("width" in obj) {
				cellWidth = baseWidth * obj.width;
			} else if (obj.cols) {
				cellWidth = obj.cols / width;
				leftoverSpace = 0;
			}

			let originalText: string | null = null;
			if (cellWidth < textLength) {
				originalText = obj.text;
				obj.text = utils.textSubstring(obj.text, 0, cellWidth);
			}

			if (align === "CENTER") {
				const spaces = (cellWidth - textLength) / 2;
				for (let s = 0; s < spaces; s++) lineStr += " ";

				if (obj.text !== "") {
					if (obj.style) lineStr += `${this._getStyle(obj.style)}${obj.text}${this._getStyle("NORMAL")}`;
					else lineStr += obj.text;
				}

				for (let s = 0; s < spaces - 1; s++) lineStr += " ";
			} else if (align === "RIGHT") {
				let spaces = cellWidth - textLength;
				if (leftoverSpace > 0) {
					spaces += leftoverSpace;
					leftoverSpace = 0;
				}

				for (let s = 0; s < spaces; s++) lineStr += " ";

				if (obj.text !== "") {
					if (obj.style) lineStr += `${this._getStyle(obj.style)}${obj.text}${this._getStyle("NORMAL")}`;
					else lineStr += obj.text;
				}
			} else {
				if (obj.text !== "") {
					if (obj.style) lineStr += `${this._getStyle(obj.style)}${obj.text}${this._getStyle("NORMAL")}`;
					else lineStr += obj.text;
				}

				let spaces = Math.floor(cellWidth - textLength);
				if (leftoverSpace > 0) {
					spaces += leftoverSpace;
					leftoverSpace = 0;
				}

				for (let s = 0; s < spaces; s++) lineStr += " ";
			}

			if (originalText !== null) {
				secondLineEnabled = true;
				obj.text = utils.textSubstring(originalText, cellWidth);
				secondLine.push(obj);
			} else {
				obj.text = "";
				secondLine.push(obj);
			}
		}

		// Set size to line
		if (width > 1 || height > 1) {
			lineStr = _.TEXT_FORMAT.TXT_CUSTOM_SIZE(width, height) + lineStr + _.TEXT_FORMAT.TXT_NORMAL;
		}

		// Write the line
		this.buffer.write(lineStr + _.EOL);

		if (secondLineEnabled) {
			// Writes second line if has
			return this.tableCustom(secondLine, options);
		} else {
			return this;
		}
	}

	/**
	 * [function Print encoded alpha-numeric text without End Of Line]
	 * @param  {[String]}  content  [mandatory]
	 * @param  {[String]}  encoding [optional]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	pureText(content: string) {
		return this.print(content);
	}

	/**
	 * [function encode text]
	 * @param  {[String]}  encoding [mandatory]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	encode(encoding: string) {
		this.encoding = encoding;
		return this;
	}

	/**
	 * [line feed]
	 * @param  {[type]}    n   Number of lines
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	feed(n = 1) {
		this.buffer.write(new Array(n).fill(_.EOL).join(""));
		return this;
	}

	/**
	 * [feed control sequences]
	 * @param  {[type]}    ctrl     [description]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	control(ctrl: FeedControlSequence) {
		this.buffer.write(_.FEED_CONTROL_SEQUENCES[`CTL_${utils.upperCase(ctrl)}` as const]);
		return this;
	}
	/**
	 * [text align]
	 * @param  {[type]}    align    [description]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	align(align: Alignment) {
		this.buffer.write(_.TEXT_FORMAT[`TXT_ALIGN_${utils.upperCase(align)}` as const]);
		return this;
	}
	/**
	 * [font family]
	 * @param  {[type]}    family  [description]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	font(family: FontFamily) {
		this.buffer.write(_.TEXT_FORMAT[`TXT_FONT_${utils.upperCase(family)}` as const]);
		if (family.toUpperCase() === "A") this.width = (this.options && this.options.width) || 42;
		else this.width = (this.options && this.options.width) || 56;
		return this;
	}

	/**
	 * [font style]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	_getStyle(string: StyleString): string;
	_getStyle(bold: boolean, italic: boolean, underline: boolean | 0 | 1 | 2): string;
	_getStyle(boldOrString: boolean | StyleString, italic?: boolean, underline?: boolean | 0 | 1 | 2) {
		if (typeof boldOrString === "string") {
			switch (utils.upperCase(boldOrString)) {
				case "B":
					return this._getStyle(true, false, 0);
				case "I":
					return this._getStyle(false, true, 0);
				case "U":
					return this._getStyle(false, false, 1);
				case "U2":
					return this._getStyle(false, false, 2);
				case "BI":
					return this._getStyle(true, true, 0);
				case "BIU":
					return this._getStyle(true, true, 1);
				case "BIU2":
					return this._getStyle(true, true, 2);
				case "BU":
					return this._getStyle(true, false, 1);
				case "BU2":
					return this._getStyle(true, false, 2);
				case "IU":
					return this._getStyle(false, true, 1);
				case "IU2":
					return this._getStyle(false, true, 2);
				case "NORMAL":
				default:
					return this._getStyle(false, false, 0);
			}
		} else {
			let styled = `${boldOrString ? _.TEXT_FORMAT.TXT_BOLD_ON : _.TEXT_FORMAT.TXT_BOLD_OFF}${
				italic ? _.TEXT_FORMAT.TXT_ITALIC_ON : _.TEXT_FORMAT.TXT_ITALIC_OFF
			}`;
			if (underline === 0 || underline === false) styled += _.TEXT_FORMAT.TXT_UNDERL_OFF;
			else if (underline === 1 || underline === true) styled += _.TEXT_FORMAT.TXT_UNDERL_ON;
			else if (underline === 2) styled += _.TEXT_FORMAT.TXT_UNDERL2_ON;
			return styled;
		}
	}

	/**
	 * [font style]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	style(string: StyleString): this;
	style(bold: boolean, italic: boolean, underline: boolean | 0 | 1 | 2): this;
	style(boldOrString: boolean | StyleString, italic?: boolean, underline?: boolean | 0 | 1 | 2) {
		const style =
			typeof boldOrString === "string"
				? this._getStyle(boldOrString)
				: this._getStyle(boldOrString, italic as boolean, underline as boolean);
		this.buffer.write(style);
		return this;
	}

	/**
	 * [font size]
	 * @param  {[String]}  width   [description]
	 * @param  {[String]}  height  [description]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	size(width: number, height: number) {
		this.buffer.write(_.TEXT_FORMAT.TXT_CUSTOM_SIZE(width, height));
		return this;
	}

	/**
	 * [set character spacing]
	 * @param  {[type]}    n     [description]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	spacing(n?: number | null) {
		if (n === undefined || n === null) {
			this.buffer.write(_.CHARACTER_SPACING.CS_DEFAULT);
		} else {
			this.buffer.write(_.CHARACTER_SPACING.CS_SET);
			this.buffer.writeUInt8(n);
		}
		return this;
	}

	/**
	 * [set line spacing]
	 * @param  {[type]} n [description]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	lineSpace(n?: number | null) {
		if (n === undefined || n === null) {
			this.buffer.write(_.LINE_SPACING.LS_DEFAULT);
		} else {
			this.buffer.write(_.LINE_SPACING.LS_SET);
			this.buffer.writeUInt8(n);
		}
		return this;
	}

	/**
	 * [hardware]
	 * @param  {[type]}    hw       [description]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	hardware(hw: HardwareCommand) {
		this.buffer.write(_.HARDWARE[`HW_${utils.upperCase(hw)}` as const]);
		return this;
	}

	private static isLegacyBarcodeOptions(
		optionsOrLegacy: [BarcodeOptions] | LegacyBarcodeArguments
	): optionsOrLegacy is LegacyBarcodeArguments {
		return typeof optionsOrLegacy[0] === "object";
	}

	/**
	 * [barcode]
	 * @param  {[type]}    code     [description]
	 * @param  {[type]}    type     [description]
	 * @param  {[type]}    options  [description]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	barcode(code: number, type: BarcodeType, options: BarcodeOptions): this;
	barcode(code: number, type: BarcodeType, ...optionsOrLegacy: [BarcodeOptions] | LegacyBarcodeArguments) {
		let options: BarcodeOptions;
		if (Printer.isLegacyBarcodeOptions(optionsOrLegacy)) {
			options = {
				width: optionsOrLegacy[0],
				height: optionsOrLegacy[1],
				position: optionsOrLegacy[2],
				font: optionsOrLegacy[3],
				includeParity: true
			};
		} else [options] = optionsOrLegacy;
		options.font = options.font ?? "a";
		options.position = options.position ?? "blw";
		options.includeParity = options.includeParity ?? true;

		const convertCode = code.toString(10);
		let parityBit = "";
		let codeLength = "";
		if (typeof type === "undefined" || type === null) {
			throw new TypeError("barcode type is required");
		}
		if (type === "EAN13" && convertCode.length !== 12) {
			throw new Error("EAN13 Barcode type requires code length 12");
		}
		if (type === "EAN8" && convertCode.length !== 7) {
			throw new Error("EAN8 Barcode type requires code length 7");
		}
		if (this._model === "qsprinter") {
			this.buffer.write(_.MODEL.QSPRINTER.BARCODE_MODE.ON);
		}
		if (this._model === "qsprinter") {
			// qsprinter has no BARCODE_WIDTH command (as of v7.5)
		} else if (utils.isKey(options.width, _.BARCODE_FORMAT.BARCODE_WIDTH)) {
			this.buffer.write(_.BARCODE_FORMAT.BARCODE_WIDTH[options.width]);
		} else {
			this.buffer.write(_.BARCODE_FORMAT.BARCODE_WIDTH_DEFAULT);
		}
		if (options.height >= 1 && options.height <= 255) {
			this.buffer.write(_.BARCODE_FORMAT.BARCODE_HEIGHT(options.height));
		} else {
			if (this._model === "qsprinter") {
				this.buffer.write(_.MODEL.QSPRINTER.BARCODE_HEIGHT_DEFAULT);
			} else {
				this.buffer.write(_.BARCODE_FORMAT.BARCODE_HEIGHT_DEFAULT);
			}
		}
		if (this._model === "qsprinter") {
			// Qsprinter has no barcode font
		} else {
			this.buffer.write(_.BARCODE_FORMAT[`BARCODE_FONT_${utils.upperCase(options.font)}` as const]);
		}
		this.buffer.write(_.BARCODE_FORMAT[`BARCODE_TXT_${utils.upperCase(options.position)}` as const]);

		let normalizedType = utils.upperCase(type);
		if (normalizedType === "UPC-A") normalizedType = "UPC_A";
		else if (normalizedType === "UPC-E") normalizedType = "UPC_E";

		this.buffer.write(_.BARCODE_FORMAT[`BARCODE_${normalizedType}` as const]);
		if (options.includeParity) {
			if (type === "EAN13" || type === "EAN8") {
				parityBit = utils.getParityBit(convertCode);
			}
		}
		if (type == "CODE128" || type == "CODE93") {
			codeLength = utils.codeLength(convertCode);
		}
		this.buffer.write(codeLength + convertCode + (options.includeParity ? parityBit : "") + "\x00"); // Allow to skip the parity byte
		if (this._model === "qsprinter") {
			this.buffer.write(_.MODEL.QSPRINTER.BARCODE_MODE.OFF);
		}
		return this;
	}

	/**
	 * [function Send pulse to kick the cash drawer]
	 * @param  {[type]} pin [description]
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	cashdraw(pin: 2 | 5 = 2) {
		this.buffer.write(_.CASH_DRAWER[pin === 5 ? "CD_KICK_5" : "CD_KICK_2"]);
		return this;
	}

	/**
	 * Printer Buzzer (Beep sound)
	 * @param  {[Number]} n Refers to the number of buzzer times
	 * @param  {[Number]} t Refers to the buzzer sound length in (t * 100) milliseconds.
	 */
	beep(n: number, t: number) {
		this.buffer.write(_.BEEP);
		this.buffer.writeUInt8(n);
		this.buffer.writeUInt8(t);
		return this;
	}

	/**
	 * Send data to hardware and flush buffer
	 * @return {[Promise]}
	 */
	flush(): Promise<this> {
		return new Promise((resolve, reject) => {
			const buf = this.buffer.flush();
			this.adapter.write(buf, (error) => {
				if (error) reject(error);
				else resolve(this);
			});
		});
	}

	/**
	 * Cut paper
	 * @param  {[boolean]} partial set a full or partial cut. Default: full Partial cut is not implemented in all printers
	 * @param  {[number]} feed Number of lines to feed before cutting
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	cut(partial = false, feed = 3) {
		this.feed(feed);
		this.buffer.write(_.PAPER[partial ? "PAPER_PART_CUT" : "PAPER_FULL_CUT"]);
		return this;
	}

	/**
	 * [close description]
	 * @param closeArgs Arguments passed to adapter's close function
	 */
	async close(...closeArgs: AdapterCloseArgs): Promise<this> {
		await this.flush();
		return new Promise((resolve, reject) => {
			this.adapter.close((error) => {
				if (error) reject(error);
				resolve(this);
			}, ...closeArgs);
		});
	}

	/**
	 * [color select between two print color modes, if your printer supports it]
	 * @param  {Number} color - 0 for primary color (black) 1 for secondary color (red)
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	color(color: 0 | 1) {
		if (color !== 0 && color !== 1) {
			this.buffer.write(_.COLOR[0]);
		} else this.buffer.write(_.COLOR[color]);
		return this;
	}

	/**
	 * [reverse colors, if your printer supports it]
	 * @param {Boolean} reverse - True for reverse, false otherwise
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	setReverseColors(reverse: boolean) {
		this.buffer.write(reverse ? _.COLOR.REVERSE : _.COLOR.UNREVERSE);
		return this;
	}

	/**
	 * [writes a low level command to the printer buffer]
	 *
	 * @usage
	 * 1) raw('1d:77:06:1d:6b:02:32:32:30:30:30:30:32:30:30:30:35:30:35:00:0a')
	 * 2) raw('1d 77 06 1d 6b 02 32 32 30 30 30 30 32 30 30 30 35 30 35 00 0a')
	 * 3) raw(Uint8Array.from('1d77061d6b0232323030303032303030353035000a','hex'))
	 *
	 * @param data {Uint8Array|string}
	 * @returns {Printer}
	 */
	raw(data: Uint8Array | string) {
		this.buffer.write(data);
		return this;
	}

	/**
	 * get one specific status from the printer using it's class
	 * @param  {string} statusClass
	 * @return {Promise} promise returning given status
	 */
	getStatus<T extends DeviceStatus>(statusClass: StatusClassConstructor<T>): Promise<T> {
		return new Promise((resolve) => {
			this.adapter.read((data) => {
				const byte = data[0];
				resolve(new statusClass(byte));
			});

			statusClass.commands().forEach((c) => {
				this.buffer.write(c);
			});
		});
	}

	/**
	 * get statuses from the printer
	 * @return {Promise}
	 */
	getStatuses() {
		return new Promise((resolve) => {
			this.adapter.read((data) => {
				const buffer: number[] = [];
				for (let i = 0; i < data.byteLength; i++) buffer.push(data[i]);
				if (buffer.length < 4) return;

				const statuses = [
					new PrinterStatus(buffer[0]),
					new RollPaperSensorStatus(buffer[1]),
					new OfflineCauseStatus(buffer[2]),
					new ErrorCauseStatus(buffer[3])
				];
				resolve(statuses);
			});

			[PrinterStatus, RollPaperSensorStatus, OfflineCauseStatus, ErrorCauseStatus].forEach((statusClass) => {
				statusClass.commands().forEach((command) => {
					this.adapter.write(new TextEncoder().encode(command));
				});
			});
		});
	}

	/**
	 * STAR printer - Paper cut instruction
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	starFullCut() {
		this.buffer.write(_.PAPER.STAR_FULL_CUT);
		return this;
	}

	/**
	 * STAR printer - Select emphasized printing
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	emphasize() {
		this.buffer.write(_.TEXT_FORMAT.STAR_TXT_EMPHASIZED);
		return this;
	}

	/**
	 * STAR printer - Cancel emphasized printing
	 * @return {[Printer]} printer  [the escpos printer instance]
	 */
	cancelEmphasize() {
		this.buffer.write(_.TEXT_FORMAT.STAR_CANCEL_TXT_EMPHASIZED);
		return this;
	}
}

class MutBuf {
	buf = new Uint8Array();

	write(str: string | Uint8Array) {
		const newBuf = typeof str === "string" ? new TextEncoder().encode(str) : str;
		this.buf = new Uint8Array([...this.buf, ...newBuf]);
	}

	writeUInt8(x: number) {
		this.buf = new Uint8Array([...this.buf, x]);
	}

	flush() {
		const buf = new Uint8Array(this.buf);
		this.buf = new Uint8Array();

		return buf;
	}
}

export default Printer;
export const command = _;
