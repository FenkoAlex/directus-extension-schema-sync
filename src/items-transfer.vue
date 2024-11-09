<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import {
  readItems,
  readCollections,
  schemaSnapshot,
  schemaDiff,
  schemaApply,
  utilsExport,
} from "@directus/sdk";
import { useStores } from "@directus/extensions-sdk";

import type {
  Collection as DirectusCollection,
  Field,
  Relation,
} from "@directus/shared/types";

import { initDirectusClients } from "./init-directus-clients";
import { nav } from "./path";
import Nav from "./nav.vue";
import { useExportImport } from "./useExportImport";

export type Collection = DirectusCollection & {
  meta: {
    system?: boolean;
  };
};

const { useNotificationsStore } = useStores();
const notificationsStore = useNotificationsStore();

const loading = ref(true);
const clientA = ref<any>(null);
const clientB = ref<any>(null);

const { uploading, importing, uploadFile, exportData } = useExportImport();
const init = async () => {
  const [client1, client2] = await initDirectusClients();
  clientA.value = client1;
  clientB.value = client2;

  loading.value = false;
};

onMounted(() => {
  init();
});

const collectionName = ref("export_tools");

const handleExportClick = ref(async () => {
  if (collectionName.value) {
    const file = await exportData(collectionName.value);
    uploadFile(collectionName.value, file, clientB.value);
  }
});
</script>

<template>
  <private-view title="Item transfer">
    <template v-slot:navigation>
      <Nav :activeItem="nav['item-transfer'].id" />
    </template>
    <div class="wrapper">
      <h1 v-if="loading">Loading...</h1>
      <div v-else>
        <div class="mb">
          <v-input class="mb" v-model="collectionName" />
          <v-button @click="handleExportClick" :disabled="false"
            >Load items</v-button
          >
        </div>
        <pre v-if="true"></pre>
        <h1 v-else>Everything is updated</h1>
      </div>
    </div>
  </private-view>
</template>

<style lang="scss" scoped>
.wrapper {
  margin: 24px 32px;
}

.mb {
  margin-bottom: 32px;
}
</style>
