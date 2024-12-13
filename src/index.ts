import { defineModule } from '@directus/extensions-sdk';
import SchemaTransferComponent from './schema-transfer.vue';
import ItemTransferComponent from './collections-transfer.vue';
import UniversalItemTransferComponent from './universal-collections-transfer.vue';

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
			id: 'schema-export/collection-transfer',
			path: 'collection-transfer',
			component: ItemTransferComponent,
		},
		{
			id: 'schema-export/universal-collection-transfer',
			path: 'universal-collection-transfer',
			component: UniversalItemTransferComponent,
		},
	],
	preRegisterCheck(user) {
		return user?.role?.admin_access === true;
	},
});
