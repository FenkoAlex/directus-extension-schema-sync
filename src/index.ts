import { defineModule } from '@directus/extensions-sdk';
import ModuleComponent from './module.vue';
import ItemTransferComponent from './items-transfer.vue';

export default defineModule({
	id: 'schema-export',
	name: 'Schema export',
	icon: 'box',
	routes: [
		{
			id: 'schema-export/main',
			path: '',
			component: ModuleComponent,
		},
		{
			id: 'schema-export/item-transfer',
			path: 'item-transfer',
			component: ItemTransferComponent,
		},
	],
	preRegisterCheck(user) {
		return user?.role?.admin_access === true;
	},
});
