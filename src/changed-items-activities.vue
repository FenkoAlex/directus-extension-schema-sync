<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useStores } from "@directus/extensions-sdk";
import { uniqBy } from "lodash";

import { COLLECTION_HEADER, COLLECTION_TO_EXCLUDE_FROM_SCHEMA } from "./const";
import { initDirectusClients } from "./init-directus-clients";
import Nav from "./nav.vue";
import { nav } from "./path";
import { mapFromCollectionable, recordFromCollectionable } from "./utils";
import { useSchema } from "./useSchema";

import type { Collection, Collectionable } from "./types";

const { useNotificationsStore } = useStores();
const notificationsStore = useNotificationsStore();

const loading = ref(true);
</script>

<template>
  <private-view title="Activities">
    <template v-slot:navigation>
      <Nav :activeItem="null" />
    </template>
    <div class="wrapper">
      <div class="controls mb32"></div>
      <div class="loaderWrapper" v-if="loading">
        <v-progress-circular class="loader" indeterminate />
      </div>
      <div v-else>
        <h1>Changed Items</h1>
      </div>
    </div>
  </private-view>
</template>

<style lang="scss" scoped>
.loaderWrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}
.wrapper {
  margin: 24px 32px;
}

.mb32 {
  margin-bottom: 32px;
}

.controls {
  display: flex;
  gap: 32px;
}
</style>
