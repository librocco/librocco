import LL from "@librocco/shared/i18n-svelte";
import type { TranslationFunctions } from "@librocco/shared";

export interface DialogContent {
	onConfirm: (closeDialog: () => void) => void;
	title: string;
	description: string;
}

let t: TranslationFunctions;

LL.subscribe((LL) => {
	// Update the translation object
	t = LL;
});

const tDialogTitle = t.dialog_title;
const tDialogDescription = t.dialog_description;

export const dialogTitle = {
	// Misc
	delete: (entity: string) => tDialogTitle.delete({ entity }),

	// Inbond
	commitInbound: (entity: string) => tDialogTitle.commit_inbound({ entity }),

	// Outbound
	commitOutbound: (entity: string) => tDialogTitle.commit_outbound({ entity }),
	noWarehouseSelected: () => tDialogTitle.no_warehouse_selected(),
	reconcileOutbound: () => tDialogTitle.reconcile_outbound(),

	// BookForm
	editBook: () => tDialogTitle.edit_book(),
	createCustomItem: () => tDialogTitle.create_custom_item(),
	editCustomItem: () => tDialogTitle.edit_custom_item(),

	// WarehouseForm
	editWarehouse: () => tDialogTitle.edit_warehouse(),

	// DatabaseForm
	createDatabase: () => tDialogTitle.create_database()
};

export const dialogDescription = {
	// Misc
	deleteNote: () => tDialogDescription.delete_note(),
	deleteWarehouse: (bookCount: number) => tDialogDescription.delete_warehouse({ bookCount }),
	deleteDatabase: () => tDialogDescription.delete_database(),

	// Inbound
	commitInbound: (bookCount: number, warehouseName: string) => tDialogDescription.commit_inbound({ bookCount, warehouseName }),

	// Outbound
	commitOutbound: (bookCount: number) => tDialogDescription.commit_outbound({ bookCount }),
	noWarehouseSelected: () => tDialogDescription.no_warehouse_selected(),
	reconcileOutbound: () => tDialogDescription.reconcile_outbound(),

	// BookForm
	editBook: () => tDialogDescription.edit_book(),

	// WarehouseForm
	editWarehouse: () => tDialogDescription.edit_warehouse(),

	// DatabaseForm
	createDatabase: () => tDialogDescription.create_database()
};
