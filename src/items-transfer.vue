<script setup lang="ts">
import { computed, ref, onMounted, inject } from "vue";
import { merge, sortBy } from "lodash";
import Nav from "./nav.vue";
import { getEndpoint } from "@directus/utils";

import {
  readItems,
  readCollections,
  schemaSnapshot,
  schemaDiff,
  schemaApply,
  utilsExport,
} from "@directus/sdk";
import { useStores } from "@directus/extensions-sdk";

import {
  Collection as DirectusCollection,
  Field,
  Relation,
} from "@directus/shared/types";

import { initDirectusClients } from "./init-directus-clients";
import { nav } from "./path";

export type Collection = DirectusCollection & {
  meta: {
    system?: boolean;
  };
};

const { useNotificationsStore } = useStores();
const notificationsStore = useNotificationsStore();
const api: any = inject("api");

const loading = ref(true);
const clientA = ref<any>(null);
const clientB = ref<any>(null);
const items = ref([]);

const init = async () => {
  const [client1, client2] = await initDirectusClients();
  clientA.value = client1;
  clientB.value = client2;

  loading.value = false;
};
onMounted(() => {
  init();
});

const collectionName = ref("item_types");

/**
 * Get the full API root URL from the current page href
 */
function getPublicURL(): string {
  return extract(window.location.href);
}

/**
 * Extract the root path of the admin app from a given input path/url
 *
 * @param path - Path or URL string of the current page
 * @returns - Root URL of the Directus instance
 */
function extract(path: string) {
  const parts = path.split("/");
  const adminIndex = parts.indexOf("admin");
  const rootPath = parts.slice(0, adminIndex).join("/") + "/";
  return rootPath;
}
async function exportDataLocal() {
  const endpoint = getEndpoint(collectionName.value);

  // usually getEndpoint contains leading slash, but here we need to remove it
  const url = getPublicURL() + endpoint.substring(1);

  const params: Record<string, unknown> = {
    access_token: (
      api.defaults.headers.common["Authorization"] as string
    ).substring(7),
    export: "json",
  };

  // if (exportSettings.sort && exportSettings.sort !== '') params.sort = exportSettings.sort;
  // if (exportSettings.fields) params.fields = exportSettings.fields;
  // if (exportSettings.search) params.search = exportSettings.search;
  // if (exportSettings.filter) params.filter = exportSettings.filter;
  // if (exportSettings.search) params.search = exportSettings.search;
  // params.limit = exportSettings.limit ? Math.min(exportSettings.limit, queryLimitMax) : -1;

  const exportUrl = api.getUri({
    url,
    params,
  });

  console.log(exportUrl);

  const result = await fetch(exportUrl).then((r) => r.json());
  console.log(result);
}

const handleExportClick = ref(async () => {
  if (collectionName.value) {
    exportDataLocal();
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
