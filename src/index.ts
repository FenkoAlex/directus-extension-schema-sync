import { defineModule } from '@directus/extensions-sdk';
import SchemaTransferComponent from './schema-transfer.vue';
import ItemTransferComponent from './items-transfer.vue';
import UniversalItemTransferComponent from './universal-items-transfer.vue';

export default defineModule({
	id: 'schema-export',
	name: 'Schema export',
	icon: 'box',
	routes: [
		{
			id: 'schema-export/main',
			path: '',
			component: SchemaTransferComponent,
		},
		{
			id: 'schema-export/item-transfer',
			path: 'item-transfer',
			component: ItemTransferComponent,
		},
		{
			id: 'schema-export/universal-item-transfer',
			path: 'universal-item-transfer',
			component: UniversalItemTransferComponent,
		},
	],
	preRegisterCheck(user) {
		return user?.role?.admin_access === true;
	},
});
