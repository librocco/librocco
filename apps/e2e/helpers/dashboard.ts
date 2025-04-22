import type { Page } from "@playwright/test";

import { WebClientView } from "@librocco/shared";

import type { DashboardInterface } from "./types";

import { getMainNav } from "./navigation";
import { getContent } from "./content";
import { getDialog } from "./dialog";

import { idSelector, selector, viewSelector } from "./utils";
import { getBookForm, getCustomItemForm, getTextEditableForm } from "./forms";

export function getDashboard(_page: Page): DashboardInterface {
	const page = () => _page;
	const dashboard = () => getDashboard(_page);

	// As soon as some view is loaded, we can assume the dashboard is loaded
	const container = _page.locator(selector(idSelector("page-container")));

	// Created so that the dashboard (even though being root of the API) satisfies the same
	// interface required by all other nodes, DashboardNode:
	// - being a locator
	// - having a dashboard method (creating a new instance of itself)
	const node = Object.assign(container, { dashboard });

	const nav = () => getMainNav(node);

	const navigate = (to: WebClientView) => nav().navigate(to);

	const view = (name: WebClientView) =>
		Object.assign(_page.locator(selector(idSelector("page-container"), viewSelector(name))), {
			dashboard: () => getDashboard(_page)
		});

	const content = () => getContent(node);

	const dialog = () => getDialog(node);

	const bookForm = () => getBookForm(node);
	const textEditableField = () => getTextEditableForm(node);
	const customItemForm = () => getCustomItemForm(node);

	return Object.assign(container, { dashboard, page, nav, navigate, view, content, dialog, bookForm, customItemForm, textEditableField });
}
