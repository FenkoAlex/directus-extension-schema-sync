<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { merge, sortBy } from "lodash";

import {
  readItems,
  readCollections,
  schemaSnapshot,
  schemaDiff,
  schemaApply,
} from "@directus/sdk";
import { useStores } from "@directus/extensions-sdk";

import {
  Collection as DirectusCollection,
  Field,
  Relation,
} from "@directus/shared/types";

import { initDirectusClients } from './init-directus-clients';
import Nav from './nav.vue';
import { nav } from './path';

export type Collection = DirectusCollection & {
  meta: {
    system?: boolean;
  };
};

const {
  useNotificationsStore,
} = useStores();
const notificationsStore = useNotificationsStore();

const loading = ref(true);
const collections = ref<Collection[]>([]);
const clientProd = ref<any>(null);
const schemaDiffResponce = ref<any>(null);
const schema = ref<any | null>(null);
const canApplySchema = ref(false);

const init = async () => {
  const [clientA, clientB] = await initDirectusClients();
  clientProd.value = clientB;
  collections.value = await clientA.request(readCollections());
  schema.value = await clientA.request(schemaSnapshot());

  schemaDiffResponce.value = await clientB.request(
    schemaDiff(schema.value)
  );

  if (schemaDiffResponce.value?.status === 204) {
    console.log("everything is updated!");
  } else {
    canApplySchema.value = true;
  }

  loading.value = false;
};
onMounted(() => {
  init();
});

const handleApplyClick = ref(async () => {
  try {
    const result = await clientProd.value.request(
      schemaApply(schemaDiffResponce.value)
    );
    
    notificationsStore.add({
      type: "success",
      title: 'Change applied successfully',
      dialog: false,
    });
  } catch (e) {
    console.error(e);
    notificationsStore.add({
      type: "error",
      title: 'Error duiring apply',
      text: e?.errors?.[0]?.message,
      dialog: true,
    });
  }
});
</script>

<template>
  <private-view title="Export">
    <template v-slot:navigation>
      <Nav :activeItem="nav.main.id" />
    </template>
    <div class="wrapper">
      <h1 v-if="loading">Loading...</h1>
      <div v-else>
        <div class="control">
          <v-button @click="handleApplyClick" :disabled="!canApplySchema">Apply diff</v-button>
        </div>
        <pre v-if="canApplySchema">{{ schemaDiffResponce }}</pre>
        <h1 v-else>Everything is updated</h1>
      </div>
    </div>
  </private-view>
</template>

<style lang="scss" scoped>
.wrapper {
  margin: 24px 32px;
}

.control {
  margin-bottom: 32px;
}
</style>
